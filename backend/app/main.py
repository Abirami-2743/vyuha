"""FastAPI application entry point for Vyuha."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .analysis_models import AnalysisStreamEvent
from .discovery_models import DiscoveryRequest, DiscoveryResult
from .errors import IntegrationError
from .llm import LLMClient
from .logging_config import configure_logging
from .pipeline import DiscoveryPipeline
from .qloo import QlooClient
from .settings import Settings, get_settings
from .verification import NominatimClient

logger = logging.getLogger("vyuha.api")


class RequestLimitAndLoggingMiddleware:
    def __init__(self, app: Any, max_request_bytes: int) -> None:
        self.app = app
        self.max_request_bytes = max_request_bytes

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_at = time.perf_counter()
        status_code = 500
        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError:
                await self._send_json(send, 400, {"error": "invalid_content_length"})
                return
            if declared_length < 0:
                await self._send_json(send, 400, {"error": "invalid_content_length"})
                return
            if declared_length > self.max_request_bytes:
                await self._send_json(send, 413, {"error": "request_too_large"})
                logger.info(
                    "request_rejected",
                    extra={"event": "request_rejected", "reason": "request_too_large"},
                )
                return

        buffered_events: list[dict[str, Any]] = []
        body_size = 0
        while True:
            event = await receive()
            buffered_events.append(event)
            if event["type"] == "http.request":
                body_size += len(event.get("body", b""))
                if body_size > self.max_request_bytes:
                    await self._send_json(send, 413, {"error": "request_too_large"})
                    logger.info(
                        "request_rejected",
                        extra={"event": "request_rejected", "reason": "request_too_large"},
                    )
                    return
                if not event.get("more_body", False):
                    break
            elif event["type"] == "http.disconnect":
                return

        async def replay_receive() -> dict[str, Any]:
            if buffered_events:
                return buffered_events.pop(0)
            return await receive()

        async def observe_send(message: dict[str, Any]) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, replay_receive, observe_send)
        except Exception as exc:
            logger.error(
                "request_failed",
                extra={
                    "event": "request_failed",
                    "http_method": scope["method"],
                    "path": scope["path"],
                    "exception_type": type(exc).__name__,
                },
            )
            raise
        finally:
            logger.info(
                "http_request",
                extra={
                    "event": "http_request",
                    "http_method": scope["method"],
                    "path": scope["path"],
                    "status_code": status_code,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                    "request_bytes": body_size,
                },
            )

    @staticmethod
    async def _send_json(send: Any, status_code: int, content: dict[str, str]) -> None:
        body = json.dumps(content).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    configure_logging(configured.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.settings = configured
        application.state.qloo_client = (
            QlooClient(configured) if configured.qloo_api_key is not None else None
        )
        application.state.nominatim_client = NominatimClient()
        application.state.llm_client = LLMClient(configured)
        application.state.discovery_pipeline = DiscoveryPipeline(
            application.state.qloo_client,
            application.state.nominatim_client,
            application.state.llm_client,
        )
        if application.state.qloo_client is None:
            logger.warning(
                "qloo_integration_disabled",
                extra={"event": "qloo_integration_disabled", "reason": "missing_configuration"},
            )
        try:
            yield
        finally:
            await application.state.nominatim_client.aclose()
            if application.state.qloo_client is not None:
                await application.state.qloo_client.aclose()
            await application.state.llm_client.aclose()

    application = FastAPI(title="Vyuha", version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        RequestLimitAndLoggingMiddleware,
        max_request_bytes=configured.max_request_bytes,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @application.exception_handler(IntegrationError)
    async def integration_error_handler(
        request: Request,
        exc: IntegrationError,
    ) -> JSONResponse:
        logger.warning(
            "integration_error",
            extra={
                "event": "integration_error",
                "path": request.url.path,
                "error_code": exc.code,
                "status_code": exc.status_code,
            },
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": exc.public_message},
        )

    @application.exception_handler(RequestValidationError)
    async def request_validation_error_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        errors = [
            {"location": list(error["loc"]), "type": error["type"], "message": error["msg"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"error": "request_validation_failed", "details": errors},
        )

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "vyuha"}

    @application.post("/discover", response_model=DiscoveryResult)
    async def discover(request: DiscoveryRequest) -> DiscoveryResult:
        return await application.state.discovery_pipeline.run(request)

    @application.post("/analyze")
    async def analyze(request: DiscoveryRequest) -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            try:
                async for event in application.state.discovery_pipeline.analyze_stream(request):
                    yield f"data: {event.model_dump_json()}\n\n"
            except IntegrationError as exc:
                logger.warning(
                    "analysis_stream_failed",
                    extra={
                        "event": "analysis_stream_failed",
                        "error_code": exc.code,
                        "status_code": exc.status_code,
                    },
                )
                failed = AnalysisStreamEvent(
                    stage="analysis",
                    status="failed",
                    message=exc.public_message,
                )
                yield f"data: {failed.model_dump_json()}\n\n"

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return application


app = create_app()

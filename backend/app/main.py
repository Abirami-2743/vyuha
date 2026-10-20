"""FastAPI application entry point for Vyuha."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from stat import S_ISREG
from tempfile import NamedTemporaryFile
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from .analysis_models import AnalysisResult, AnalysisStreamEvent
from .discovery_models import DiscoveryRequest, DiscoveryResult
from .errors import IntegrationError
from .llm import LLMClient
from .logging_config import configure_logging
from .pipeline import DiscoveryPipeline
from .qloo import QlooClient
from .settings import REPOSITORY_ROOT, Settings, get_settings
from .verification import NominatimClient

logger = logging.getLogger("vyuha.api")
MAX_SAVED_RUN_BYTES = 5 * 1024 * 1024
DEMO_IDS = frozenset(
    {
        "blue-bottle-san-francisco",
        "the-ordinary-new-york",
        "starbucks-chennai",
        "nike-portland",
        "qvxxqz-blorpblorp-boise",
    }
)


class SavedRunIdentitySelection(BaseModel):
    kind: Literal["osm", "qloo", "seed"]
    selected_name: str = Field(min_length=1, max_length=500)
    selected_identifier: str = Field(min_length=1, max_length=256)


class SavedRunMetadata(BaseModel):
    demo_id: str = Field(min_length=1, max_length=100)
    identity_selection_rule: str = Field(min_length=1, max_length=1_000)
    identity_selections: list[SavedRunIdentitySelection] = Field(
        default_factory=list,
        max_length=50,
    )


class SavedRunResponse(BaseModel):
    captured_at: datetime
    analysis: AnalysisResult
    metadata: SavedRunMetadata | None = None


def read_saved_run(saved_run_path: Path, message: str) -> SavedRunResponse:
    try:
        file_info = saved_run_path.stat()
        if not S_ISREG(file_info.st_mode) or file_info.st_size > MAX_SAVED_RUN_BYTES:
            raise ValueError("saved run is not a regular file within the size limit")
        payload = json.loads(saved_run_path.read_text(encoding="utf-8"))
        return SavedRunResponse.model_validate(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=message) from exc
    except (OSError, ValueError, ValidationError) as exc:
        logger.error(
            "saved_run_read_failed",
            extra={
                "event": "saved_run_read_failed",
                "exception_type": type(exc).__name__,
            },
        )
        raise HTTPException(status_code=500, detail="The saved run is unavailable.") from exc


class DailyAnalysisLimiter:
    def __init__(self, per_ip_limit: int, daily_limit: int) -> None:
        self.per_ip_limit = per_ip_limit
        self.daily_limit = daily_limit
        self.day: str | None = None
        self.total = 0
        self.per_ip: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def consume(self, client_ip: str) -> tuple[str | None, int]:
        now = datetime.now(timezone.utc)
        day = now.date().isoformat()
        retry_after = max(
            1,
            int(
                (
                    datetime.combine(now.date() + timedelta(days=1), datetime.min.time())
                    .replace(tzinfo=timezone.utc)
                    - now
                ).total_seconds()
            ),
        )
        async with self._lock:
            if self.day != day:
                self.day = day
                self.total = 0
                self.per_ip.clear()
            if self.total >= self.daily_limit:
                return "daily", retry_after
            if self.per_ip.get(client_ip, 0) >= self.per_ip_limit:
                return "per_ip", retry_after
            self.total += 1
            self.per_ip[client_ip] = self.per_ip.get(client_ip, 0) + 1
            return None, retry_after


def persist_saved_run(path: Path | None, analysis: AnalysisResult) -> None:
    if path is None:
        return
    destination = path if path.is_absolute() else REPOSITORY_ROOT / path
    temporary_path: Path | None = None
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination.parent,
            prefix=f"{destination.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(
                {
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "analysis": analysis.model_dump(mode="json"),
                },
                temporary_file,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        temporary_path.replace(destination)
    except OSError as exc:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        logger.error(
            "saved_run_write_failed",
            extra={
                "event": "saved_run_write_failed",
                "exception_type": type(exc).__name__,
            },
        )


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
    analysis_limiter = DailyAnalysisLimiter(
        configured.analysis_per_ip_daily_limit,
        configured.analysis_daily_limit,
    )

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

    @application.get("/saved-run", response_model=SavedRunResponse)
    async def saved_run() -> SavedRunResponse:
        configured_path = configured.vyuha_saved_run_path
        if configured_path is None:
            raise HTTPException(status_code=404, detail="No saved run is configured.")

        saved_run_path = (
            configured_path
            if configured_path.is_absolute()
            else REPOSITORY_ROOT / configured_path
        )
        return read_saved_run(saved_run_path, "No saved run is available.")

    @application.get("/saved-run/{demo_id}", response_model=SavedRunResponse)
    async def saved_demo_run(demo_id: str) -> SavedRunResponse:
        if demo_id not in DEMO_IDS:
            raise HTTPException(status_code=404, detail="No saved run is available.")
        configured_directory = configured.vyuha_saved_runs_dir
        if configured_directory is None:
            raise HTTPException(status_code=404, detail="No saved run is available.")
        saved_runs_directory = (
            configured_directory
            if configured_directory.is_absolute()
            else REPOSITORY_ROOT / configured_directory
        )
        run = read_saved_run(
            saved_runs_directory / f"{demo_id}.json",
            "No saved run is available.",
        )
        if run.metadata is not None and run.metadata.demo_id != demo_id:
            logger.error(
                "saved_run_demo_id_mismatch",
                extra={"event": "saved_run_demo_id_mismatch", "demo_id": demo_id},
            )
            raise HTTPException(status_code=500, detail="The saved run is unavailable.")
        return run

    @application.post("/discover", response_model=DiscoveryResult)
    async def discover(
        request: DiscoveryRequest,
        incoming_request: Request,
    ) -> DiscoveryResult | JSONResponse:
        client_ip = incoming_request.client.host if incoming_request.client else "unknown"
        limit, retry_after = await analysis_limiter.consume(client_ip)
        if limit is not None:
            message = (
                "Vyuha's daily public-demo limit has been reached. Try again after the UTC reset "
                "or use a saved run if one is available."
                if limit == "daily"
                else "The daily request limit for this network has been reached. Try again after "
                "the UTC reset or use a saved run if one is available."
            )
            return JSONResponse(
                status_code=429,
                content={"error": f"{limit}_analysis_limit", "message": message},
                headers={"Retry-After": str(retry_after)},
            )
        return await application.state.discovery_pipeline.run(request)

    @application.post("/analyze", response_model=None)
    async def analyze(
        request: DiscoveryRequest,
        incoming_request: Request,
    ) -> StreamingResponse | JSONResponse:
        client_ip = incoming_request.client.host if incoming_request.client else "unknown"
        limit, retry_after = await analysis_limiter.consume(client_ip)
        if limit is not None:
            message = (
                "Vyuha's daily public-demo limit has been reached. Try again after the UTC reset "
                "or use a saved run if one is available."
                if limit == "daily"
                else "The daily request limit for this network has been reached. Try again after "
                "the UTC reset or use a saved run if one is available."
            )
            return JSONResponse(
                status_code=429,
                content={"error": f"{limit}_analysis_limit", "message": message},
                headers={"Retry-After": str(retry_after)},
            )

        async def events() -> AsyncIterator[str]:
            try:
                async for event in application.state.discovery_pipeline.analyze_stream(request):
                    if (
                        event.stage == "analysis"
                        and event.status == "complete"
                        and event.result is not None
                    ):
                        persist_saved_run(configured.vyuha_saved_run_output_path, event.result)
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

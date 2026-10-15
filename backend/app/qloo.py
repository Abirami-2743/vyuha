"""Server-side client for the documented Qloo Search and Insights routes."""

from __future__ import annotations

import asyncio
import logging
import math
import re
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from .errors import QlooError
from .models import Candidate, EvidenceItem, ResolvedEntity
from .settings import Settings

_ENTITY_TYPE_PATTERN = re.compile(r"^urn:(?:entity:[a-z0-9_]+|heatmap)$")
_TRANSIENT_STATUSES = {429, 500, 502, 503, 504}
logger = logging.getLogger("vyuha.qloo")


class QlooClient:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if settings.qloo_api_key is None or not settings.qloo_api_key.get_secret_value().strip():
            raise QlooError(
                "qloo_not_configured",
                "Qloo integration is not configured on the server.",
                status_code=503,
            )
        base_url = str(settings.qloo_base_url).rstrip("/")
        parsed_url = urlparse(base_url)
        if parsed_url.scheme != "https" or parsed_url.hostname != "hackathon.api.qloo.com":
            raise QlooError(
                "qloo_invalid_host",
                "Qloo is configured with an unsupported API host.",
                status_code=503,
            )
        self._base_url = base_url
        self._api_key = settings.qloo_api_key.get_secret_value()
        self._timeout = settings.qloo_timeout_seconds
        self._max_retries = settings.qloo_max_retries
        self._backoff = settings.qloo_retry_backoff_seconds
        self._sleep = sleep
        self._http = httpx.AsyncClient(transport=transport)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> QlooClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def search_entities(self, query: str, entity_type: str) -> list[ResolvedEntity]:
        clean_query = query.strip()
        if not clean_query or len(clean_query) > 256:
            raise QlooError(
                "qloo_invalid_input",
                "Search text must contain 1 to 256 characters.",
                status_code=422,
            )
        if not _ENTITY_TYPE_PATTERN.fullmatch(entity_type):
            raise QlooError(
                "qloo_invalid_input",
                "The requested Qloo entity type is invalid.",
                status_code=422,
            )

        payload = await self._get_json(
            "/search",
            params={"query": clean_query, "types": entity_type},
            not_found_is_empty=True,
        )
        if payload is None:
            return []
        results = payload.get("results")
        if not isinstance(results, list):
            raise self._malformed_response()

        entities: list[ResolvedEntity] = []
        for item in results:
            if not isinstance(item, dict):
                raise self._malformed_response()
            entity_id = item.get("entity_id")
            name = item.get("name")
            if not isinstance(entity_id, str) or not entity_id.strip():
                raise self._malformed_response()
            if not isinstance(name, str) or not name.strip():
                raise self._malformed_response()
            entity_types = item.get("types", [])
            if not isinstance(entity_types, list) or any(
                not isinstance(value, str) or not value.strip() for value in entity_types
            ):
                raise self._malformed_response()
            properties = item.get("properties", {})
            if not isinstance(properties, dict):
                raise self._malformed_response()
            description = properties.get("description")
            if description is not None and not isinstance(description, str):
                raise self._malformed_response()
            try:
                entities.append(
                    ResolvedEntity(
                        entity_id=entity_id,
                        name=name,
                        entity_type=entity_type,
                        entity_types=entity_types,
                        description=description,
                    )
                )
            except ValidationError as exc:
                raise self._malformed_response() from exc
        return entities

    async def get_cross_category_candidates(
        self,
        entity: ResolvedEntity,
        output_type: str,
    ) -> list[Candidate]:
        if not _ENTITY_TYPE_PATTERN.fullmatch(output_type):
            raise QlooError(
                "qloo_invalid_input",
                "The requested Qloo output type is invalid.",
                status_code=422,
            )
        payload = await self._get_json(
            "/v2/insights",
            params={
                "filter.type": output_type,
                "signal.interests.entities": entity.entity_id,
            },
        )
        if payload is None:
            raise self._malformed_response()
        results = payload.get("results")
        if not isinstance(results, dict):
            raise self._malformed_response()
        entities = results.get("entities")
        if not isinstance(entities, list):
            raise self._malformed_response()

        retrieved_at = datetime.now(timezone.utc)
        reference = (
            f"/v2/insights?filter.type={output_type}&signal.interests.entities={entity.entity_id}"
        )
        candidates: list[Candidate] = []
        for item in entities:
            if not isinstance(item, dict):
                raise self._malformed_response()
            entity_id = item.get("entity_id")
            name = item.get("name")
            entity_type = item.get("type")
            subtype = item.get("subtype")
            if not isinstance(entity_id, str) or not entity_id.strip():
                raise self._malformed_response()
            if not isinstance(name, str) or not name.strip():
                raise self._malformed_response()
            if not isinstance(entity_type, str) or not entity_type.strip():
                raise self._malformed_response()
            if subtype is not None and not isinstance(subtype, str):
                raise self._malformed_response()
            if subtype != output_type:
                raise self._malformed_response()

            query = item.get("query")
            affinity: float | None = None
            if query is not None:
                if not isinstance(query, dict):
                    raise self._malformed_response()
                affinity_value = query.get("affinity")
                if affinity_value is not None:
                    if (
                        isinstance(affinity_value, bool)
                        or not isinstance(affinity_value, (int, float))
                        or not math.isfinite(affinity_value)
                    ):
                        raise self._malformed_response()
                    affinity = float(affinity_value)

            try:
                candidates.append(
                    Candidate(
                        entity_id=entity_id,
                        name=name,
                        entity_type=entity_type,
                        subtype=subtype,
                        affinity_score=affinity,
                        evidence=[
                            EvidenceItem(
                                source_type="qloo",
                                source_reference=reference,
                                retrieved_at=retrieved_at,
                                claim=(
                                    f"Qloo returned {name!r} for the requested entity "
                                    "and output category."
                                ),
                            ),
                        ],
                    )
                )
            except ValidationError as exc:
                raise self._malformed_response() from exc
        return candidates

    async def _get_json(
        self,
        path: str,
        *,
        params: dict[str, str],
        not_found_is_empty: bool = False,
    ) -> dict[str, Any] | None:
        for attempt in range(self._max_retries + 1):
            try:
                response = await self._http.get(
                    f"{self._base_url}{path}",
                    headers={"X-Api-Key": self._api_key},
                    params=params,
                    timeout=self._timeout,
                )
            except httpx.TimeoutException as exc:
                if attempt < self._max_retries:
                    logger.warning(
                        "qloo_retry",
                        extra={
                            "event": "qloo_retry",
                            "reason": "timeout",
                            "attempt": attempt + 1,
                        },
                    )
                    await self._sleep(self._backoff * (2**attempt))
                    continue
                raise QlooError(
                    "qloo_timeout",
                    "Qloo did not respond before the request timed out.",
                    status_code=504,
                    retryable=True,
                ) from exc
            except httpx.RequestError as exc:
                if attempt < self._max_retries:
                    logger.warning(
                        "qloo_retry",
                        extra={
                            "event": "qloo_retry",
                            "reason": "request_error",
                            "attempt": attempt + 1,
                        },
                    )
                    await self._sleep(self._backoff * (2**attempt))
                    continue
                raise QlooError(
                    "qloo_unavailable",
                    "Qloo could not be reached. Please try again later.",
                    status_code=502,
                    retryable=True,
                ) from exc

            if response.status_code == 404 and not_found_is_empty:
                return None
            if response.status_code in _TRANSIENT_STATUSES:
                if attempt < self._max_retries:
                    logger.warning(
                        "qloo_retry",
                        extra={
                            "event": "qloo_retry",
                            "reason": "upstream_transient_status",
                            "status_code": response.status_code,
                            "attempt": attempt + 1,
                        },
                    )
                    await self._sleep(self._retry_delay(response, attempt))
                    continue
                if response.status_code == 429:
                    raise QlooError(
                        "qloo_rate_limited",
                        "Qloo is temporarily rate limiting requests. Please try again later.",
                        status_code=503,
                        retryable=True,
                    )
                raise QlooError(
                    "qloo_unavailable",
                    "Qloo is temporarily unavailable. Please try again later.",
                    status_code=502,
                    retryable=True,
                )
            if response.status_code == 401:
                raise QlooError(
                    "qloo_authentication_failed",
                    "Qloo authentication failed; verify the server-side API configuration.",
                    status_code=502,
                )
            if response.status_code == 403:
                raise QlooError(
                    "qloo_forbidden",
                    "Qloo does not allow this request or entity type.",
                    status_code=502,
                )
            if response.status_code == 404:
                raise QlooError(
                    "qloo_not_found",
                    "Qloo could not resolve the requested entity or resource.",
                    status_code=404,
                )
            if response.status_code == 400:
                raise QlooError(
                    "qloo_invalid_request",
                    "Qloo rejected the request parameters.",
                    status_code=422,
                )
            if response.status_code < 200 or response.status_code >= 300:
                raise QlooError(
                    "qloo_upstream_error",
                    "Qloo returned an unexpected response.",
                    status_code=502,
                )
            try:
                payload = response.json()
            except ValueError as exc:
                raise self._malformed_response() from exc
            if not isinstance(payload, dict):
                raise self._malformed_response()
            logger.info(
                "qloo_response",
                extra={
                    "event": "qloo_response",
                    "path": path,
                    "status_code": response.status_code,
                },
            )
            return payload

        raise AssertionError("bounded Qloo retry loop exited unexpectedly")

    def _retry_delay(self, response: httpx.Response, attempt: int) -> float:
        retry_after = response.headers.get("Retry-After")
        delay: float | None = None
        if retry_after:
            try:
                delay = float(retry_after)
            except ValueError:
                try:
                    retry_at = parsedate_to_datetime(retry_after)
                    if retry_at.tzinfo is None:
                        retry_at = retry_at.replace(tzinfo=timezone.utc)
                    delay = (retry_at - datetime.now(timezone.utc)).total_seconds()
                except (TypeError, ValueError, OverflowError):
                    delay = None
        if delay is None or not math.isfinite(delay):
            delay = self._backoff * (2**attempt)
        return max(0.0, min(delay, 10.0))

    @staticmethod
    def _malformed_response() -> QlooError:
        return QlooError(
            "qloo_malformed_response",
            "Qloo returned data in an unexpected format.",
            status_code=502,
        )

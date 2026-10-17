"""User-triggered, rate-limited lookups against the public OSM Nominatim API."""

from __future__ import annotations

import asyncio
import logging
import time
import unicodedata
from collections.abc import Awaitable, Callable
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .errors import VerificationError

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
logger = logging.getLogger("vyuha.verification")


class OSMPlace(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    osm_type: Literal["node", "way", "relation"]
    osm_id: int = Field(gt=0)
    name: str | None = Field(default=None, max_length=500)
    display_name: str = Field(min_length=1, max_length=2_000)
    category: str | None = Field(default=None, max_length=160)
    type: str | None = Field(default=None, max_length=160)
    lat: str | None = Field(default=None, max_length=40)
    lon: str | None = Field(default=None, max_length=40)
    address: dict[str, str] = Field(default_factory=dict)

    @property
    def source_reference(self) -> str:
        return f"https://www.openstreetmap.org/{self.osm_type}/{self.osm_id}"


class NominatimClient:
    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        timeout_seconds: float = 15,
    ) -> None:
        self._http = httpx.AsyncClient(
            transport=transport,
            headers={
                "User-Agent": "Vyuha/0.1 (Qloo Agentic Hackathon business discovery)",
                "Accept": "application/json",
            },
        )
        self._sleep = sleep
        self._timeout = timeout_seconds
        self._request_lock = asyncio.Lock()
        self._last_request_at: float | None = None

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> NominatimClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def search(self, name: str, market: str) -> list[OSMPlace]:
        clean_name = name.strip()
        clean_market = market.strip()
        if not clean_name or len(clean_name) > 160 or not clean_market or len(clean_market) > 240:
            raise VerificationError(
                "verification_invalid_input",
                "Business name and target market must be valid before place lookup.",
                status_code=422,
            )

        return await self._search(f"{clean_name}, {clean_market}")

    async def search_category(self, category: str, market: str) -> list[OSMPlace]:
        clean_category = category.strip()
        clean_market = market.strip()
        if (
            not clean_category
            or len(clean_category) > 160
            or not clean_market
            or len(clean_market) > 240
        ):
            raise VerificationError(
                "verification_invalid_input",
                "Industry and target market must be valid before place lookup.",
                status_code=422,
            )

        words = clean_category.split()
        last_word = words[-1]
        if last_word.casefold().endswith("s"):
            search_category = f"{clean_category} shops"
        elif (
            len(last_word) > 1
            and last_word.casefold().endswith("y")
            and last_word[-2].casefold() not in "aeiou"
        ):
            search_category = f"{clean_category[:-1]}ies"
        elif last_word.casefold().endswith(("ch", "sh", "x", "z")):
            search_category = f"{clean_category}es"
        else:
            search_category = f"{clean_category}s"
        return await self._search(f"{search_category} in {clean_market}")

    async def _search(self, query: str) -> list[OSMPlace]:
        async with self._request_lock:
            if self._last_request_at is not None:
                elapsed = time.monotonic() - self._last_request_at
                if elapsed < 1:
                    await self._sleep(1 - elapsed)
            self._last_request_at = time.monotonic()
            try:
                response = await self._http.get(
                    NOMINATIM_SEARCH_URL,
                    params={
                        "q": query,
                        "format": "jsonv2",
                        "addressdetails": "1",
                        "limit": "5",
                    },
                    timeout=self._timeout,
                )
            except httpx.TimeoutException as exc:
                raise VerificationError(
                    "verification_timeout",
                    "The independent place lookup timed out.",
                    status_code=504,
                    retryable=True,
                ) from exc
            except httpx.RequestError as exc:
                raise VerificationError(
                    "verification_unavailable",
                    "The independent place lookup is unavailable.",
                    status_code=502,
                    retryable=True,
                ) from exc

        logger.info(
            "nominatim_response",
            extra={
                "event": "nominatim_response",
                "status_code": response.status_code,
            },
        )
        if response.status_code == 429:
            raise VerificationError(
                "verification_rate_limited",
                "The independent place lookup is rate limited; try again later.",
                status_code=503,
                retryable=True,
            )
        if response.status_code < 200 or response.status_code >= 300:
            raise VerificationError(
                "verification_upstream_error",
                "The independent place lookup did not return a usable response.",
                status_code=502,
                retryable=response.status_code >= 500,
            )
        try:
            payload: object = response.json()
        except ValueError as exc:
            raise self._malformed_response() from exc
        if not isinstance(payload, list):
            raise self._malformed_response()

        places: list[OSMPlace] = []
        for item in payload:
            if not isinstance(item, dict):
                raise self._malformed_response()
            address = item.get("address", {})
            if not isinstance(address, dict) or any(
                not isinstance(key, str) or not isinstance(value, str)
                for key, value in address.items()
            ):
                raise self._malformed_response()
            try:
                places.append(OSMPlace.model_validate(item))
            except ValidationError as exc:
                raise self._malformed_response() from exc
        return places

    @staticmethod
    def exact_name_matches(name: str, places: list[OSMPlace]) -> list[OSMPlace]:
        normalized = normalize_text(name)
        return [
            place for place in places if place.name and normalize_text(place.name) == normalized
        ]

    @staticmethod
    def local_matches(market: str, places: list[OSMPlace]) -> list[OSMPlace]:
        requested = market.split(",", maxsplit=1)[0]
        normalized = normalize_text(requested)
        locality_keys = ("city", "town", "village", "municipality", "borough")
        return [
            place
            for place in places
            if any(
                normalize_text(place.address.get(key, "")) == normalized for key in locality_keys
            )
        ]

    @staticmethod
    def _malformed_response() -> VerificationError:
        return VerificationError(
            "verification_malformed_response",
            "The independent place lookup returned an unexpected response.",
            status_code=502,
        )


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return " ".join(
        "".join(character for character in decomposed if not unicodedata.combining(character))
        .replace(",", " ")
        .split()
    )

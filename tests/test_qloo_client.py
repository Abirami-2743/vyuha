"""Isolated Qloo client tests using mock-only fixtures and HTTP transports."""

import asyncio
from collections.abc import Callable, Coroutine
from typing import Any, TypeVar

import httpx
import pytest
from pydantic import SecretStr

from backend.app.errors import QlooError
from backend.app.qloo import QlooClient
from backend.app.settings import Settings
from tests.fixtures.qloo_responses import INSIGHTS_RESPONSE, SEARCH_RESPONSE

TEST_API_KEY = "fixture-only-qloo-key"
Result = TypeVar("Result")


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "qloo_api_key": SecretStr(TEST_API_KEY),
        "qloo_base_url": "https://hackathon.api.qloo.com",
        "qloo_max_retries": 0,
    }
    values.update(overrides)
    return Settings.model_validate(values)


def run(coro: Coroutine[Any, Any, Result]) -> Result:
    return asyncio.run(coro)


def json_handler(
    payload: object,
    *,
    status_code: int = 200,
    before_respond: Callable[[httpx.Request], None] | None = None,
) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        if before_respond:
            before_respond(request)
        return httpx.Response(status_code, json=payload)

    return httpx.MockTransport(handle)


def test_search_constructs_documented_request_and_parses_live_shape() -> None:
    def inspect_request(request: httpx.Request) -> None:
        assert request.method == "GET"
        assert request.url.path == "/search"
        assert request.url.params["query"] == "Fixture Brand"
        assert request.url.params["types"] == "urn:entity:brand"
        assert request.headers["X-Api-Key"] == TEST_API_KEY

    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler(SEARCH_RESPONSE, before_respond=inspect_request),
        ) as client:
            entities = await client.search_entities(
                " Fixture Brand ", "urn:entity:brand"
            )
        assert len(entities) == 1
        assert entities[0].entity_id == "test-brand-id"
        assert entities[0].name == "Fixture Brand"
        assert entities[0].entity_type == "urn:entity:brand"

    run(exercise())


def test_insights_request_and_affinity_parse_from_observed_response_shape() -> None:
    def inspect_request(request: httpx.Request) -> None:
        assert request.method == "GET"
        assert request.url.path == "/v2/insights"
        assert request.url.params["filter.type"] == "urn:entity:place"
        assert request.url.params["signal.interests.entities"] == "test-brand-id"
        assert request.headers["X-Api-Key"] == TEST_API_KEY

    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler(INSIGHTS_RESPONSE, before_respond=inspect_request),
        ) as client:
            from backend.app.models import ResolvedEntity

            candidates = await client.get_cross_category_candidates(
                ResolvedEntity(
                    entity_id="test-brand-id",
                    name="Fixture Brand",
                    entity_type="urn:entity:brand",
                ),
                "urn:entity:place",
            )
        assert len(candidates) == 1
        assert candidates[0].name == "Fixture Place"
        assert candidates[0].entity_type == "urn:entity"
        assert candidates[0].subtype == "urn:entity:place"
        assert candidates[0].affinity_score == pytest.approx(0.42)
        assert candidates[0].evidence[0].source_type == "qloo"
        assert candidates[0].evidence[0].retrieved_at.tzinfo is not None

    run(exercise())


def test_search_empty_results_and_documented_no_result_status_return_empty() -> None:
    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler({"results": []}),
        ) as client:
            assert (
                await client.search_entities("Missing Brand", "urn:entity:brand") == []
            )

        async with QlooClient(
            make_settings(),
            transport=json_handler({}, status_code=404),
        ) as client:
            assert (
                await client.search_entities("Missing Brand", "urn:entity:brand") == []
            )

    run(exercise())


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"results": [{"name": "Missing ID"}]},
        {"results": [None]},
    ],
)
def test_malformed_search_responses_are_classified(payload: object) -> None:
    async def exercise() -> None:
        async with QlooClient(
            make_settings(), transport=json_handler(payload)
        ) as client:
            with pytest.raises(QlooError) as caught:
                await client.search_entities("Fixture Brand", "urn:entity:brand")
        assert caught.value.code == "qloo_malformed_response"
        assert "fixture-only-qloo-key" not in str(caught.value)

    run(exercise())


def test_malformed_insights_response_is_classified() -> None:
    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler({"results": {}}),
        ) as client:
            from backend.app.models import ResolvedEntity

            with pytest.raises(QlooError, match="unexpected format"):
                await client.get_cross_category_candidates(
                    ResolvedEntity(
                        entity_id="test-brand-id",
                        name="Fixture Brand",
                        entity_type="urn:entity:brand",
                    ),
                    "urn:entity:place",
                )

    run(exercise())


def test_authentication_failure_does_not_expose_key() -> None:
    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler({"error": "anything"}, status_code=401),
        ) as client:
            with pytest.raises(QlooError) as caught:
                await client.search_entities("Fixture Brand", "urn:entity:brand")
        assert caught.value.code == "qloo_authentication_failed"
        assert caught.value.status_code == 502
        assert TEST_API_KEY not in caught.value.public_message

    run(exercise())


def test_rate_limit_honors_retry_after_and_retries_within_bound() -> None:
    requests = 0
    delays: list[float] = []

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        if requests == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json=SEARCH_RESPONSE)

    async def sleep(delay: float) -> None:
        delays.append(delay)

    async def exercise() -> None:
        async with QlooClient(
            make_settings(qloo_max_retries=1),
            transport=httpx.MockTransport(handle),
            sleep=sleep,
        ) as client:
            entities = await client.search_entities("Fixture Brand", "urn:entity:brand")
        assert len(entities) == 1

    run(exercise())
    assert requests == 2
    assert delays == [0]


def test_exhausted_rate_limit_returns_classified_safe_error() -> None:
    async def exercise() -> None:
        async with QlooClient(
            make_settings(),
            transport=json_handler({}, status_code=429),
        ) as client:
            with pytest.raises(QlooError) as caught:
                await client.search_entities("Fixture Brand", "urn:entity:brand")
        assert caught.value.code == "qloo_rate_limited"
        assert caught.value.retryable

    run(exercise())


def test_timeout_is_classified_without_retrying_past_bound() -> None:
    attempts = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("fixture timeout", request=request)

    async def exercise() -> None:
        async with QlooClient(
            make_settings(qloo_max_retries=1),
            transport=httpx.MockTransport(handle),
            sleep=lambda delay: asyncio.sleep(0),
        ) as client:
            with pytest.raises(QlooError) as caught:
                await client.search_entities("Fixture Brand", "urn:entity:brand")
        assert caught.value.code == "qloo_timeout"
        assert caught.value.status_code == 504

    run(exercise())
    assert attempts == 2

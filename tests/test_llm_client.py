"""Isolated LLM client tests; provider responses are synthetic test fixtures."""

import asyncio
import json
from collections.abc import Coroutine
from typing import Any, TypeVar

import httpx
import pytest
from pydantic import BaseModel, SecretStr

from backend.app.errors import LLMError
from backend.app.llm import LLMClient
from backend.app.settings import Settings

TEST_PRIMARY_KEY = "fixture-only-primary-key"
TEST_FALLBACK_KEY = "fixture-only-fallback-key"
Result = TypeVar("Result")


class StructuredResult(BaseModel):
    answer: str


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "llm_base_url": "https://primary.test/v1",
        "llm_api_key": SecretStr(TEST_PRIMARY_KEY),
        "llm_model": "fixture-primary-model",
        "llm_fallback_base_url": "https://fallback.test/api/v1",
        "llm_fallback_api_key": SecretStr(TEST_FALLBACK_KEY),
        "llm_fallback_model": "fixture-fallback-model",
        "llm_max_retries": 0,
        "llm_min_request_interval_seconds": 0,
    }
    values.update(overrides)
    return Settings.model_validate(values)


def run(coro: Coroutine[Any, Any, Result]) -> Result:
    return asyncio.run(coro)


async def no_sleep(_: float) -> None:
    return None


def compatible_chat_response(content: str, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code,
        json={"choices": [{"message": {"content": content}}]},
    )


def test_primary_rate_limit_uses_fallback_with_structured_output() -> None:
    provider_calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        provider_calls.append(request.url.host)
        if request.url.host == "primary.test":
            return httpx.Response(429)
        assert request.headers["Authorization"] == f"Bearer {TEST_FALLBACK_KEY}"
        body = json.loads(request.content)
        assert body["response_format"] == {"type": "json_object"}
        assert body["model"] == "fixture-fallback-model"
        return compatible_chat_response('{"answer":"fixture response"}')

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(),
            transport=httpx.MockTransport(handle),
        ) as client:
            return await client.generate(
                "Use only the supplied fixture.", StructuredResult, step="test"
            )

    result = run(exercise())
    assert result.answer == "fixture response"
    assert provider_calls == ["primary.test", "fallback.test"]
    assert TEST_PRIMARY_KEY not in repr(result)
    assert TEST_FALLBACK_KEY not in repr(result)


def test_invalid_primary_output_retries_once_on_fallback() -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        body = json.loads(request.content)
        assert "JSON Schema:" in body["messages"][1]["content"]
        if calls == 1:
            return compatible_chat_response('{"answer":3}')
        assert "other model returned output" in body["messages"][1]["content"]
        return compatible_chat_response('{"answer":"valid"}')

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(),
            transport=httpx.MockTransport(handle),
        ) as client:
            return await client.generate("Extract an answer.", StructuredResult, step="test")

    result = run(exercise())
    assert result.answer == "valid"
    assert calls == 2


def test_fallback_rate_limit_retries_once_with_short_backoff() -> None:
    calls = 0
    delays: list[float] = []

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if request.url.host == "primary.test":
            return httpx.Response(429, headers={"Retry-After": "60"})
        if calls == 2:
            return httpx.Response(429, headers={"Retry-After": "60"})
        return compatible_chat_response('{"answer":"retried"}')

    async def sleep(delay: float) -> None:
        delays.append(delay)

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(llm_max_retries=1),
            transport=httpx.MockTransport(handle),
            sleep=sleep,
        ) as client:
            return await client.generate("Return a result.", StructuredResult, step="test")

    result = run(exercise())
    assert result.answer == "retried"
    assert calls == 3
    assert delays[0] == 0.5


def test_minimum_interval_is_enforced_between_provider_requests() -> None:
    calls = 0
    delays: list[float] = []

    def handle(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        if calls == 2:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return compatible_chat_response('{"answer":"spaced"}')

    async def sleep(delay: float) -> None:
        delays.append(delay)

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(
                llm_max_retries=1,
                llm_min_request_interval_seconds=2,
            ),
            transport=httpx.MockTransport(handle),
            sleep=sleep,
        ) as client:
            return await client.generate("Return a result.", StructuredResult, step="test")

    result = run(exercise())
    assert result.answer == "spaced"
    assert calls == 3
    assert max(delays) >= 1.9


def test_primary_rate_limit_fails_over_without_waiting_for_retry_after() -> None:
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        if request.url.host == "primary.test":
            return httpx.Response(429, headers={"Retry-After": "60"})
        return compatible_chat_response('{"answer":"fallback"}')

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(llm_max_retries=1),
            transport=httpx.MockTransport(handle),
            sleep=no_sleep,
        ) as client:
            return await client.generate("Return a result.", StructuredResult, step="test")

    result = run(exercise())
    assert result.answer == "fallback"
    assert calls == ["primary.test", "fallback.test"]


def test_invalid_fallback_output_is_rejected() -> None:
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        return compatible_chat_response('{"wrong":"shape"}')

    async def exercise() -> None:
        async with LLMClient(
            make_settings(),
            transport=httpx.MockTransport(handle),
        ) as client:
            with pytest.raises(LLMError) as caught:
                await client.generate("Return data.", StructuredResult, step="test")
        assert caught.value.code == "llm_invalid_output"
        assert caught.value.status_code == 502

    run(exercise())
    assert calls == ["primary.test", "fallback.test", "primary.test"]


def test_both_models_rate_limited_returns_saved_result_message() -> None:
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        return httpx.Response(429)

    async def exercise() -> None:
        async with LLMClient(
            make_settings(),
            transport=httpx.MockTransport(handle),
            sleep=no_sleep,
        ) as client:
            with pytest.raises(LLMError) as caught:
                await client.generate("Return data.", StructuredResult, step="test")
        assert caught.value.code == "llm_rate_limited"
        assert (
            caught.value.public_message
            == "The AI service is busy, try again in a minute or view the saved result"
        )

    run(exercise())
    assert calls == ["primary.test", "fallback.test", "fallback.test"]


def test_primary_timeout_fails_over_to_fallback() -> None:
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        if request.url.host == "primary.test":
            raise httpx.ReadTimeout("fixture timeout", request=request)
        return compatible_chat_response('{"answer":"fallback"}')

    async def exercise() -> StructuredResult:
        async with LLMClient(
            make_settings(),
            transport=httpx.MockTransport(handle),
        ) as client:
            return await client.generate("Return data.", StructuredResult, step="test")

    assert run(exercise()).answer == "fallback"
    assert calls == ["primary.test", "fallback.test"]


def test_no_provider_configured_returns_explicit_error() -> None:
    async def exercise() -> None:
        async with LLMClient(
            make_settings(
                llm_base_url=None,
                llm_api_key=None,
                llm_model=None,
                llm_fallback_base_url=None,
                llm_fallback_api_key=None,
                llm_fallback_model=None,
            )
        ) as client:
            with pytest.raises(LLMError) as caught:
                await client.generate("Return data.", StructuredResult, step="test")
        assert caught.value.code == "llm_not_configured"

    run(exercise())


def test_fallback_model_must_be_distinct_from_primary() -> None:
    with pytest.raises(LLMError) as caught:
        LLMClient(make_settings(llm_fallback_model="fixture-primary-model"))

    assert caught.value.code == "llm_invalid_configuration"

"""FastAPI configuration, request-bound, and logging tests."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.analysis_models import AnalysisStreamEvent
from backend.app.logging_config import JsonFormatter
from backend.app.main import DailyAnalysisLimiter, create_app
from backend.app.settings import Settings


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "qloo_api_key": None,
        "llm_base_url": None,
        "llm_api_key": None,
        "llm_model": None,
        "llm_fallback_base_url": None,
        "llm_fallback_api_key": None,
        "llm_fallback_model": None,
        "max_request_bytes": 1_024,
    }
    values.update(overrides)
    return Settings.model_validate(values)


def test_health_endpoint_and_cors_configuration() -> None:
    settings = make_settings(cors_origins="https://vyuha.example,http://localhost:3000")
    with TestClient(create_app(settings)) as client:
        response = client.get(
            "/health",
            headers={"Origin": "https://vyuha.example"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vyuha"}
    assert response.headers["access-control-allow-origin"] == "https://vyuha.example"


def test_localhost_and_loopback_origins_are_allowed_by_default() -> None:
    with TestClient(create_app(make_settings())) as client:
        response = client.get("/health", headers={"Origin": "http://127.0.0.1:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


def test_oversized_request_body_is_rejected() -> None:
    with TestClient(create_app(make_settings())) as client:
        response = client.post("/health", content=b"x" * 1_025)

    assert response.status_code == 413
    assert response.json() == {"error": "request_too_large"}


def test_json_logging_redacts_sensitive_fields_and_secret_text() -> None:
    record = logging.LogRecord(
        "test",
        logging.INFO,
        __file__,
        1,
        "request failed with api_key=fixture-secret",
        (),
        None,
    )
    record.event = "test_event"
    record.api_key = "fixture-secret"
    output = JsonFormatter().format(record)
    parsed = json.loads(output)

    assert "fixture-secret" not in output
    assert parsed["event"] == "test_event"
    assert parsed["fields"]["api_key"] == "[REDACTED]"


def test_missing_qloo_configuration_keeps_health_available() -> None:
    with TestClient(create_app(make_settings(qloo_api_key=None))) as client:
        response = client.get("/health")

    assert response.status_code == 200


def test_analysis_limiter_enforces_per_ip_and_daily_limits() -> None:
    async def consume_requests() -> list[str | None]:
        limiter = DailyAnalysisLimiter(per_ip_limit=1, daily_limit=2)
        outcomes: list[str | None] = []
        for client_ip in ("first", "first", "second", "third"):
            limit, _ = await limiter.consume(client_ip)
            outcomes.append(limit)
        return outcomes

    assert asyncio.run(consume_requests()) == [None, "per_ip", None, "daily"]


def test_analyze_limit_returns_retryable_saved_run_guidance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class PipelineFixture:
        def __init__(self, *_: object) -> None:
            pass

        async def analyze_stream(self, _: object) -> AsyncIterator[AnalysisStreamEvent]:
            yield AnalysisStreamEvent(
                stage="analysis",
                status="complete",
                message="Fixture progress event.",
            )

    monkeypatch.setattr(main_module, "DiscoveryPipeline", PipelineFixture)
    request = {
        "brief": {
            "business_name": "Fixture Business",
            "identifying_info": "Synthetic test business",
            "city": "Portland",
            "collaboration_goal": "Host a small community pop-up",
            "budget_range": {"minimum": 0, "maximum": 100, "currency": "USD"},
        }
    }
    settings = make_settings(analysis_per_ip_daily_limit=1)
    with TestClient(create_app(settings)) as client:
        first = client.post("/analyze", json=request)
        limited = client.post("/analyze", json=request)

    assert first.status_code == 200
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0
    assert "saved run if one is available" in limited.json()["message"]


def test_discovery_endpoint_exposes_validated_request_contract() -> None:
    schema = create_app(make_settings()).openapi()

    assert "/discover" in schema["paths"]
    assert "post" in schema["paths"]["/discover"]


def test_analyze_endpoint_streams_stage_progress(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class PipelineFixture:
        def __init__(self, *_: object) -> None:
            pass

        async def analyze_stream(self, _: object) -> AsyncIterator[AnalysisStreamEvent]:
            for stage, status in (
                ("discovery_identity", "complete"),
                ("critic", "degraded"),
                ("decision", "complete"),
                ("experiment", "complete"),
                ("outreach", "complete"),
                ("analysis", "complete"),
            ):
                yield AnalysisStreamEvent(
                    stage=stage,  # type: ignore[arg-type]
                    status=status,  # type: ignore[arg-type]
                    message="Fixture progress event.",
                )

    monkeypatch.setattr(main_module, "DiscoveryPipeline", PipelineFixture)
    request = {
        "brief": {
            "business_name": "Fixture Business",
            "identifying_info": "Synthetic test business",
            "city": "Portland",
            "collaboration_goal": "Host a small community pop-up",
            "budget_range": {"minimum": 0, "maximum": 100, "currency": "USD"},
        }
    }
    with TestClient(create_app(make_settings())) as client:
        response = client.post("/analyze", json=request)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"stage":"critic","status":"degraded"' in response.text
    assert '"stage":"analysis","status":"complete"' in response.text

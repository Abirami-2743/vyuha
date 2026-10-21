"""FastAPI configuration, request-bound, and logging tests."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import backend.app.main as main_module
from backend.app.analysis_models import AnalysisStreamEvent, TraceStep
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
        root_response = client.get("/")
        response = client.get(
            "/health",
            headers={"Origin": "https://vyuha.example"},
        )

    assert root_response.status_code == 200
    assert root_response.json() == {"service": "vyuha-api", "status": "ok"}
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vyuha"}
    assert response.headers["access-control-allow-origin"] == "https://vyuha.example"


def test_saved_run_returns_validated_file_and_capture_date(tmp_path: Path) -> None:
    saved_run_path = tmp_path / "saved-run.json"
    saved_run_path.write_text(
        json.dumps(
            {
                "captured_at": "2026-10-17T12:00:00Z",
                "analysis": {
                    "discovery": {
                        "status": "empty",
                        "business_identity": {
                            "status": "unavailable",
                            "osm_status": "unavailable",
                        },
                    },
                    "overall_decision": {
                        "result": "no candidate supported",
                        "rationale": "No supported candidate.",
                    },
                    "critic_text_status": "rule_based_unavailable",
                },
            }
        ),
        encoding="utf-8",
    )
    settings = make_settings(vyuha_saved_run_path=saved_run_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/saved-run")

    assert response.status_code == 200
    assert response.json()["captured_at"] == "2026-10-17T12:00:00Z"
    assert response.json()["analysis"]["discovery"]["status"] == "empty"


def test_demo_saved_run_returns_validated_data_date_and_metadata(tmp_path: Path) -> None:
    saved_runs_dir = tmp_path / "saved-runs"
    saved_runs_dir.mkdir()
    (saved_runs_dir / "blue-bottle-san-francisco.json").write_text(
        json.dumps(
            {
                "captured_at": "2026-10-17T12:00:00Z",
                "analysis": {
                    "discovery": {
                        "status": "empty",
                        "business_identity": {
                            "status": "unavailable",
                            "osm_status": "unavailable",
                        },
                    },
                    "overall_decision": {
                        "result": "no candidate supported",
                        "rationale": "No supported candidate.",
                    },
                    "critic_text_status": "rule_based_unavailable",
                },
                "metadata": {
                    "demo_id": "blue-bottle-san-francisco",
                    "identity_selection_rule": "First returned choice by stable name and ID.",
                    "identity_selections": [],
                },
            }
        ),
        encoding="utf-8",
    )

    with TestClient(
        create_app(make_settings(vyuha_saved_runs_dir=saved_runs_dir))
    ) as client:
        response = client.get("/saved-run/blue-bottle-san-francisco")

    assert response.status_code == 200
    assert response.json()["captured_at"] == "2026-10-17T12:00:00Z"
    assert response.json()["analysis"]["discovery"]["status"] == "empty"
    assert response.json()["metadata"]["demo_id"] == "blue-bottle-san-francisco"


def test_demo_saved_run_returns_404_for_missing_file_and_disallowed_id(
    tmp_path: Path,
) -> None:
    saved_runs_dir = tmp_path / "saved-runs"
    saved_runs_dir.mkdir()
    with TestClient(
        create_app(make_settings(vyuha_saved_runs_dir=saved_runs_dir))
    ) as client:
        missing = client.get("/saved-run/nike-portland")
        disallowed = client.get("/saved-run/..%2F.env")

    assert missing.status_code == 404
    assert disallowed.status_code == 404


def test_demo_saved_run_does_not_consume_analysis_limiter(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    async def consume(self: DailyAnalysisLimiter, client_ip: str) -> tuple[str | None, int]:
        nonlocal calls
        calls += 1
        return None, 1

    monkeypatch.setattr(DailyAnalysisLimiter, "consume", consume)
    with TestClient(
        create_app(make_settings(vyuha_saved_runs_dir=tmp_path))
    ) as client:
        response = client.get("/saved-run/blue-bottle-san-francisco")

    assert response.status_code == 404
    assert calls == 0


def test_saved_run_is_not_found_when_unset_or_missing(tmp_path: Path) -> None:
    app_without_path = create_app(make_settings())
    app_with_missing_path = create_app(
        make_settings(vyuha_saved_run_path=tmp_path / "missing.json")
    )

    with TestClient(app_without_path) as client:
        unset_response = client.get("/saved-run")
    with TestClient(app_with_missing_path) as client:
        missing_response = client.get("/saved-run")

    assert unset_response.status_code == 404
    assert missing_response.status_code == 404


def test_localhost_and_loopback_origins_are_allowed_by_default() -> None:
    with TestClient(create_app(make_settings())) as client:
        response = client.get("/health", headers={"Origin": "http://127.0.0.1:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


def test_analysis_limits_have_judging_window_defaults() -> None:
    settings = make_settings()
    configured_limits = make_settings(analysis_per_ip_daily_limit=7, analysis_daily_limit=70)

    assert settings.analysis_per_ip_daily_limit == 100
    assert settings.analysis_daily_limit == 1_000
    assert configured_limits.analysis_per_ip_daily_limit == 7
    assert configured_limits.analysis_daily_limit == 70


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


def test_analyze_limit_uses_trusted_forwarded_ip_and_suggests_saved_run(
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
    proxied_app = ProxyHeadersMiddleware(
        create_app(settings),
        trusted_hosts="192.0.2.10",
    )
    with TestClient(proxied_app, client=("192.0.2.10", 12_345)) as client:
        first = client.post(
            "/analyze",
            json=request,
            headers={"X-Forwarded-For": "198.51.100.20, 203.0.113.7"},
        )
        limited = client.post(
            "/analyze",
            json=request,
            headers={"X-Forwarded-For": "198.51.100.99, 203.0.113.7"},
        )

    assert first.status_code == 200
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0
    assert "saved run if one is available" in limited.json()["message"]


def test_discovery_endpoint_exposes_validated_request_contract() -> None:
    schema = create_app(make_settings()).openapi()

    assert "/discover" in schema["paths"]
    assert "post" in schema["paths"]["/discover"]
    assert "get" in schema["paths"]["/saved-run"]
    assert "get" in schema["paths"]["/saved-run/{demo_id}"]


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
                    trace=(
                        [
                            TraceStep(
                                name="Qloo search",
                                duration_ms=1.2,
                                result_count=2,
                                http_statuses=[200],
                            )
                        ]
                        if stage == "analysis"
                        else None
                    ),
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
    assert (
        '"name":"Qloo search","duration_ms":1.2,"result_count":2,"http_statuses":[200]'
        in response.text
    )

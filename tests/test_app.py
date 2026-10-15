"""FastAPI configuration, request-bound, and logging tests."""

import json
import logging

from fastapi.testclient import TestClient

from backend.app.logging_config import JsonFormatter
from backend.app.main import create_app
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
        "cors_origins": "https://vyuha.example,http://localhost:3000",
    }
    values.update(overrides)
    return Settings.model_validate(values)


def test_health_endpoint_and_cors_configuration() -> None:
    with TestClient(create_app(make_settings())) as client:
        response = client.get(
            "/health",
            headers={"Origin": "https://vyuha.example"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vyuha"}
    assert response.headers["access-control-allow-origin"] == "https://vyuha.example"


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


def test_discovery_endpoint_exposes_validated_request_contract() -> None:
    schema = create_app(make_settings()).openapi()

    assert "/discover" in schema["paths"]
    assert "post" in schema["paths"]["/discover"]

"""Synthetic A-D pipeline tests; fixtures are not live integration evidence."""

import asyncio
import json
from collections.abc import Coroutine
from typing import Any, TypeVar

import httpx
from pydantic import SecretStr

from backend.app.discovery_models import DiscoveryRequest
from backend.app.llm import LLMClient
from backend.app.pipeline import DiscoveryPipeline
from backend.app.qloo import QlooClient
from backend.app.settings import Settings
from backend.app.verification import NominatimClient
from tests.fixtures.discovery_responses import (
    nominatim_payload,
    qloo_insights_payload,
    qloo_search_payload,
)

Result = TypeVar("Result")


def run(coro: Coroutine[Any, Any, Result]) -> Result:
    return asyncio.run(coro)


def make_settings() -> Settings:
    return Settings.model_validate(
        {
            "_env_file": None,
            "qloo_api_key": SecretStr("fixture-only-qloo-key"),
            "qloo_base_url": "https://hackathon.api.qloo.com",
            "qloo_max_retries": 0,
            "llm_base_url": "https://llm.fixture.test/v1",
            "llm_api_key": SecretStr("fixture-only-llm-key"),
            "llm_model": "fixture-model",
            "llm_fallback_base_url": None,
            "llm_fallback_api_key": None,
            "llm_fallback_model": None,
            "llm_max_retries": 0,
            "llm_invalid_output_retries": 0,
            "llm_min_request_interval_seconds": 0,
        }
    )


def brief(
    industry: str = "cosmetics", goal: str = "Host a small product pop-up"
) -> dict[str, Any]:
    return {
        "business_name": "Fixture Skin",
        "industry": industry,
        "identifying_info": "Synthetic fixture business",
        "city": "Springfield",
        "collaboration_goal": goal,
        "budget_range": {"minimum": 100, "maximum": 500, "currency": "USD"},
        "event_requirements": ["One-day event"],
        "constraints": ["No large venue rental"],
    }


def synthetic_response(request: httpx.Request) -> httpx.Response:
    if request.url.host == "hackathon.api.qloo.com":
        if request.url.path == "/search":
            return httpx.Response(200, json=qloo_search_payload())
        return httpx.Response(200, json=qloo_insights_payload())
    if request.url.host == "nominatim.openstreetmap.org":
        query = request.url.params["q"].split(",", maxsplit=1)[0]
        if query == "Fixture Skin":
            results = nominatim_payload(query, 1, "business")
        elif query == "Fixture Cafe":
            results = nominatim_payload(query, 2, "cafe")
        elif query == "Fixture Cosmetics":
            results = nominatim_payload(query, 3, "cosmetics")
        else:
            results = []
        return httpx.Response(200, json=results)
    if request.url.host == "llm.fixture.test":
        body = json.loads(request.content)
        prompt = body["messages"][1]["content"]
        start = prompt.index("INPUT_JSON:\n") + len("INPUT_JSON:\n")
        supplied, _ = json.JSONDecoder().raw_decode(prompt[start:])
        candidates = supplied["candidate_evidence"]
        response = {
            "candidates": [
                {
                    "entity_id": item["entity_id"],
                    "complementarity_hypothesis": (
                        f"Possible event context based on the listed {item['name']} record."
                    ),
                    "goal_alignment": "possible",
                    "evidence_references": item["evidence_references"],
                    "uncertainties": ["No event availability evidence."],
                }
                for item in candidates
            ]
        }
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(response)}}]},
        )
    raise AssertionError(f"Unexpected fixture host: {request.url.host}")


async def run_pipeline(
    request_body: dict[str, Any],
    *,
    nominatim_override: Any = None,
) -> Any:
    settings = make_settings()
    qloo = QlooClient(settings, transport=httpx.MockTransport(synthetic_response))
    verifier = NominatimClient(
        transport=nominatim_override or httpx.MockTransport(synthetic_response),
        sleep=no_sleep,
    )
    llm = LLMClient(
        settings, transport=httpx.MockTransport(synthetic_response), sleep=no_sleep
    )
    try:
        pipeline = DiscoveryPipeline(qloo, verifier, llm)
        return await pipeline.run(DiscoveryRequest.model_validate(request_body))
    finally:
        await qloo.aclose()
        await verifier.aclose()
        await llm.aclose()


async def no_sleep(_: float) -> None:
    return None


def test_ambiguous_business_identity_returns_options_without_discovery() -> None:
    qloo_requests: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nominatim.openstreetmap.org":
            payload = nominatim_payload(
                "Fixture Skin", 10, "business"
            ) + nominatim_payload("Fixture Skin", 11, "business")
            return httpx.Response(200, json=payload)
        qloo_requests.append(request.url.path)
        return synthetic_response(request)

    async def exercise() -> Any:
        settings = make_settings()
        qloo = QlooClient(settings, transport=httpx.MockTransport(handle))
        verifier = NominatimClient(
            transport=httpx.MockTransport(handle), sleep=no_sleep
        )
        llm = LLMClient(settings, transport=httpx.MockTransport(handle), sleep=no_sleep)
        try:
            return await DiscoveryPipeline(qloo, verifier, llm).run(
                DiscoveryRequest.model_validate({"brief": brief()})
            )
        finally:
            await qloo.aclose()
            await verifier.aclose()
            await llm.aclose()

    result = run(exercise())
    assert result.status == "needs_user_choice"
    assert result.business_identity.osm_status == "ambiguous"
    assert [place.osm_id for place in result.business_identity.osm_options] == [10, 11]
    assert qloo_requests == []


def test_explicit_osm_choice_resolves_business_identity_and_continues() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nominatim.openstreetmap.org":
            query = request.url.params["q"].split(",", maxsplit=1)[0]
            if query == "Fixture Skin":
                payload = nominatim_payload(query, 10, "business") + nominatim_payload(
                    query, 11, "business"
                )
                return httpx.Response(200, json=payload)
        return synthetic_response(request)

    async def exercise() -> Any:
        settings = make_settings()
        qloo = QlooClient(settings, transport=httpx.MockTransport(handle))
        verifier = NominatimClient(
            transport=httpx.MockTransport(handle), sleep=no_sleep
        )
        llm = LLMClient(settings, transport=httpx.MockTransport(handle), sleep=no_sleep)
        try:
            return await DiscoveryPipeline(qloo, verifier, llm).run(
                DiscoveryRequest.model_validate(
                    {
                        "brief": brief(),
                        "selected_osm_type": "node",
                        "selected_osm_id": 10,
                    }
                )
            )
        finally:
            await qloo.aclose()
            await verifier.aclose()
            await llm.aclose()

    result = run(exercise())
    assert result.business_identity.osm_status == "verified"
    assert result.business_identity.selected_osm_place.osm_id == 10
    assert result.candidate_checks


def test_non_exact_qloo_search_result_is_not_offered_as_business_identity() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(
                200, json=nominatim_payload("Fixture Skin", 10, "business")
            )
        if (
            request.url.host == "hackathon.api.qloo.com"
            and request.url.path == "/search"
        ):
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "entity_id": "fixture-unrelated-id",
                            "name": "Unrelated Brand",
                            "types": ["urn:entity:brand"],
                            "properties": {},
                        }
                    ]
                },
            )
        return synthetic_response(request)

    async def exercise() -> Any:
        settings = make_settings()
        qloo = QlooClient(settings, transport=httpx.MockTransport(handle))
        verifier = NominatimClient(
            transport=httpx.MockTransport(handle), sleep=no_sleep
        )
        llm = LLMClient(settings, transport=httpx.MockTransport(handle), sleep=no_sleep)
        try:
            return await DiscoveryPipeline(qloo, verifier, llm).run(
                DiscoveryRequest.model_validate(
                    {
                        "brief": brief(),
                        "selected_osm_type": "node",
                        "selected_osm_id": 10,
                    }
                )
            )
        finally:
            await qloo.aclose()
            await verifier.aclose()
            await llm.aclose()

    result = run(exercise())
    assert result.status == "partial"
    assert result.business_identity.qloo_status == "not_found"
    assert result.business_identity.qloo_options == []
    assert result.candidate_checks == []
    assert "none matched 'Fixture Skin' exactly" in result.limitations[0]


def test_pipeline_filters_competitors_scores_and_preserves_provenance() -> None:
    result = run(run_pipeline({"brief": brief()}))

    assert result.status == "partial"
    assert [item.candidate.name for item in result.unexpected_candidates] == [
        "Fixture Cafe"
    ]
    assert result.conventional_baseline.candidate.name == "Fixture Cosmetics"
    assert all(
        item.candidate.name not in {"Fixture Skin", "Fixture Zero", "Fixture Unknown"}
        for item in result.unexpected_candidates + [result.conventional_baseline]
    )
    cafe = result.unexpected_candidates[0]
    baseline = result.conventional_baseline
    assert baseline is not None
    assert cafe.competition.assessment == "unknown"
    assert baseline.competition.assessment == "concern"
    assert "not a customer-overlap percentage" in cafe.taste_affinity.rationale
    assert any(item.source_type == "qloo" for item in cafe.evidence_relevance.evidence)
    assert any(
        item.source_type == "external"
        for item in cafe.geographic_logistical_suitability.evidence
    )
    assert any(
        item.source_type == "ai_interpretation"
        for item in cafe.complementarity.evidence
    )
    assert "not independently proven" in cafe.goal_alignment.rationale
    assert baseline.budget_compatibility.assessment == "unknown"


def test_different_brief_industry_changes_baseline_and_unexpected_roles() -> None:
    cosmetics = run(run_pipeline({"brief": brief(industry="cosmetics")}))
    cafe_industry = run(run_pipeline({"brief": brief(industry="cafe")}))

    assert cosmetics.conventional_baseline.candidate.name == "Fixture Cosmetics"
    assert [item.candidate.name for item in cosmetics.unexpected_candidates] == [
        "Fixture Cafe"
    ]
    assert cafe_industry.conventional_baseline.candidate.name == "Fixture Cafe"
    assert [item.candidate.name for item in cafe_industry.unexpected_candidates] == [
        "Fixture Cosmetics"
    ]


def test_partial_candidate_verification_failure_is_not_hidden() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.params["q"].startswith("Fixture Cafe"):
            raise httpx.ConnectError("fixture network failure", request=request)
        return synthetic_response(request)

    result = run(
        run_pipeline(
            {"brief": brief()},
            nominatim_override=httpx.MockTransport(handle),
        )
    )

    assert result.status == "partial"
    assert any(item.status == "unavailable" for item in result.candidate_checks)
    assert any("Could not independently verify" in item for item in result.limitations)


def test_empty_qloo_response_produces_honest_empty_state() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if (
            request.url.host == "hackathon.api.qloo.com"
            and request.url.path == "/v2/insights"
        ):
            return httpx.Response(200, json={"results": {"entities": []}})
        return synthetic_response(request)

    async def exercise() -> Any:
        settings = make_settings()
        qloo = QlooClient(settings, transport=httpx.MockTransport(handle))
        verifier = NominatimClient(
            transport=httpx.MockTransport(handle), sleep=no_sleep
        )
        llm = LLMClient(settings, transport=httpx.MockTransport(handle), sleep=no_sleep)
        try:
            return await DiscoveryPipeline(qloo, verifier, llm).run(
                DiscoveryRequest.model_validate({"brief": brief()})
            )
        finally:
            await qloo.aclose()
            await verifier.aclose()
            await llm.aclose()

    result = run(exercise())
    assert result.status == "empty"
    assert result.unexpected_candidates == []
    assert result.conventional_baseline is None
    assert any("returned no place entities" in item for item in result.limitations)

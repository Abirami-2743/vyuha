"""Synthetic A-D pipeline tests; fixtures are not live integration evidence."""

import asyncio
import json
from collections.abc import Coroutine, Mapping
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
    qloo_search_override: Mapping[str, object] | None = None,
    qloo_search_overrides: Mapping[str, Mapping[str, object]] | None = None,
    qloo_insights_override: Mapping[str, object] | None = None,
) -> Any:
    settings = make_settings()

    def qloo_response(request: httpx.Request) -> httpx.Response:
        if request.url.host == "hackathon.api.qloo.com":
            if request.url.path == "/search":
                per_query = (qloo_search_overrides or {}).get(
                    request.url.params["query"]
                )
                if per_query is not None:
                    return httpx.Response(200, json=per_query)
                if qloo_search_override is not None:
                    return httpx.Response(200, json=qloo_search_override)
            elif (
                request.url.path == "/v2/insights"
                and qloo_insights_override is not None
            ):
                return httpx.Response(200, json=qloo_insights_override)
        return synthetic_response(request)

    qloo = QlooClient(settings, transport=httpx.MockTransport(qloo_response))
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


def test_blue_bottle_seed_identity_does_not_surface_ferry_building_as_partner() -> None:
    seed_id = "blue-bottle-qloo-id"
    qloo_search = {
        "results": [
            {
                "entity_id": seed_id,
                "name": "Blue Bottle Coffee",
                "types": ["urn:entity:brand"],
                "properties": {},
            }
        ]
    }
    qloo_insights = {
        "results": {
            "entities": [
                {
                    "entity_id": seed_id,
                    "name": "Ferry Building",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.9},
                    "properties": {},
                },
                {
                    "entity_id": "ferry-building-place-id",
                    "name": "Ferry Building",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.8},
                    "properties": {},
                },
                {
                    "entity_id": "selected-osm-alias-id",
                    "name": "Selected Venue Alias",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.7},
                    "properties": {},
                },
                {
                    "entity_id": "blue-bottle-brand-duplicate-id",
                    "name": "Blue Bottle Coffee",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.6},
                    "properties": {},
                },
                {
                    "entity_id": "ferry-building-business-id",
                    "name": "Gott's SF Ferry Building",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.5},
                    "properties": {},
                },
            ]
        }
    }

    def place(name: str, osm_id: int) -> dict[str, object]:
        return {
            "osm_type": "node",
            "osm_id": osm_id,
            "name": name,
            "display_name": (
                f"{name}, 1, Ferry Building, San Francisco, California, 94111, United States"
            ),
            "category": "amenity",
            "type": "cafe",
            "lat": "37.7955",
            "lon": "-122.3937",
            "address": {"city": "San Francisco", "state": "California", "country": "USA"},
        }

    def nominatim_response(request: httpx.Request) -> httpx.Response:
        query = request.url.params["q"]
        if query == "Blue Bottle Coffee, San Francisco":
            return httpx.Response(200, json=[place("Blue Bottle Coffee", 10)])
        if query == "Ferry Building, San Francisco":
            return httpx.Response(200, json=[place("Ferry Building", 11)])
        if query == "Selected Venue Alias, San Francisco":
            return httpx.Response(200, json=[place("Selected Venue Alias", 10)])
        if query == "Gott's SF Ferry Building, San Francisco":
            return httpx.Response(200, json=[place("Gott's SF Ferry Building", 12)])
        if query == "cafes in San Francisco":
            neighborhood_cafe = place("Neighborhood Cafe", 20)
            neighborhood_cafe["display_name"] = (
                "Neighborhood Cafe, San Francisco, California, United States"
            )
            neighborhood_cafe["address"] = {
                "city": "San Francisco",
                "state": "California",
                "country": "USA",
            }
            own_business = place("Blue Bottle Coffee", 21)
            own_business["display_name"] = (
                "Blue Bottle Coffee, San Francisco, California, United States"
            )
            own_business["address"] = {
                "city": "San Francisco",
                "state": "California",
                "country": "USA",
            }
            return httpx.Response(
                200,
                json=[
                    place("Ferry Building", 10),
                    own_business,
                    neighborhood_cafe,
                ],
            )
        return httpx.Response(200, json=[])

    result = run(
        run_pipeline(
            {
                "brief": {
                    **brief(industry="cafe"),
                    "business_name": "Blue Bottle Coffee",
                    "city": "San Francisco",
                    "identifying_info": "Blue Bottle Coffee in San Francisco",
                },
            },
            nominatim_override=httpx.MockTransport(nominatim_response),
            qloo_search_override=qloo_search,
            qloo_insights_override=qloo_insights,
        )
    )

    assert result.business_identity.selected_osm_place.name == "Blue Bottle Coffee"
    assert all(item.candidate.name != "Ferry Building" for item in result.candidate_checks)
    assert all(
        "Ferry Building" not in item.candidate.name for item in result.candidate_checks
    )
    assert result.conventional_baseline is not None
    assert result.conventional_baseline.candidate.name == "Neighborhood Cafe"
    assert result.conventional_baseline.identity_verification.status == "verified"
    assert result.conventional_baseline.identity_verification.location_relevance == (
        "osm_category_verified"
    )
    assert all(item.candidate.name != "Blue Bottle Coffee" for item in result.candidate_checks)
    assert all(
        "Ferry Building" not in item.candidate.name
        for item in [
            *result.unexpected_candidates,
            *result.other_conventional_candidates,
            *result.unclassified_candidates,
            *result.out_of_market_candidates,
        ]
    )


def test_non_exact_qloo_matches_require_choice_and_filter_excluded_types() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(
                200, json=nominatim_payload("Fixture Skin", 10, "business")
            )
        if request.url.path == "/search":
            assert request.url.params["query"] == "Fixture Skin"
            assert request.url.params["types"] == "urn:entity:brand"
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "entity_id": "fixture-near-brand-id",
                            "name": "Fixture Skin Studio",
                            "types": ["urn:entity:brand"],
                            "properties": {},
                        },
                        {
                            "entity_id": "fixture-other-brand-id",
                            "name": "Fixture Skincare",
                            "types": ["urn:entity:brand"],
                            "properties": {},
                        },
                        {
                            "entity_id": "fixture-unrelated-type-id",
                            "name": "Fixture Skin Place",
                            "types": ["urn:entity:place"],
                            "properties": {},
                        },
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
    assert result.status == "needs_user_choice"
    assert result.business_identity.qloo_status == "ambiguous"
    assert [item.entity_id for item in result.business_identity.qloo_options] == [
        "fixture-near-brand-id",
        "fixture-other-brand-id",
    ]
    assert all(
        item.identity_match_label == "not an exact match"
        for item in result.business_identity.qloo_options
    )
    assert result.candidate_checks == []


def test_explicit_near_match_selection_continues_with_identity_caveat() -> None:
    search_payload = {
        "results": [
            {
                "entity_id": "fixture-near-brand-id",
                "name": "Fixture Skin Studio",
                "types": ["urn:entity:brand"],
                "properties": {},
            }
        ]
    }
    result = run(
        run_pipeline(
            {
                "brief": brief(),
                "selected_osm_type": "node",
                "selected_osm_id": 1,
                "selected_qloo_entity_id": "fixture-near-brand-id",
            },
            qloo_search_override=search_payload,
        )
    )
    assert result.business_identity.status == "partially_verified"
    assert result.business_identity.qloo_status == "resolved"
    assert result.business_identity.selected_qloo_entity.identity_match_label == (
        "not an exact match"
    )
    assert any(
        "not an exact name match" in item
        for item in result.business_identity.limitations
    )
    assert result.candidate_checks


def test_unverified_qloo_candidates_remain_in_comparisons_without_baseline() -> None:
    def no_candidate_listings(request: httpx.Request) -> httpx.Response:
        if request.url.params["q"].startswith(("Fixture Cafe", "Fixture Cosmetics")):
            return httpx.Response(200, json=[])
        return synthetic_response(request)

    result = run(
        run_pipeline(
            {"brief": brief()},
            nominatim_override=httpx.MockTransport(no_candidate_listings),
        )
    )

    assert result.status == "partial"
    assert [check.candidate.name for check in result.candidate_checks] == [
        "Fixture Cafe",
        "Fixture Cosmetics",
    ]
    assert all(check.status == "unverified" for check in result.candidate_checks)
    assert all(
        check.verification_message == "unverified: no matching OSM listing found"
        for check in result.candidate_checks
    )
    assert [item.candidate.name for item in result.unexpected_candidates] == [
        "Fixture Cafe",
        "Fixture Cosmetics",
    ]
    assert all(
        any(evidence.source_type == "qloo" for evidence in item.candidate.evidence)
        for item in result.unexpected_candidates
    )
    assert result.conventional_baseline is None
    assert result.baseline_limitation is not None
    assert "No conventional baseline was found" in result.baseline_limitation


def test_location_filter_and_qloo_city_are_not_treated_as_city_boundary() -> None:
    insights = {
        "results": {
            "entities": [
                {
                    "entity_id": "fixture-cafe-id",
                    "name": "Fixture Cafe",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.61},
                    "properties": {"geocode": {"city": "Springfield"}},
                },
                {
                    "entity_id": "fixture-cosmetics-id",
                    "name": "Fixture Cosmetics",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.42},
                    "properties": {"geocode": {"city": "Boston"}},
                },
            ]
        }
    }

    def no_candidate_listings(request: httpx.Request) -> httpx.Response:
        query = request.url.params["q"].split(",", maxsplit=1)[0]
        if query in {"Fixture Cafe", "Fixture Cosmetics"}:
            return httpx.Response(200, json=[])
        return synthetic_response(request)

    seen_location: list[str] = []

    async def exercise() -> Any:
        settings = make_settings()

        def qloo_response(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/v2/insights":
                seen_location.append(request.url.params["filter.location"])
                assert request.url.params["filter.location.radius"] == "100"
                assert request.url.params["take"] == "20"
                return httpx.Response(200, json=insights)
            return synthetic_response(request)

        qloo = QlooClient(settings, transport=httpx.MockTransport(qloo_response))
        verifier = NominatimClient(
            transport=httpx.MockTransport(no_candidate_listings), sleep=no_sleep
        )
        llm = LLMClient(
            settings, transport=httpx.MockTransport(synthetic_response), sleep=no_sleep
        )
        try:
            return await DiscoveryPipeline(qloo, verifier, llm).run(
                DiscoveryRequest.model_validate({"brief": brief()})
            )
        finally:
            await qloo.aclose()
            await verifier.aclose()
            await llm.aclose()

    result = run(exercise())
    assert seen_location == ["POINT(-72.5000000 42.1000000)"]
    checks = {check.candidate.name: check for check in result.candidate_checks}
    assert checks["Fixture Cafe"].location_relevance == "qloo_same_city_unverified"
    assert checks["Fixture Cosmetics"].location_relevance == "out_of_market"
    assert all(check.status == "unverified" for check in checks.values())


def test_seed_discovery_uses_user_supplied_brands_and_keeps_affinities_separate() -> (
    None
):
    empty_search: dict[str, object] = {"results": []}
    seed_searches = {
        "Fixture Skin": empty_search,
        "Seed Alpha": qloo_search_payload("Seed Alpha"),
        "Seed Beta": qloo_search_payload("Seed Beta"),
    }
    result = run(
        run_pipeline(
            {
                "brief": brief(),
                "seed_brands": [
                    {"name": "Seed Alpha"},
                    {"name": "Seed Beta"},
                ],
            },
            qloo_search_overrides=seed_searches,
        )
    )

    assert result.business_identity.qloo_status == "not_found"
    assert result.business_identity.discovery_basis == "user_supplied_seeds"
    assert [item.status for item in result.business_identity.seed_resolutions] == [
        "resolved",
        "resolved",
    ]
    cafe = next(
        check.candidate
        for check in result.candidate_checks
        if check.candidate.entity_id == "fixture-cafe-id"
    )
    assert cafe.discovery_basis == "user_supplied_seeds"
    assert set(cafe.source_seed_names) == {"Seed Alpha", "Seed Beta"}
    assert cafe.affinity_score is None
    assert {item.seed_name for item in cafe.seed_affinities} == {
        "Seed Alpha",
        "Seed Beta",
    }
    assert all(
        "not from the user's own brand" in evidence.claim for evidence in cafe.evidence
    )


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


def test_osm_category_search_adds_up_to_three_explicit_non_qloo_baselines() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nominatim.openstreetmap.org":
            query = request.url.params["q"]
            if query == "cosmetics shops in Springfield":
                outside_city = nominatim_payload("Outside Cosmetics", 24, "cosmetics")[
                    0
                ]
                outside_city["address"] = {"city": "Northampton"}
                return httpx.Response(
                    200,
                    json=[
                        *nominatim_payload("Local Cosmetics 1", 20, "cosmetics"),
                        *nominatim_payload("Local Cosmetics 2", 21, "cosmetics"),
                        *nominatim_payload("Local Cosmetics 3", 22, "cosmetics"),
                        *nominatim_payload("Local Cosmetics 4", 23, "cosmetics"),
                        outside_city,
                    ],
                )
            if query.startswith("Fixture Cosmetics,"):
                return httpx.Response(200, json=[])
        return synthetic_response(request)

    result = run(
        run_pipeline(
            {"brief": brief()},
            nominatim_override=httpx.MockTransport(handle),
        )
    )

    assert result.conventional_baseline is not None
    baseline = result.conventional_baseline
    assert baseline.candidate.name == "Local Cosmetics 1"
    assert baseline.candidate.discovery_basis == "osm_category_baseline"
    assert baseline.identity_verification.status == "verified"
    assert baseline.identity_verification.location_relevance == "osm_category_verified"
    assert any(
        item.source_type == "external" and "OpenStreetMap lists" in item.claim
        for item in baseline.identity_verification.evidence
    )
    assert "No Qloo taste query was run" in baseline.taste_affinity.rationale
    assert "not a like-for-like" in baseline.taste_affinity.rationale
    assert all(
        item.candidate.discovery_basis == "osm_category_baseline"
        for item in result.other_conventional_candidates
    )
    assert [item.candidate.name for item in result.other_conventional_candidates] == [
        "Local Cosmetics 2",
        "Local Cosmetics 3",
    ]
    assert len(result.candidate_checks) == 5


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

"""Capture private, dated outputs from the real Vyuha pipeline."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from backend.app.analysis_models import AnalysisResult
from backend.app.discovery_models import DiscoveryRequest
from backend.app.llm import LLMClient
from backend.app.logging_config import configure_logging
from backend.app.pipeline import DiscoveryPipeline
from backend.app.qloo import QlooClient
from backend.app.settings import REPOSITORY_ROOT, Settings, get_settings
from backend.app.verification import NominatimClient

logger = logging.getLogger("vyuha.capture")
DEMO_DEFINITIONS_PATH = REPOSITORY_ROOT / "frontend" / "lib" / "demo-definitions.json"
OUTPUT_DIRECTORY = REPOSITORY_ROOT / ".vyuha-private" / "demo-runs"
DEMO_IDS = frozenset(
    {
        "blue-bottle-san-francisco",
        "the-ordinary-new-york",
        "starbucks-chennai",
        "nike-portland",
        "qvxxqz-blorpblorp-boise",
    }
)
IDENTITY_SELECTION_RULE = (
    "When the live pipeline requests a choice, select the lexicographically first returned "
    "option by case-folded display name, then stable provider identifier (OSM type/id or Qloo "
    "entity ID). For seed choices, apply the same rule independently to each returned option "
    "list, sorted by case-folded seed query. Never choose an option the pipeline did not return."
)


def _demo_request(definition: dict[str, Any]) -> DiscoveryRequest:
    values = definition["input"]
    return DiscoveryRequest.model_validate(
        {
            "brief": {
                "business_name": values["business_name"],
                "industry": values.get("industry") or None,
                "city": values.get("city") or None,
                "target_market": values.get("target_market") or None,
                "website": values.get("website") or None,
                "identifying_info": values.get("identifying_info") or None,
                "collaboration_goal": values["collaboration_goal"],
                "budget_range": {
                    "minimum": float(values["budget_min"]),
                    "maximum": float(values["budget_max"]),
                    "currency": "USD",
                },
                "event_requirements": values.get("event_requirements", []),
                "constraints": values.get("constraints", []),
            },
            "seed_brands": [{"name": name} for name in values.get("seed_brands", [])],
        }
    )


def _select_identities(
    analysis: AnalysisResult,
    request: DiscoveryRequest,
) -> tuple[DiscoveryRequest, list[dict[str, str]]]:
    identity = analysis.discovery.business_identity
    selections: list[dict[str, str]] = []
    update: dict[str, Any] = {}
    if identity.osm_status in {"ambiguous", "selection_invalid"} and identity.osm_options:
        selected = min(
            identity.osm_options,
            key=lambda item: (item.name.casefold(), item.osm_type, item.osm_id),
        )
        update["selected_osm_type"] = selected.osm_type
        update["selected_osm_id"] = selected.osm_id
        selections.append(
            {
                "kind": "osm",
                "selected_name": selected.name,
                "selected_identifier": f"{selected.osm_type}/{selected.osm_id}",
            }
        )
    if identity.qloo_status in {"ambiguous", "selection_invalid"} and identity.qloo_options:
        selected_qloo = min(
            identity.qloo_options,
            key=lambda item: (item.name.casefold(), item.entity_id),
        )
        update["selected_qloo_entity_id"] = selected_qloo.entity_id
        selections.append(
            {
                "kind": "qloo",
                "selected_name": selected_qloo.name,
                "selected_identifier": selected_qloo.entity_id,
            }
        )

    seeds = list(request.seed_brands)
    for resolution in sorted(identity.seed_resolutions, key=lambda item: item.query.casefold()):
        if resolution.status != "needs_user_choice" or not resolution.options:
            continue
        selected_seed = min(
            resolution.options,
            key=lambda item: (item.name.casefold(), item.entity_id),
        )
        seeds = [
            seed.model_copy(update={"selected_entity_id": selected_seed.entity_id})
            if seed.name == resolution.query
            else seed
            for seed in seeds
        ]
        selections.append(
            {
                "kind": "seed",
                "selected_name": selected_seed.name,
                "selected_identifier": selected_seed.entity_id,
            }
        )
    update["seed_brands"] = seeds
    return request.model_copy(update=update), selections


async def _capture() -> None:
    settings: Settings = get_settings()
    if settings.qloo_api_key is None or not settings.qloo_api_key.get_secret_value().strip():
        raise RuntimeError("QLOO_API_KEY is required to capture live demo runs.")
    if settings.llm_base_url is None and settings.llm_fallback_base_url is None:
        raise RuntimeError("Configure an LLM provider in .env to capture live demo runs.")

    definitions = json.loads(DEMO_DEFINITIONS_PATH.read_text(encoding="utf-8"))
    if (
        not isinstance(definitions, list)
        or any(not isinstance(item, dict) for item in definitions)
        or {item.get("id") for item in definitions} != DEMO_IDS
    ):
        raise ValueError("The frontend demo definitions must contain the five allowlisted IDs.")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    configure_logging(settings.log_level)

    qloo_client = QlooClient(settings)
    nominatim_client = NominatimClient()
    llm_client = LLMClient(settings)
    pipeline = DiscoveryPipeline(qloo_client, nominatim_client, llm_client)
    try:
        for definition in definitions:
            request = _demo_request(definition)
            identity_selections: list[dict[str, str]] = []
            result: AnalysisResult | None = None
            for _ in range(4):
                async for event in pipeline.analyze_stream(request):
                    if event.stage == "analysis" and event.status == "complete":
                        result = event.result
                if result is None:
                    raise RuntimeError(
                        f"Pipeline returned no complete result for {definition['id']}."
                    )
                if result.discovery.status != "needs_user_choice":
                    break
                next_request, selections = _select_identities(result, request)
                if not selections:
                    break
                identity_selections.extend(selections)
                request = next_request
                result = None
            if result is None:
                raise RuntimeError(f"Pipeline did not complete for {definition['id']}.")
            if result.discovery.status == "needs_user_choice":
                raise RuntimeError(
                    f"Identity choices remain unresolved for {definition['id']}; "
                    "no saved result was written."
                )

            payload = {
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "analysis": result.model_dump(mode="json"),
                "metadata": {
                    "demo_id": definition["id"],
                    "identity_selection_rule": IDENTITY_SELECTION_RULE,
                    "identity_selections": identity_selections,
                },
            }
            destination = OUTPUT_DIRECTORY / f"{definition['id']}.json"
            temporary = destination.with_suffix(".json.tmp")
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            temporary.replace(destination)
            print(f"Captured {definition['id']}: {payload['captured_at']}")
    finally:
        await nominatim_client.aclose()
        await qloo_client.aclose()
        await llm_client.aclose()


def main() -> None:
    try:
        asyncio.run(_capture())
    except Exception:
        logger.exception("demo_capture_failed", extra={"event": "demo_capture_failed"})
        raise


if __name__ == "__main__":
    main()

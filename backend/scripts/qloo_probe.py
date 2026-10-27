"""Private, read-only OSM/Qloo probe. Never called from the production pipeline."""

from __future__ import annotations

import argparse
import asyncio

from backend.app.errors import QlooError, VerificationError
from backend.app.qloo import QlooClient
from backend.app.settings import Settings
from backend.app.verification import NominatimClient, normalize_brand_name

SEARCH_TYPE = "urn:entity:brand"
OUTPUT_TYPE = "urn:entity:place"


async def probe(name: str, city: str, settings: Settings) -> tuple[str, str, str, str, bool]:
    osm_status = "unavailable"
    location = None
    infrastructure_failed = False

    async with NominatimClient() as verifier:
        try:
            places = await verifier.search(name, city)
            exact = verifier.exact_name_matches(name, places)
            local = verifier.local_matches(city, exact)
            if len(local) == 1:
                osm_status = "verified"
                place = local[0]
                if place.lat is not None and place.lon is not None:
                    location = (float(place.lat), float(place.lon))
            elif len(local) > 1:
                osm_status = "ambiguous"
            elif exact:
                osm_status = "outside requested market"
            else:
                osm_status = "not found"
        except (VerificationError, ValueError):
            infrastructure_failed = True

    entity_label = "none"
    insights_count = "not run"
    positive_count = "not run"
    if settings.qloo_api_key is None or not settings.qloo_api_key.get_secret_value().strip():
        infrastructure_failed = True
    else:
        try:
            async with QlooClient(settings) as qloo:
                entities = await qloo.search_entities(name, SEARCH_TYPE)
                exact_entities = [
                    entity
                    for entity in entities
                    if normalize_brand_name(entity.name) == normalize_brand_name(name)
                    and (not entity.entity_types or SEARCH_TYPE in entity.entity_types)
                ]
                if exact_entities:
                    entity = exact_entities[0]
                    entity_type = (
                        SEARCH_TYPE
                        if SEARCH_TYPE in entity.entity_types
                        else entity.entity_type
                    )
                    entity_label = f"{entity.name} ({entity_type})"
                    candidates = await qloo.get_cross_category_candidates(
                        entity,
                        OUTPUT_TYPE,
                        location=location,
                    )
                    insights_count = str(len(candidates))
                    positive_count = str(
                        sum(
                            candidate.affinity_score is not None
                            and candidate.affinity_score > 0
                            for candidate in candidates
                        )
                    )
        except QlooError:
            infrastructure_failed = True

    return osm_status, entity_label, insights_count, positive_count, infrastructure_failed


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="Business or brand name")
    parser.add_argument("--city", required=True, help="City or target market")
    args = parser.parse_args()
    settings = Settings()
    result = await probe(args.name, args.city, settings)
    print(
        "Business | City | OSM match status | Qloo entity (type) | "
        "Insights entities | Positive affinity"
    )
    print(
        f"{args.name} | {args.city} | {result[0]} | {result[1]} | "
        f"{result[2]} | {result[3]}"
    )
    return 1 if result[4] else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

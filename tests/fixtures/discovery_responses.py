"""Synthetic discovery fixtures only; never used by the production pipeline."""


def qloo_search_payload(name: str = "Fixture Skin") -> dict[str, object]:
    return {
        "results": [
            {
                "entity_id": "fixture-seed-id",
                "name": name,
                "types": ["urn:entity:brand"],
                "properties": {"description": "Synthetic test fixture."},
            }
        ]
    }


def qloo_insights_payload() -> dict[str, object]:
    return {
        "results": {
            "entities": [
                {
                    "entity_id": "fixture-cafe-id",
                    "name": "Fixture Cafe",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.61},
                    "properties": {},
                },
                {
                    "entity_id": "fixture-cosmetics-id",
                    "name": "Fixture Cosmetics",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.42},
                    "properties": {},
                },
                {
                    "entity_id": "fixture-seed-id",
                    "name": "Fixture Skin",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0.95},
                    "properties": {},
                },
                {
                    "entity_id": "fixture-zero-id",
                    "name": "Fixture Zero",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "query": {"affinity": 0},
                    "properties": {},
                },
                {
                    "entity_id": "fixture-unknown-id",
                    "name": "Fixture Unknown",
                    "type": "urn:entity",
                    "subtype": "urn:entity:place",
                    "properties": {},
                },
            ]
        }
    }


def nominatim_payload(name: str, osm_id: int, kind: str) -> list[dict[str, object]]:
    if kind == "business":
        category, place_type = "shop", "cosmetics"
    elif kind == "cafe":
        category, place_type = "amenity", "cafe"
    else:
        category, place_type = "shop", "cosmetics"
    return [
        {
            "osm_type": "node",
            "osm_id": osm_id,
            "name": name,
            "display_name": f"{name}, Springfield, Test County",
            "category": category,
            "type": place_type,
            "lat": "42.1",
            "lon": "-72.5",
            "address": {"city": "Springfield", "country": "Testland"},
        }
    ]

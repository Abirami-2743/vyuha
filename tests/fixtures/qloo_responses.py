"""TEST-ONLY Qloo response fixtures; not evidence of live API behavior."""

SEARCH_RESPONSE = {
    "results": [
        {
            "entity_id": "test-brand-id",
            "name": "Fixture Brand",
            "types": ["urn:entity:brand"],
            "properties": {"description": "Test fixture only."},
        }
    ]
}

INSIGHTS_RESPONSE = {
    "success": True,
    "results": {
        "entities": [
            {
                "entity_id": "test-place-id",
                "name": "Fixture Place",
                "type": "urn:entity",
                "subtype": "urn:entity:place",
                "query": {"affinity": 0.42, "measurements": {}},
                "properties": {},
            }
        ]
    },
}

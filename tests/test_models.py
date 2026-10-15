"""Unit tests for validated API schemas."""

import pytest
from pydantic import ValidationError

from backend.app.models import BusinessBrief


def test_business_brief_accepts_identified_business_and_market() -> None:
    brief = BusinessBrief.model_validate(
        {
            "business_name": "Small Batch Skin",
            "website": "https://example.test",
            "target_market": "Downtown Austin",
            "collaboration_goal": "Plan an affordable weekend pop-up.",
            "budget_range": {"minimum": 100, "maximum": 500, "currency": "USD"},
            "event_requirements": [" accessible venue "],
        }
    )

    assert brief.business_name == "Small Batch Skin"
    assert brief.event_requirements == ["accessible venue"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"business_name": " "},
        {"website": None, "identifying_info": None},
        {"city": None, "target_market": None},
        {"budget_range": {"minimum": 500, "maximum": 100, "currency": "USD"}},
        {"collaboration_goal": "short"},
    ],
)
def test_business_brief_rejects_invalid_data(overrides: dict[str, object]) -> None:
    brief_data: dict[str, object] = {
        "business_name": "Small Batch Skin",
        "website": "https://example.test",
        "city": "Austin",
        "collaboration_goal": "Plan an affordable weekend pop-up.",
        "budget_range": {"minimum": 100, "maximum": 500, "currency": "USD"},
    }
    brief_data.update(overrides)

    with pytest.raises(ValidationError):
        BusinessBrief.model_validate(brief_data)

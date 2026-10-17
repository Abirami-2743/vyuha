"""Validated API and evidence models for Vyuha."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class BudgetRange(StrictModel):
    minimum: float = Field(ge=0, allow_inf_nan=False)
    maximum: float = Field(ge=0, allow_inf_nan=False)
    currency: str = Field(default="USD", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def maximum_not_below_minimum(self) -> BudgetRange:
        if self.maximum < self.minimum:
            raise ValueError("maximum budget must be greater than or equal to minimum")
        return self


class BusinessBrief(StrictModel):
    business_name: str = Field(min_length=1, max_length=160)
    industry: str | None = Field(default=None, min_length=1, max_length=160)
    website: AnyHttpUrl | None = None
    identifying_info: str | None = Field(default=None, max_length=1_000)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    target_market: str | None = Field(default=None, min_length=1, max_length=240)
    collaboration_goal: str = Field(min_length=10, max_length=2_000)
    budget_range: BudgetRange
    event_requirements: list[str] = Field(default_factory=list, max_length=30)
    constraints: list[str] = Field(default_factory=list, max_length=30)

    @field_validator(
        "business_name", "industry", "collaboration_goal", "city", "target_market", mode="before"
    )
    @classmethod
    def reject_blank_text(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("identifying_info", mode="before")
    @classmethod
    def normalize_identifying_info(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("event_requirements", "constraints")
    @classmethod
    def validate_list_items(cls, values: list[str]) -> list[str]:
        if any(not item.strip() for item in values):
            raise ValueError("items must not be blank")
        if any(len(item) > 500 for item in values):
            raise ValueError("items must not exceed 500 characters")
        return [item.strip() for item in values]

    @model_validator(mode="after")
    def require_market_context(self) -> BusinessBrief:
        if not self.city and not self.target_market:
            raise ValueError("provide a city or target market")
        if not self.website and not self.identifying_info:
            raise ValueError("provide a website or other identifying information")
        return self


class ResolvedEntity(StrictModel):
    entity_id: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=500)
    entity_type: str = Field(min_length=1, max_length=120)
    entity_types: list[str] = Field(default_factory=list, max_length=20)
    subtype: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=4_000)


class EvidenceItem(StrictModel):
    source_type: Literal["qloo", "external", "ai_interpretation", "unknown"]
    source_reference: str = Field(min_length=1, max_length=2_000)
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    claim: str = Field(min_length=1, max_length=2_000)

    @field_validator("retrieved_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("retrieved_at must include a timezone")
        return value


class Candidate(StrictModel):
    entity_id: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=500)
    entity_type: str = Field(min_length=1, max_length=120)
    entity_types: list[str] = Field(default_factory=list, max_length=20)
    subtype: str | None = Field(default=None, max_length=120)
    identity_match_label: Literal["not an exact match"] | None = None
    affinity_score: float | None = Field(default=None, allow_inf_nan=False)
    qloo_city: str | None = Field(default=None, max_length=200)
    qloo_region: str | None = Field(default=None, max_length=200)
    qloo_country_code: str | None = Field(default=None, min_length=2, max_length=2)
    discovery_basis: Literal["business_brand", "user_supplied_seeds", "osm_category_baseline"] = (
        "business_brand"
    )
    source_seed_names: list[str] = Field(default_factory=list, max_length=3)
    seed_affinities: list[SeedAffinity] = Field(default_factory=list, max_length=3)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=50)


class SeedAffinity(StrictModel):
    seed_name: str = Field(min_length=1, max_length=160)
    score: float = Field(allow_inf_nan=False)
    source_reference: str = Field(min_length=1, max_length=2_000)


class Criticism(StrictModel):
    code: str = Field(min_length=1, max_length=100)
    candidate_entity_id: str | None = Field(default=None, max_length=256)
    issue: str = Field(min_length=1, max_length=1_000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=50)
    supporting_evidence_references: list[str] = Field(min_length=1, max_length=20)
    severity: Literal["low", "medium", "high"]
    resolvable: bool
    effect_on_recommendation: str = Field(min_length=1, max_length=1_000)


class Decision(StrictModel):
    recommendation: Literal["STRONG FIT", "WORTH TESTING", "SKIP"]
    rationale: str = Field(min_length=1, max_length=2_000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=50)


class Experiment(StrictModel):
    candidate_name: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2_000)
    budget: BudgetRange | None = None
    success_criteria: list[str] = Field(min_length=1, max_length=20)
    duration_days: int | None = Field(default=None, ge=1, le=90)
    test_format: str = Field(min_length=1, max_length=500)
    event_structure: list[str] = Field(default_factory=list, max_length=20)
    costs_to_verify: list[str] = Field(min_length=1, max_length=20)
    assumptions: list[str] = Field(default_factory=list, max_length=20)
    risks: list[str] = Field(default_factory=list, max_length=20)
    next_step: str = Field(min_length=1, max_length=500)


class OutreachDraft(StrictModel):
    recipient_name: str | None = Field(default=None, max_length=160)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4_000)
    channel: Literal["email", "direct_message", "other"] = "email"
    facts_not_verified: list[str] = Field(min_length=1, max_length=20)

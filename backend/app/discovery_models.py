"""Typed request and response contracts for the A-D discovery pipeline."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from .models import BusinessBrief, Candidate, EvidenceItem, StrictModel
from .verification import OSMPlace


class SeedBrandInput(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    selected_entity_id: str | None = Field(default=None, min_length=1, max_length=256)


class SeedResolution(StrictModel):
    query: str = Field(min_length=1, max_length=160)
    status: Literal["resolved", "needs_user_choice", "not_found"]
    options: list[Candidate] = Field(default_factory=list, max_length=5)
    selected_entity: Candidate | None = None


class DiscoveryRequest(StrictModel):
    brief: BusinessBrief
    selected_osm_type: Literal["node", "way", "relation"] | None = None
    selected_osm_id: int | None = Field(default=None, gt=0)
    selected_qloo_entity_id: str | None = Field(default=None, min_length=1, max_length=256)
    seed_brands: list[SeedBrandInput] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def selected_osm_identity_is_complete(self) -> DiscoveryRequest:
        if (self.selected_osm_type is None) != (self.selected_osm_id is None):
            raise ValueError("selected_osm_type and selected_osm_id must be supplied together")
        normalized_names = [seed.name.casefold() for seed in self.seed_brands]
        if len(normalized_names) != len(set(normalized_names)):
            raise ValueError("seed_brands must contain distinct names")
        return self


class BusinessIdentity(StrictModel):
    status: Literal[
        "verified", "partially_verified", "needs_user_choice", "not_found", "unavailable"
    ]
    osm_status: Literal["verified", "ambiguous", "not_found", "selection_invalid", "unavailable"]
    qloo_status: Literal[
        "resolved",
        "ambiguous",
        "not_found",
        "selection_invalid",
        "unavailable",
        "not_attempted",
    ] = "not_attempted"
    osm_options: list[OSMPlace] = Field(default_factory=list, max_length=5)
    qloo_options: list[Candidate] = Field(default_factory=list, max_length=20)
    selected_osm_place: OSMPlace | None = None
    selected_qloo_entity: Candidate | None = None
    seed_resolutions: list[SeedResolution] = Field(default_factory=list, max_length=3)
    discovery_basis: Literal["business_brand", "user_supplied_seeds"] | None = None
    cross_source_entity_linkage: Literal["unverified"] = "unverified"
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)


class CandidateCheck(StrictModel):
    candidate: Candidate
    status: Literal["verified", "ambiguous", "not_found", "unverified", "unavailable"]
    verification_message: str | None = Field(default=None, max_length=500)
    location_relevance: Literal[
        "osm_same_city_unlinked",
        "qloo_same_city_unverified",
        "out_of_market",
        "unverified",
    ] = "unverified"
    place_matches: list[OSMPlace] = Field(default_factory=list, max_length=5)
    verified_identity: bool = False
    verified_location: bool = False
    qloo_osm_entity_linkage: Literal["verified", "unverified"] = "unverified"
    operating_status: Literal["unknown"] = "unknown"
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=10)
    missing_evidence: list[str] = Field(default_factory=list, max_length=20)
    freshness_limit: str = (
        "OSM was queried during this run; the search response does not establish "
        "current operating status or a listing's last-edit time."
    )


class Criterion(StrictModel):
    assessment: Literal["supported", "partial", "unknown", "concern"]
    rationale: str = Field(min_length=1, max_length=1_000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)


class CandidateComparison(StrictModel):
    candidate: Candidate
    role: Literal[
        "unexpected",
        "conventional_baseline",
        "other_conventional",
        "unclassified",
        "out_of_market",
    ]
    evidence_relevance: Criterion
    taste_affinity: Criterion
    complementarity: Criterion
    competition: Criterion
    geographic_logistical_suitability: Criterion
    budget_compatibility: Criterion
    goal_alignment: Criterion
    uncertainty: Criterion
    identity_verification: CandidateCheck


class LocationQuery(StrictModel):
    provider: Literal["qloo"] = "qloo"
    point_wkt: str = Field(min_length=1, max_length=100)
    radius_miles: float = Field(gt=0, le=100)
    source_reference: str = Field(min_length=1, max_length=2_000)
    limitation: str = (
        "Qloo's radius is not a city boundary. Candidate locality must be checked from "
        "returned Qloo geocodes and independent OSM results."
    )


class DiscoveryResult(StrictModel):
    status: Literal["complete", "partial", "empty", "needs_user_choice"]
    business_identity: BusinessIdentity
    candidate_checks: list[CandidateCheck] = Field(default_factory=list, max_length=5)
    unexpected_candidates: list[CandidateComparison] = Field(default_factory=list, max_length=5)
    conventional_baseline: CandidateComparison | None = None
    baseline_limitation: str | None = Field(default=None, max_length=1_000)
    out_of_market_candidates: list[CandidateComparison] = Field(default_factory=list, max_length=5)
    location_query: LocationQuery | None = None
    other_conventional_candidates: list[CandidateComparison] = Field(
        default_factory=list, max_length=5
    )
    unclassified_candidates: list[CandidateComparison] = Field(default_factory=list, max_length=5)
    limitations: list[str] = Field(default_factory=list, max_length=30)


class _CandidateInterpretation(StrictModel):
    entity_id: str = Field(min_length=1, max_length=256)
    complementarity_hypothesis: str | None = Field(default=None, max_length=1_000)
    goal_alignment: Literal["strong", "possible", "weak", "unknown"] = "unknown"
    evidence_references: list[str] = Field(default_factory=list, max_length=20)
    uncertainties: list[str] = Field(default_factory=list, max_length=20)


class _InterpretationResponse(StrictModel):
    candidates: list[_CandidateInterpretation] = Field(max_length=5)

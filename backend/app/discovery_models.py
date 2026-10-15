"""Typed request and response contracts for the A-D discovery pipeline."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from .models import BusinessBrief, Candidate, EvidenceItem, StrictModel
from .verification import OSMPlace


class DiscoveryRequest(StrictModel):
    brief: BusinessBrief
    selected_osm_type: Literal["node", "way", "relation"] | None = None
    selected_osm_id: int | None = Field(default=None, gt=0)
    selected_qloo_entity_id: str | None = Field(default=None, min_length=1, max_length=256)

    @model_validator(mode="after")
    def selected_osm_identity_is_complete(self) -> DiscoveryRequest:
        if (self.selected_osm_type is None) != (self.selected_osm_id is None):
            raise ValueError("selected_osm_type and selected_osm_id must be supplied together")
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
    cross_source_entity_linkage: Literal["unverified"] = "unverified"
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)


class CandidateCheck(StrictModel):
    candidate: Candidate
    status: Literal["verified", "ambiguous", "not_found", "unverified", "unavailable"]
    verification_message: str | None = Field(default=None, max_length=500)
    place_matches: list[OSMPlace] = Field(default_factory=list, max_length=5)
    verified_identity: bool = False
    verified_location: bool = False
    qloo_osm_entity_linkage: Literal["unverified"] = "unverified"
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
    role: Literal["unexpected", "conventional_baseline", "other_conventional", "unclassified"]
    evidence_relevance: Criterion
    taste_affinity: Criterion
    complementarity: Criterion
    competition: Criterion
    geographic_logistical_suitability: Criterion
    budget_compatibility: Criterion
    goal_alignment: Criterion
    uncertainty: Criterion
    identity_verification: CandidateCheck


class DiscoveryResult(StrictModel):
    status: Literal["complete", "partial", "empty", "needs_user_choice"]
    business_identity: BusinessIdentity
    candidate_checks: list[CandidateCheck] = Field(default_factory=list, max_length=5)
    unexpected_candidates: list[CandidateComparison] = Field(default_factory=list, max_length=5)
    conventional_baseline: CandidateComparison | None = None
    baseline_limitation: str | None = Field(default=None, max_length=1_000)
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

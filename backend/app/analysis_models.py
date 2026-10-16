"""Typed contracts for adversarial review and evidence-based decisions."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from .discovery_models import CandidateComparison, DiscoveryResult
from .models import Criticism, Experiment, OutreachDraft, StrictModel

Rating = Literal["STRONG FIT", "WORTH TESTING", "SKIP"]
AnalysisStage = Literal[
    "discovery_identity",
    "discovery_candidates",
    "discovery_verification",
    "discovery_comparison",
    "critic",
    "decision",
    "experiment",
    "outreach",
    "analysis",
]
ProgressStatus = Literal["running", "complete", "degraded", "failed"]


class CandidateDecision(StrictModel):
    candidate: CandidateComparison
    provisional_rating: Rating
    final_rating: Rating
    rationale: str = Field(min_length=1, max_length=2_000)
    downgrade_causes: list[str] = Field(default_factory=list, max_length=20)
    criticisms: list[Criticism] = Field(default_factory=list, max_length=30)


class OverallDecision(StrictModel):
    result: Literal["STRONG FIT", "WORTH TESTING", "SKIP", "no candidate supported"]
    selected_entity_id: str | None = Field(default=None, max_length=256)
    selected_candidate_name: str | None = Field(default=None, max_length=500)
    rationale: str = Field(min_length=1, max_length=2_000)
    evidence_references: list[str] = Field(default_factory=list, max_length=30)


class AnalysisResult(StrictModel):
    discovery: DiscoveryResult
    candidate_decisions: list[CandidateDecision] = Field(default_factory=list, max_length=10)
    global_criticisms: list[Criticism] = Field(default_factory=list, max_length=20)
    overall_decision: OverallDecision
    experiments: list[Experiment] = Field(default_factory=list, max_length=10)
    outreach_drafts: list[OutreachDraft] = Field(default_factory=list, max_length=10)
    critic_text_status: Literal["llm", "rule_based_unavailable", "rule_based_rejected"]
    critic_text_note: str | None = Field(default=None, max_length=500)


class _CriticTextItem(StrictModel):
    finding_id: str = Field(min_length=1, max_length=400)
    issue: str = Field(min_length=1, max_length=1_000)
    effect_on_decision: str = Field(min_length=1, max_length=1_000)
    supporting_evidence_references: list[str] = Field(min_length=1, max_length=20)


class _CriticTextResponse(StrictModel):
    findings: list[_CriticTextItem] = Field(max_length=200)


class AnalysisStreamEvent(StrictModel):
    stage: AnalysisStage
    status: ProgressStatus
    message: str = Field(min_length=1, max_length=500)
    result: AnalysisResult | None = None

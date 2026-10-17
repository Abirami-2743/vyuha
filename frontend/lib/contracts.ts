export type EvidenceProvenance = "qloo" | "external" | "ai_interpretation" | "unknown";
export type Provenance = EvidenceProvenance | "rule_based";
export type Rating = "STRONG FIT" | "WORTH TESTING" | "SKIP";

export interface Evidence {
  source_type: EvidenceProvenance;
  source_reference: string;
  claim: string;
}

export interface Candidate {
  entity_id: string;
  name: string;
  entity_type: string;
  entity_types?: string[];
  subtype?: string | null;
  identity_match_label?: "not an exact match" | null;
  affinity_score?: number | null;
  qloo_city?: string | null;
  qloo_region?: string | null;
  qloo_country_code?: string | null;
  discovery_basis?: string;
  source_seed_names?: string[];
  seed_affinities?: Array<{ seed_name: string; score: number; source_reference: string }>;
  evidence?: Evidence[];
}

export interface Criterion {
  assessment: "supported" | "partial" | "unknown" | "concern";
  rationale: string;
  evidence: Evidence[];
}

export interface Place {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name: string;
  display_name: string;
  category: string;
  type: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

export interface CandidateComparison {
  candidate: Candidate;
  role: string;
  evidence_relevance: Criterion;
  taste_affinity: Criterion;
  complementarity: Criterion;
  competition: Criterion;
  geographic_logistical_suitability: Criterion;
  budget_compatibility: Criterion;
  goal_alignment: Criterion;
  uncertainty: Criterion;
  identity_verification: {
    status: string;
    location_relevance: string;
    verified_identity: boolean;
    verified_location: boolean;
    evidence: Evidence[];
    missing_evidence: string[];
    freshness_limit: string;
  };
}

export interface Criticism {
  code: string;
  issue: string;
  evidence: Evidence[];
  supporting_evidence_references: string[];
  severity: "low" | "medium" | "high";
  resolvable: boolean;
  effect_on_recommendation: string;
}

export interface CandidateDecision {
  candidate: CandidateComparison;
  provisional_rating: Rating;
  final_rating: Rating;
  rationale: string;
  downgrade_causes: string[];
  criticisms: Criticism[];
}

export interface Experiment {
  candidate_name: string;
  title: string;
  description: string;
  budget: { minimum: number; maximum: number; currency: string } | null;
  success_criteria: string[];
  duration_days: number | null;
  test_format: string;
  event_structure: string[];
  costs_to_verify: string[];
  assumptions: string[];
  risks: string[];
  next_step: string;
}

export interface OutreachDraft {
  recipient_name: string | null;
  subject: string;
  body: string;
  channel: "email" | "direct_message" | "other";
  facts_not_verified: string[];
}

export interface SeedResolution {
  query: string;
  status: "resolved" | "needs_user_choice" | "not_found";
  options: Candidate[];
  selected_entity: Candidate | null;
}

export interface BusinessIdentity {
  status: string;
  osm_status: string;
  qloo_status: string;
  osm_options: Place[];
  qloo_options: Candidate[];
  seed_resolutions: SeedResolution[];
  selected_osm_place: Place | null;
  selected_qloo_entity: Candidate | null;
  evidence: Evidence[];
  limitations: string[];
}

export interface Discovery {
  status: "complete" | "partial" | "empty" | "needs_user_choice";
  business_identity: BusinessIdentity;
  candidate_checks: Array<{
    candidate: Candidate;
    status: string;
    evidence: Evidence[];
    missing_evidence: string[];
  }>;
  unexpected_candidates: CandidateComparison[];
  conventional_baseline: CandidateComparison | null;
  baseline_limitation: string | null;
  out_of_market_candidates: CandidateComparison[];
  location_query: {
    radius_miles: number;
    limitation: string;
  } | null;
  other_conventional_candidates: CandidateComparison[];
  unclassified_candidates: CandidateComparison[];
  limitations: string[];
}

export interface Analysis {
  discovery: Discovery;
  candidate_decisions: CandidateDecision[];
  global_criticisms: Criticism[];
  overall_decision: {
    result: Rating | "no candidate supported";
    selected_entity_id: string | null;
    selected_candidate_name: string | null;
    rationale: string;
    evidence_references: string[];
  };
  experiments: Experiment[];
  outreach_drafts: OutreachDraft[];
  critic_text_status: "llm" | "rule_based_unavailable" | "rule_based_rejected";
  critic_text_note: string | null;
}

export interface SavedRun {
  captured_at: string;
  analysis: Analysis;
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== "object" || value === null) return false;
  const savedRun = value as Record<string, unknown>;
  if (
    typeof savedRun.captured_at !== "string" ||
    !Number.isFinite(Date.parse(savedRun.captured_at)) ||
    typeof savedRun.analysis !== "object" ||
    savedRun.analysis === null
  ) {
    return false;
  }
  const analysis = savedRun.analysis as Record<string, unknown>;
  if (
    !Array.isArray(analysis.candidate_decisions) ||
    !Array.isArray(analysis.experiments) ||
    !Array.isArray(analysis.outreach_drafts) ||
    typeof analysis.discovery !== "object" ||
    analysis.discovery === null ||
    typeof analysis.overall_decision !== "object" ||
    analysis.overall_decision === null
  ) {
    return false;
  }
  return true;
}

export type Stage =
  | "discovery_identity"
  | "discovery_candidates"
  | "discovery_verification"
  | "discovery_comparison"
  | "critic"
  | "decision"
  | "experiment"
  | "outreach"
  | "analysis";

export interface StageEvent {
  stage: Stage;
  status: "running" | "complete" | "degraded" | "failed";
  message: string;
  result: Analysis | null;
}

export interface DiscoveryRequest {
  brief: {
    business_name: string;
    industry: string | null;
    website: string | null;
    identifying_info: string | null;
    city: string | null;
    target_market: string | null;
    collaboration_goal: string;
    budget_range: { minimum: number; maximum: number; currency: string };
    event_requirements: string[];
    constraints: string[];
  };
  selected_osm_type?: Place["osm_type"];
  selected_osm_id?: number;
  selected_qloo_entity_id?: string;
  seed_brands: Array<{ name: string; selected_entity_id?: string }>;
}

export type ProgressEvent = Omit<StageEvent, "stage" | "result">;

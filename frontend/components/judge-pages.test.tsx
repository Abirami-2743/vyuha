import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DemoGallery,
  EvidencePage,
  AboutPage,
  HomePage,
  PartnerDetailPage,
  PartnersPage,
  VerdictPage,
} from "@/components/judge-pages";
import type { Analysis, CandidateDecision, Criterion } from "@/lib/contracts";

afterEach(cleanup);

const emptyAnalysis = {
  discovery: {
    status: "empty",
    business_identity: {
      status: "verified",
      osm_status: "verified",
      qloo_status: "resolved",
      osm_options: [],
      qloo_options: [],
      seed_resolutions: [],
      selected_osm_place: null,
      selected_qloo_entity: null,
      evidence: [],
      limitations: [],
    },
    candidate_checks: [],
    unexpected_candidates: [],
    conventional_baseline: null,
    baseline_limitation: null,
    out_of_market_candidates: [],
    location_query: null,
    other_conventional_candidates: [],
    unclassified_candidates: [],
    limitations: [],
  },
  candidate_decisions: [],
  global_criticisms: [],
  overall_decision: {
    result: "no candidate supported",
    selected_entity_id: null,
    selected_candidate_name: null,
    rationale: "There is not enough evidence to support a partner.",
    evidence_references: [],
  },
  experiments: [],
  outreach_drafts: [],
  critic_text_status: "rule_based_unavailable",
  critic_text_note: null,
} satisfies Analysis;

function unsupportedCandidate(): CandidateDecision {
  const unsupported: Criterion = {
    assessment: "unknown",
    rationale: "Qloo did not return a positive taste signal.",
    evidence: [],
  };
  return {
    candidate: {
      candidate: {
        entity_id: "partner-1",
        name: "Possible Place",
        entity_type: "urn:entity:place",
      },
      role: "unexpected",
      evidence_relevance: unsupported,
      taste_affinity: unsupported,
      complementarity: unsupported,
      competition: unsupported,
      geographic_logistical_suitability: unsupported,
      budget_compatibility: unsupported,
      goal_alignment: unsupported,
      uncertainty: unsupported,
      identity_verification: {
        status: "unverified",
        location_relevance: "unknown",
        verified_identity: false,
        verified_location: false,
        evidence: [],
        missing_evidence: [],
        freshness_limit: "Not verified.",
      },
    },
    provisional_rating: "SKIP",
    final_rating: "SKIP",
    rationale: "The available evidence does not support testing this place.",
    downgrade_causes: [],
    criticisms: [],
  };
}

describe("judge-first pages", () => {
  it("explains the product and offers both ways to try it", () => {
    const navigate = vi.fn();
    render(<HomePage onNavigate={navigate} />);

    const headline = screen.getByRole("heading", { level: 1, name: /Find an unexpected partner/ });
    expect(headline).toBeInTheDocument();
    expect((headline.textContent ?? "").trim().split(/\s+/)).toHaveLength(15);
    expect(screen.getByText(/Qloo's taste clues help surface ideas worth testing/)).toBeInTheDocument();
    expect(screen.queryByText(/whose customers already love what yours love/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Groq \(primary model\) with a second Groq model as fallback/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try a demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try your own business" })).toBeInTheDocument();
  });

  it("does not show hardcoded historical evaluation counts as current app metrics", () => {
    render(<AboutPage />);

    expect(screen.queryByText(/Evaluation set counts/)).not.toBeInTheDocument();
  });

  it("shows five real brief cards and labels saved runs as not live", () => {
    render(
      <DemoGallery
        onRun={vi.fn()}
        onViewSaved={vi.fn()}
        savedRuns={{}}
        savedRunsLoading={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pick a business to explore" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Run live" })).toHaveLength(5);
    expect(screen.getAllByText("No saved result is available")).toHaveLength(5);
  });

  it("frames an unsupported result as an honest refusal to guess", () => {
    render(<VerdictPage analysis={emptyAnalysis} onNavigate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Vyuha says no safe partner found" })).toBeInTheDocument();
    expect(screen.getByText(/refuses to guess/)).toBeInTheDocument();
    expect(screen.getByText(/0 partners checked/)).toBeInTheDocument();
  });

  it("offers a usable demo link from a directly opened partner URL", () => {
    const navigate = vi.fn();
    render(<PartnerDetailPage analysis={null} onNavigate={navigate} route="/result/partners/missing" />);

    screen.getByRole("button", { name: "Choose a demo" }).click();

    expect(navigate).toHaveBeenCalledWith("/demos");
  });

  it("does not present an unsupported taste statement as the best reason", () => {
    const decision = unsupportedCandidate();
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "complete",
        unexpected_candidates: [decision.candidate],
      },
      candidate_decisions: [decision],
    };
    render(<PartnersPage analysis={analysis} onNavigate={vi.fn()} />);

    const reason = screen.getByText("Why it may work:").parentElement;
    expect(reason).toHaveTextContent("No positive reason with supporting evidence was returned.");
    expect(reason).not.toHaveTextContent("Qloo did not return a positive taste signal.");

    render(
      <PartnerDetailPage
        analysis={analysis}
        onNavigate={vi.fn()}
        route="/result/partners/partner-1"
      />,
    );
    const detailReason = screen.getByRole("heading", { name: "Why this could work" }).parentElement;
    expect(detailReason).toHaveTextContent("No positive reason with supporting evidence was returned.");
    expect(detailReason).not.toHaveTextContent("Qloo did not return a positive taste signal.");
  });

  it("keeps the full step timeline collapsed above the evidence disclosure", () => {
    render(
      <EvidencePage
        analysis={emptyAnalysis}
        onNavigate={vi.fn()}
        trace={[
          { name: "Plan", duration_ms: 1, result_count: null, http_statuses: [] },
          { name: "Qloo search", duration_ms: 1, result_count: 2, http_statuses: [200] },
          { name: "Qloo insights", duration_ms: 1, result_count: 1, http_statuses: [200] },
          { name: "Map verification", duration_ms: 1, result_count: 1, http_statuses: [200] },
          { name: "Compare", duration_ms: 1, result_count: 1, http_statuses: [] },
          { name: "Critic", duration_ms: 1, result_count: 1, http_statuses: [] },
          { name: "Decision", duration_ms: 1, result_count: 1, http_statuses: [] },
        ]}
      />,
    );

    expect(screen.getByText("See the agent steps (7)").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText(/See full evidence/)).toBeInTheDocument();
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("does not report missing saved runs when the backend check failed", () => {
    render(
      <DemoGallery
        onRun={vi.fn()}
        onViewSaved={vi.fn()}
        savedRunErrors={{ "blue-bottle-san-francisco": true }}
        savedRuns={{}}
        savedRunsLoading={false}
      />,
    );

    expect(
      screen.getByText("Could not check for a saved result. Check the connection and reload."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No saved result is available")).toHaveLength(4);
  });

  it("frames an unsupported result as an honest refusal to guess", () => {
    render(<VerdictPage analysis={emptyAnalysis} onNavigate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Vyuha says no safe partner found" })).toBeInTheDocument();
    expect(screen.getByText(/refuses to guess/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Why Vyuha said no/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why Vyuha said no" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why Vyuha said no" }).querySelector("[aria-hidden='true']"))
      .toHaveTextContent("🔎");
    expect(screen.getAllByText(/0 partners checked/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Review possible partners" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /top 3 partners/i })).not.toBeInTheDocument();
    expect(screen.getByText(/try a nearby larger city/i)).toBeInTheDocument();
    expect(screen.queryByText(/No test plan was returned/)).not.toBeInTheDocument();
  });

  it("suggests spelling and market checks when the business listing was not verified", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "not_found",
          osm_status: "not_found",
          qloo_status: "not_attempted",
        },
      },
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(screen.getByText(/Check the business spelling and city, or try a nearby larger city/))
      .toBeInTheDocument();
  });

  it("shows a green completed-check line when map matches are unverified, not when a call failed", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        candidate_checks: [
          {
            candidate: { entity_id: "unverified-1", name: "Unverified place", entity_type: "place" },
            status: "unverified",
            evidence: [],
            missing_evidence: ["No matching map listing"],
          },
        ],
      },
      candidate_decisions: [unsupportedCandidate()],
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(screen.getByText(/All checks completed: 1 partner checked, 0 rejected/))
      .toBeInTheDocument();
    expect(screen.queryByText(/Partial result:/)).not.toBeInTheDocument();
  });

  it("does not invent a mind-changing finding when the critic returned none", () => {
    render(<VerdictPage analysis={emptyAnalysis} onNavigate={vi.fn()} />);

    expect(
      screen.getByText(
        "What would change my mind: No resolvable critic finding stated what evidence would change this decision.",
      ),
    ).toBeInTheDocument();
  });

  it("names incomplete map checks and reports the affected count", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        candidate_checks: [
          {
            candidate: { entity_id: "map-failed-1", name: "Map failure one", entity_type: "place" },
            status: "unavailable",
            verification_message: "The independent place lookup is unavailable.",
            evidence: [],
            missing_evidence: ["No independent place response was available"],
          },
          {
            candidate: { entity_id: "map-failed-2", name: "Map failure two", entity_type: "place" },
            status: "unavailable",
            verification_message: "The independent place lookup is unavailable.",
            evidence: [],
            missing_evidence: ["No independent place response was available"],
          },
          {
            candidate: { entity_id: "map-checked-1", name: "Map checked", entity_type: "place" },
            status: "verified",
            verified_location: true,
            evidence: [],
            missing_evidence: [],
          },
        ],
      },
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(
      screen.getByText(/Map checks for 2 of 3 candidate places did not complete/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/All checks completed/)).not.toBeInTheDocument();
  });

  it("uses plain-language taste evidence and keeps numeric affinity in collapsed technical detail", () => {
    const candidate = unsupportedCandidate();
    candidate.final_rating = "WORTH TESTING";
    candidate.provisional_rating = "WORTH TESTING";
    candidate.candidate.candidate.name = "Possible Place";
    candidate.candidate.candidate.affinity_score = 0.881675;
    candidate.candidate.candidate.evidence = [
      { source_type: "qloo", source_reference: "/v2/insights", claim: "Qloo returned a candidate." },
    ];
    candidate.candidate.taste_affinity = {
      assessment: "partial",
      rationale: "Qloo returned numeric affinity 0.881675, a relative signal within this query only.",
      evidence: [
        { source_type: "qloo", source_reference: "/v2/insights", claim: "Qloo returned a candidate." },
      ],
    };
    candidate.criticisms = [
      {
        code: "identity_unverified",
        issue: "The map listing could not be linked to the Qloo result.",
        evidence: [],
        supporting_evidence_references: [],
        severity: "high",
        resolvable: true,
        effect_on_recommendation: "A verified link between the Qloo result and the local listing could address this concern.",
      },
    ];
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "complete",
        candidate_checks: [
          {
            candidate: candidate.candidate.candidate,
            status: "verified",
            verified_location: true,
            place_matches: [
              {
                osm_type: "node",
                osm_id: 9,
                name: "Possible Place",
                display_name: "Possible Place",
                category: "shop",
                type: "retail",
                lat: "0",
                lon: "0",
              },
            ],
            evidence: [],
            missing_evidence: [],
          },
        ],
      },
      candidate_decisions: [candidate],
      overall_decision: {
        result: "WORTH TESTING",
        selected_entity_id: "partner-1",
        selected_candidate_name: "Possible Place",
        rationale: "A cautious test is supported.",
        evidence_references: [],
      },
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(
      screen.getByText("Qloo's taste data surfaced Possible Place as a possible match in this search."),
    ).toBeInTheDocument();
    expect(screen.getByText("Taste affinity is not proof of shared customers.")).toBeInTheDocument();
    const technical = screen.getByText("Technical detail").closest("details");
    expect(technical).not.toHaveAttribute("open");
    expect(within(technical!).getByText(/numeric affinity 0\.881675/)).toBeInTheDocument();
    expect(screen.getByText(/Based on 1 Qloo signal and 1 verified place/)).toBeInTheDocument();
    expect(screen.getByText(/What would change my mind: A verified link/)).toBeInTheDocument();
  });

  it.each([
    {
      label: "a Qloo search with no partner results",
      qlooStatus: "resolved",
      limitations: ["Qloo returned no place entities for seed 'Example'."],
      expected: /Qloo returned no usable partner results/,
    },
    {
      label: "a business Qloo did not recognize",
      qlooStatus: "not_found",
      limitations: ["Qloo returned 0 result(s), but none was an eligible brand entity."],
      expected: /Qloo did not recognize the business/,
    },
    {
      label: "a Qloo rate limit",
      qlooStatus: "unavailable",
      limitations: ["Qloo discovery failed for seed 'Example': Qloo is temporarily rate limiting requests."],
      expected: /Qloo request was rate limited/,
    },
    {
      label: "an unconfigured Qloo call",
      qlooStatus: "unavailable",
      limitations: ["Qloo discovery is not configured on this server."],
      expected: /Qloo request failed/,
    },
    {
      label: "a Qloo authentication failure",
      qlooStatus: "unavailable",
      limitations: ["Qloo authentication failed; verify the server-side API configuration."],
      expected: /Qloo request failed/,
    },
  ])("explains abstention after $label", ({ label, qlooStatus, limitations, expected }) => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          qloo_status: qlooStatus,
          limitations,
        },
        limitations,
      },
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Why Vyuha said no/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review possible partners" })).not.toBeInTheDocument();
    if (qlooStatus === "unavailable") {
      expect(screen.getByText(/Partial result:/)).toBeInTheDocument();
      expect(screen.queryByText(/All checks completed/)).not.toBeInTheDocument();
    }
    if (label === "a Qloo search with no partner results") {
      expect(screen.getByText(/All checks completed: 0 partners checked, 0 rejected/))
        .toBeInTheDocument();
    }
  });

  it("explains when the devil's advocate rejected every checked partner", () => {
    const rejected = unsupportedCandidate();
    rejected.provisional_rating = "WORTH TESTING";
    rejected.final_rating = "SKIP";
    rejected.criticisms = [
      {
        code: "identity_unverified",
        issue: "The business identity could not be confirmed.",
        evidence: [],
        supporting_evidence_references: [],
        severity: "high",
        resolvable: true,
        effect_on_recommendation: "A verified local identity match could change this decision.",
      },
    ];
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "complete",
        candidate_checks: [
          {
            candidate: rejected.candidate.candidate,
            status: "verified",
            verified_location: true,
            evidence: [],
            missing_evidence: [],
          },
        ],
      },
      candidate_decisions: [rejected],
    };
    render(<VerdictPage analysis={analysis} onNavigate={vi.fn()} />);

    expect(
      screen.getByText(/1 partner was checked, but the devil's advocate rejected them all/),
    ).toBeInTheDocument();
    expect(screen.getByText(/A verified local identity match could change this decision/))
      .toBeInTheDocument();
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

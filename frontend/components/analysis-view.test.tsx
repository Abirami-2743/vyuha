import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisView, splitCandidateDecisions } from "@/components/analysis-view";
import type { Analysis, Criterion, Evidence, TraceStep } from "@/lib/contracts";

const progress = new Map();

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
    rationale: "No supported candidate.",
    evidence_references: [],
  },
  experiments: [],
  outreach_drafts: [],
  critic_text_status: "rule_based_unavailable",
  critic_text_note: null,
} satisfies Analysis;

function analysisWithCandidate(): Analysis {
  const evidence: Evidence = {
    source_type: "external",
    source_reference: "verification:sample-id",
    claim: "The Sample Partner listing is in Portland.",
  };
  const criterion: Criterion = {
    assessment: "supported",
    rationale: "The candidate's listed activity could suit the stated goal.",
    evidence: [evidence],
  };
  const comparison = {
    candidate: {
      entity_id: "sample-partner-id",
      name: "Sample Partner",
      entity_type: "urn:entity:place",
      evidence: [evidence],
    },
    role: "unexpected",
    evidence_relevance: criterion,
    taste_affinity: criterion,
    complementarity: criterion,
    competition: criterion,
    geographic_logistical_suitability: criterion,
    budget_compatibility: criterion,
    goal_alignment: criterion,
    uncertainty: criterion,
    identity_verification: {
      status: "verified",
      location_relevance: "osm_same_city_unlinked",
      verified_identity: true,
      verified_location: true,
      evidence: [evidence],
      missing_evidence: ["Fees"],
      freshness_limit: "The listing's current operating status is unknown.",
    },
  } satisfies Analysis["candidate_decisions"][number]["candidate"];
  const decision = {
    candidate: comparison,
    provisional_rating: "WORTH TESTING",
    final_rating: "WORTH TESTING",
    rationale: "The available evidence supports a cautious test, not a forecast.",
    downgrade_causes: ["single_source_taste_signal"],
    criticisms: [
      {
        code: "verification_unverified",
        issue: "The listing cannot be linked to the Qloo entity.",
        evidence: [],
        supporting_evidence_references: ["verification:sample-id", "brief:constraints:0"],
        severity: "medium",
        resolvable: true,
        effect_on_recommendation: "Confirm identity before proceeding.",
      },
    ],
  } satisfies Analysis["candidate_decisions"][number];
  return {
    ...emptyAnalysis,
    discovery: {
      ...emptyAnalysis.discovery,
      status: "complete",
      unexpected_candidates: [comparison],
    },
    candidate_decisions: [decision],
    overall_decision: {
      result: "WORTH TESTING",
      selected_entity_id: "sample-partner-id",
      selected_candidate_name: "Sample Partner",
      rationale: "The candidate has evidence for a low-risk test.",
      evidence_references: ["verification:sample-id"],
    },
    experiments: [
      {
        candidate_name: "Sample Partner",
        title: "Partner feasibility test",
        description: "A focused pilot for the Portland pop-up goal.",
        budget: null,
        success_criteria: ["Confirm the format and terms."],
        duration_days: 2,
        test_format: "Two-day pop-up, as required in the brief.",
        event_structure: ["Agree on the event details."],
        costs_to_verify: ["Partner fees"],
        assumptions: [],
        risks: [],
        next_step: "Confirm fees before committing.",
      },
    ],
    outreach_drafts: [
      {
        recipient_name: "Sample Partner",
        subject: "Collaboration in Portland",
        body: "Hello Sample Partner team, Portland; goal: community pop-up.",
        channel: "email",
        facts_not_verified: ["Fees"],
      },
    ],
  };
}

describe("AnalysisView states", () => {
  it("shows real stage progress while loading", () => {
    render(
      <AnalysisView
        analysis={null}
        error={null}
        progress={new Map([["critic", { status: "running", message: "Reviewing evidence." }]])}
        state="loading"
      />,
    );

    expect(screen.getByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.queryByText(/Waking up the AI engine/)).not.toBeInTheDocument();
    expect(screen.getByText("Arguing against the pick")).toBeInTheDocument();
    expect(screen.getByLabelText("running")).toBeInTheDocument();
    expect(screen.getAllByLabelText("not started").length).toBeGreaterThan(0);
  });

  it("shows the cold-start message only after the response wait threshold", () => {
    render(
      <AnalysisView
        analysis={null}
        error={null}
        progress={progress}
        state="loading"
        wakingUp
      />,
    );

    expect(
      screen.getByText("Waking up the AI engine, this can take up to 40 seconds."),
    ).toBeInTheDocument();
  });

  it("offers saved results after a run takes longer than a minute", () => {
    const onViewSaved = vi.fn();
    render(
      <AnalysisView
        analysis={null}
        error={null}
        onViewSaved={onViewSaved}
        progress={progress}
        state="loading"
        takingLong
      />,
    );

    expect(screen.getByText(/taking longer than a minute/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Browse saved results" }));
    expect(onViewSaved).toHaveBeenCalledOnce();
  });

  it("offers saved results for any live analysis failure", () => {
    const onViewSaved = vi.fn();
    render(
      <AnalysisView
        analysis={null}
        error="The analysis timed out."
        onViewSaved={onViewSaved}
        progress={progress}
        state="error"
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Browse saved results" }));
    expect(onViewSaved).toHaveBeenCalledOnce();
  });

  it("explains an empty live response without inventing candidates", () => {
    render(
      <AnalysisView
        analysis={emptyAnalysis}
        error={null}
        progress={progress}
        state="empty"
      />,
    );

    expect(screen.getByText("No candidates to compare")).toBeInTheDocument();
    expect(screen.getByText(/won.t fill the gap with suggestions/i)).toBeInTheDocument();
  });

  it("explains when the business listing could not be found", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "not_found",
          osm_status: "not_found",
        },
      },
    };
    render(<AnalysisView analysis={analysis} error={null} progress={progress} state="empty" />);

    expect(screen.getByRole("heading", { name: "This business could not be found" }))
      .toBeInTheDocument();
    expect(screen.getByText(/Check the business name and market/)).toBeInTheDocument();
  });

  it("explains when map listings exist but none match the requested market", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "not_found",
          osm_status: "not_found",
          osm_options: [
            {
              osm_type: "node",
              osm_id: 1,
              name: "Example business",
              display_name: "Example business, another market",
              category: "shop",
              type: "retail",
              lat: "0",
              lon: "0",
            },
          ],
        },
      },
    };
    render(<AnalysisView analysis={analysis} error={null} progress={progress} state="empty" />);

    expect(
      screen.getByRole("heading", { name: "No matching listing was found in this market" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Check the city or try a broader target market/)).toBeInTheDocument();
  });

  it("explains when Qloo did not return an eligible business match", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "not_found",
          osm_status: "verified",
          qloo_status: "not_found",
        },
      },
    };
    render(<AnalysisView analysis={analysis} error={null} progress={progress} state="empty" />);

    expect(screen.getByRole("heading", { name: "Qloo returned no matching business" }))
      .toBeInTheDocument();
    expect(screen.getByText(/Qloo Search did not return an eligible brand match/))
      .toBeInTheDocument();
  });

  it("shows a failed Qloo request as a failure instead of an empty result", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "unavailable",
          osm_status: "verified",
          qloo_status: "unavailable",
          limitations: ["Qloo is temporarily rate limiting requests. Please try again later."],
        },
        limitations: [
          "Qloo discovery failed for seed 'Example': Qloo is temporarily rate limiting requests.",
        ],
      },
    };
    const onRetry = vi.fn();
    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        onRetry={onRetry}
        progress={progress}
        state="empty"
      />,
    );

    expect(screen.getByRole("heading", { name: "Qloo could not complete the taste search" }))
      .toBeInTheDocument();
    expect(screen.getByText(/failed Qloo request, not an empty result/)).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows an unconfigured Qloo integration as unavailable, not as no candidates", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "unavailable",
          limitations: ["Qloo discovery is not configured on this server."],
        },
        limitations: ["Qloo discovery is not configured on this server."],
      },
    };
    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="empty"
      />,
    );

    expect(screen.getByRole("heading", { name: "Qloo could not complete the taste search" }))
      .toBeInTheDocument();
    expect(screen.getByText("Qloo discovery is not configured on this server."))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No candidates to compare" }))
      .not.toBeInTheDocument();
  });

  it("shows a Qloo authentication failure as unavailable, not as no candidates", () => {
    const analysis: Analysis = {
      ...emptyAnalysis,
      discovery: {
        ...emptyAnalysis.discovery,
        status: "partial",
        business_identity: {
          ...emptyAnalysis.discovery.business_identity,
          status: "unavailable",
          qloo_status: "unavailable",
          limitations: ["Qloo authentication failed; verify the server-side API configuration."],
        },
        limitations: ["Qloo authentication failed; verify the server-side API configuration."],
      },
    };
    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="empty"
      />,
    );

    expect(screen.getByRole("heading", { name: "Qloo could not complete the taste search" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No candidates to compare" }))
      .not.toBeInTheDocument();
  });

  it("does not describe a saved empty result as live", () => {
    render(
      <AnalysisView
        analysis={emptyAnalysis}
        error={null}
        isSavedRun
        progress={progress}
        state="empty"
      />,
    );

    expect(screen.getByText(/The saved analysis returned no candidate decisions/))
      .toBeInTheDocument();
    expect(screen.queryByText(/The live analysis returned no candidate decisions/))
      .not.toBeInTheDocument();
  });

  it("surfaces backend errors", () => {
    const onRetry = vi.fn();
    render(
      <AnalysisView
        analysis={null}
        error="Qloo credentials are not configured."
        onRetry={onRetry}
        progress={progress}
        state="error"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Qloo credentials are not configured.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the required AI-busy message and offers saved results", () => {
    const onViewSaved = vi.fn();
    render(
      <AnalysisView
        analysis={null}
        error="The AI service is busy, try again in a minute or view the saved result"
        onViewSaved={onViewSaved}
        progress={progress}
        state="error"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The AI service is busy, try again in a minute or view the saved result",
    );
    screen.getByRole("link", { name: "Browse saved results" }).click();
    expect(onViewSaved).toHaveBeenCalledOnce();
  });

  it("offers saved results when the run is rate limited", () => {
    render(
      <AnalysisView
        analysis={null}
        error="Qloo is temporarily rate limiting requests."
        onViewSaved={vi.fn()}
        progress={progress}
        state="error"
      />,
    );

    expect(screen.getByRole("heading", { name: "A rate limit was reached" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse saved results" })).toBeInTheDocument();
  });

  it("explains that an unresponsive backend may still be waking up", () => {
    render(
      <AnalysisView
        analysis={null}
        error="Failed to fetch"
        onRetry={vi.fn()}
        progress={progress}
        state="error"
      />,
    );

    expect(screen.getByRole("heading", { name: "The backend did not respond" }))
      .toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("It may still be waking up");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("resolves claim text, hides unresolved references, and collapses details by default", () => {
    render(
      <AnalysisView
        analysis={analysisWithCandidate()}
        error={null}
        progress={progress}
        state="results"
      />,
    );

    expect(screen.getByText("See evidence").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("See evidence"));
    expect(screen.getAllByText("The Sample Partner listing is in Portland.").length)
      .toBeGreaterThan(0);
    expect(screen.queryByText("The cited source is identified, but no claim text was returned."))
      .not.toBeInTheDocument();
    expect(screen.queryByText("verification:sample-id")).not.toBeInTheDocument();
    expect(screen.queryByText("brief:constraints:0")).not.toBeInTheDocument();
    expect(screen.queryByText("urn:entity:place")).not.toBeInTheDocument();
    expect(screen.getAllByText("External").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WORTH TESTING").length).toBeGreaterThan(0);
    expect(screen.getByText("The available evidence supports a cautious test, not a forecast."))
      .toBeInTheDocument();
    expect(
      screen.getByText("The taste signal lacks independent corroboration"),
    ).toBeInTheDocument();
    expect(screen.getByText("Critic details (1)").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Evidence by criterion").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Experiment for Sample Partner: Partner feasibility test"))
      .toBeInTheDocument();
    expect(screen.getByText("Outreach draft for Sample Partner")).toBeInTheDocument();
    expect(screen.getByLabelText("Editable outreach draft")).toHaveValue(
      "Collaboration in Portland\n\nHello Sample Partner team, Portland; goal: community pop-up.",
    );
    expect(screen.getByText(/Not verified: Fees/)).toBeInTheDocument();
  });

  it("shows the verdict count and explains returned Qloo taste candidates", () => {
    const analysis = analysisWithCandidate();
    const decision = analysis.candidate_decisions[0];
    decision.candidate.candidate.source_seed_names = ["Blue Bottle Coffee"];
    decision.candidate.candidate.evidence = [
      {
        source_type: "qloo",
        source_reference: "/v2/insights",
        claim: "Qloo returned this candidate for the selected brand.",
      },
    ];
    decision.candidate.taste_affinity.evidence = [
      {
        source_type: "qloo",
        source_reference: "/v2/insights",
        claim: "Qloo returned this candidate for the selected brand.",
      },
    ];
    decision.provisional_rating = "WORTH TESTING";
    decision.final_rating = "SKIP";
    analysis.overall_decision = {
      result: "no candidate supported",
      selected_entity_id: null,
      selected_candidate_name: null,
      rationale: "The critic did not support a candidate.",
      evidence_references: [],
    };

    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="results"
      />,
    );

    const verdict = screen.getByRole("region", { name: "Verdict" });
    expect(verdict).toHaveTextContent(
      "1 Qloo-suggested candidate, 0 map-only comparison places · critic cut 1 · recommended: No candidate supported (no candidate supported)",
    );
    expect(verdict).toHaveTextContent("No next step was returned.");
    expect(screen.queryByText("Overall decision")).not.toBeInTheDocument();
    expect(within(verdict).getAllByText("Rule-based")).toHaveLength(1);
    expect(
      screen.getByText(/Why Qloo suggests this: Qloo returned this candidate for the selected brand/),
    )
      .toBeInTheDocument();
    expect(screen.getByText(/This is a taste signal, not evidence of shared customers/))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why this partner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The critic's attack" })).toBeInTheDocument();
    expect(screen.getByText("Provisional → final rating")).toBeInTheDocument();
  });

  it("counts map-only baselines separately from Qloo-suggested candidates", () => {
    const qlooDecision = analysisWithCandidate().candidate_decisions[0];
    const mapDecision = {
      ...qlooDecision,
      candidate: {
        ...qlooDecision.candidate,
        role: "conventional_baseline" as const,
        candidate: {
          ...qlooDecision.candidate.candidate,
          entity_id: "osm:way/55",
          name: "Map-only baseline",
          discovery_basis: "osm_category_baseline" as const,
        },
      },
    };

    const groups = splitCandidateDecisions([qlooDecision, mapDecision]);

    expect(groups.qlooSuggested.map((item) => item.candidate.candidate.name))
      .toEqual(["Sample Partner"]);
    expect(groups.mapOnly.map((item) => item.candidate.candidate.name))
      .toEqual(["Map-only baseline"]);

    const analysis = analysisWithCandidate();
    analysis.candidate_decisions.push(mapDecision);
    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="results"
      />,
    );
    expect(screen.getByRole("region", { name: "Verdict" })).toHaveTextContent(
      "1 Qloo-suggested candidate, 1 map-only comparison place",
    );
    fireEvent.click(screen.getByText("See evidence"));
    expect(
      screen.getByText(/compared on map verification only; no taste data, so it can't outrank the others/i),
    ).toBeInTheDocument();
  });

  it("keeps only the top three debates visible and places remaining debates behind evidence", () => {
    const analysis = analysisWithCandidate();
    const baseDecision = analysis.candidate_decisions[0];
    analysis.candidate_decisions.push(
      ...["Second Partner", "Third Partner", "Fourth Partner"].map((name, index) => ({
        ...baseDecision,
        candidate: {
          ...baseDecision.candidate,
          candidate: {
            ...baseDecision.candidate.candidate,
            entity_id: `sample-partner-${index + 2}`,
            name,
          },
        },
      })),
    );

    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="results"
      />,
    );

    const shortlist = screen.getByRole("region", { name: "Top 3 candidates" });
    expect(within(shortlist).getByRole("heading", { name: "Third Partner" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "More candidate debates" }).closest("details"))
      .not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("See evidence"));
    expect(screen.getByRole("heading", { name: "More candidate debates" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Fourth Partner" })).toHaveLength(2);
  });

  it("renders trace timings, result counts, and actual HTTP statuses", () => {
    const trace: TraceStep[] = [
      { name: "Plan", duration_ms: 0.2, result_count: 7, http_statuses: [] },
      { name: "Qloo search", duration_ms: 18.1, result_count: 2, http_statuses: [200] },
      { name: "Qloo insights", duration_ms: 42.7, result_count: 5, http_statuses: [200] },
      { name: "Map verification", duration_ms: 31.5, result_count: 4, http_statuses: [200, 200] },
      { name: "Compare", duration_ms: 3.2, result_count: 1, http_statuses: [] },
      { name: "Critic", duration_ms: 11.8, result_count: 1, http_statuses: [] },
      { name: "Decision", duration_ms: 1.4, result_count: 1, http_statuses: [] },
    ];
    render(
      <AnalysisView
        analysis={analysisWithCandidate()}
        error={null}
        progress={progress}
        state="results"
        trace={trace}
      />,
    );

    fireEvent.click(screen.getByText("See evidence"));

    expect(screen.getByRole("heading", { name: "Agent trace" })).toBeInTheDocument();
    expect(screen.getByText("18.1 ms · 2 results · HTTP 200")).toBeInTheDocument();
    expect(screen.getByText("31.5 ms · 4 results · HTTP 200, 200")).toBeInTheDocument();
  });

  it("labels an AI-written complementarity line as AI interpretation, not Qloo", () => {
    const analysis = analysisWithCandidate();
    analysis.discovery.limitations = [
      "The conventional baseline comes from OSM category data and has no Qloo taste evidence; it is not a like-for-like taste-affinity comparison.",
      "An OSM listing verifies only that OpenStreetMap currently returns a matching record; it does not prove ownership or current operation. Qloo and OSM provide no shared identifier, so cross-source entity linkage is unverified.",
    ];
    const decision = analysis.candidate_decisions[0];
    const qlooEvidence: Evidence = {
      source_type: "qloo",
      source_reference: "/v2/insights?entity=sample-partner-id",
      claim: "Qloo returned the candidate for this taste query.",
    };
    decision.candidate.complementarity = {
      assessment: "partial",
      rationale: "An AI-written complementary idea, still a hypothesis.",
      evidence: [
        qlooEvidence,
        {
          source_type: "ai_interpretation",
          source_reference: "Vyuha structured candidate interpretation",
          claim: "A possible pairing, based on the stated brief.",
        },
      ],
    };
    render(
      <AnalysisView analysis={analysis} error={null} progress={progress} state="results" />,
    );

    fireEvent.click(screen.getByText("See evidence"));
    const candidateCard = screen.getByText("Evidence by criterion").closest("article");
    if (!(candidateCard instanceof HTMLElement)) {
      throw new Error("The candidate should have a comparison card.");
    }
    fireEvent.click(within(candidateCard).getByText("Evidence by criterion"));
    const interpretation = within(candidateCard).getByText(
      "An AI-written complementary idea, still a hypothesis.",
    );
    const line = interpretation.closest("div.flex");
    if (!(line instanceof HTMLElement)) {
      throw new Error("The complementarity line should have a provenance tag.");
    }
    expect(within(line).getByText("AI interpretation")).toBeInTheDocument();
    expect(within(line).queryByText("Qloo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Rule-based").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "This same-industry option was found on the map, but it has no comparable taste signal.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The map returned a matching listing, but that does not confirm ownership, current operation, or that the taste result and map entry refer to the same business.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(within(candidateCard).getByText("Critic details (1)"));
    const criticism = within(candidateCard).getByText(
      "The listing cannot be linked to the Qloo entity.",
    );
    const criticismItem = criticism.closest("li");
    if (!(criticismItem instanceof HTMLElement)) {
      throw new Error("The critic finding should have a list item.");
    }
    expect(within(criticismItem).getByText("Rule-based")).toBeInTheDocument();
  });

  it("lists backend-provided limitations for partial results", () => {
    const analysis = analysisWithCandidate();
    analysis.discovery.status = "partial";
    analysis.discovery.limitations = [
      "Some complementarity or goal-alignment interpretations are missing or partial; unknowns remain unknown.",
    ];

    render(
      <AnalysisView
        analysis={analysis}
        error={null}
        progress={progress}
        state="partial"
      />,
    );

    expect(
      screen.getByText("Some partner-fit assessments are incomplete; unsupported questions remain unanswered."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Partial results: the backend reported limitations. Review what is missing before acting."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("What remains unknown")).not.toBeInTheDocument();
  });

  it("keeps the cannot-verify skip reason visible", () => {
    const analysis = analysisWithCandidate();
    const decision = analysis.candidate_decisions[0];
    const skipped = {
      ...analysis,
      candidate_decisions: [
        {
          ...decision,
          candidate: {
            ...decision.candidate,
            identity_verification: {
              ...decision.candidate.identity_verification,
              status: "unverified",
            },
          },
          final_rating: "SKIP" as const,
          downgrade_causes: ["verification_unverified"],
        },
      ],
      overall_decision: {
        ...analysis.overall_decision,
        result: "SKIP" as const,
      },
    } satisfies Analysis;
    render(
      <AnalysisView analysis={skipped} error={null} progress={progress} state="results" />,
    );

    expect(screen.getByText("Skipped: couldn't verify")).toBeInTheDocument();
  });
});

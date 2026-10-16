import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisView } from "@/components/analysis-view";
import type { Analysis } from "@/lib/contracts";

const progress = new Map();

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
    expect(screen.getByText("Challenge the recommendation")).toBeInTheDocument();
    expect(screen.getByLabelText("running")).toBeInTheDocument();
    expect(screen.getAllByLabelText("not started").length).toBeGreaterThan(0);
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
    expect(screen.getByText(/won't fill the gap with suggestions/i)).toBeInTheDocument();
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
});

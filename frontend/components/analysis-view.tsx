"use client";

import { useState } from "react";
import type {
  Analysis,
  CandidateDecision,
  Criterion,
  Criticism,
  Evidence,
  Provenance,
} from "@/lib/contracts";
import { EvidenceLine, SourceTag } from "@/components/evidence";

export type ViewState = "loading" | "empty" | "error" | "partial" | "results";

const stageLabels = [
  ["discovery_identity", "Resolve identity"],
  ["discovery_candidates", "Discover candidates"],
  ["discovery_verification", "Verify listings"],
  ["discovery_comparison", "Compare evidence"],
  ["critic", "Challenge the recommendation"],
  ["decision", "Make a decision"],
  ["experiment", "Design a small test"],
  ["outreach", "Prepare outreach"],
  ["analysis", "Complete analysis"],
] as const;

const criteria: Array<[keyof CandidateDecision["candidate"], string]> = [
  ["evidence_relevance", "Evidence relevance"],
  ["taste_affinity", "Taste signal"],
  ["complementarity", "Complementarity"],
  ["competition", "Competition"],
  ["geographic_logistical_suitability", "Geography & logistics"],
  ["budget_compatibility", "Budget compatibility"],
  ["goal_alignment", "Goal alignment"],
  ["uncertainty", "Uncertainty"],
];

function ratingStyle(rating: string): string {
  if (rating === "STRONG FIT") return "bg-emerald-100 text-emerald-950";
  if (rating === "WORTH TESTING") return "bg-amber-100 text-amber-950";
  return "bg-slate-200 text-slate-800";
}

function RatingBadge({ rating }: { rating: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${ratingStyle(rating)}`}>
      {rating}
    </span>
  );
}

function isCriterion(value: unknown): value is Criterion {
  return (
    value !== null &&
    typeof value === "object" &&
    "evidence" in value &&
    Array.isArray(value.evidence)
  );
}

function evidenceIndex(analysis: Analysis): Map<string, Evidence> {
  const entries: Evidence[] = [
    ...analysis.discovery.business_identity.evidence,
    ...analysis.discovery.candidate_checks.flatMap((check) => check.evidence),
    ...analysis.candidate_decisions.flatMap((decision) => {
      const comparison = decision.candidate;
      const criterionEvidence = criteria.flatMap(([key]) => {
        const criterion = comparison[key];
        return isCriterion(criterion) ? criterion.evidence : [];
      });
      return [
        ...(comparison.candidate.evidence ?? []),
        ...comparison.identity_verification.evidence,
        ...criterionEvidence,
        ...decision.criticisms.flatMap((criticism) => criticism.evidence),
      ];
    }),
    ...analysis.global_criticisms.flatMap((criticism) => criticism.evidence),
  ];
  return new Map(
    entries
      .filter((entry) => entry.claim.trim().length > 0)
      .map((entry) => [entry.source_reference, entry]),
  );
}

function referenceEvidence(
  criticism: Criticism,
  indexedEvidence: Map<string, Evidence>,
): Evidence[] {
  return criticism.supporting_evidence_references.flatMap((reference) => {
    const entry = indexedEvidence.get(reference);
    return entry ? [entry] : [];
  });
}

function readableCause(cause: string): string {
  const labels: Record<string, string> = {
    affinity_not_outcome_evidence: "Taste affinity is not a commercial outcome",
    brief_constraints_unchecked: "Brief constraints remain unchecked",
    commercial_logistics_missing: "Commercial logistics are unverified",
    conventional_baseline_stronger: "The conventional alternative is better supported",
    cross_source_linkage_unverified: "Qloo and map records are not linked",
    large_radius_locality: "The search radius does not establish city-level fit",
    no_conventional_baseline: "No conventional alternative was verified",
    no_positive_taste_signal: "No positive taste signal was available",
    outside_market: "The candidate is outside the requested market",
    seed_derived_signal: "The result came from supplied seed brands",
    single_source_taste_signal: "The taste signal lacks independent corroboration",
    verification_unverified: "Independent identity or location verification is incomplete",
  };
  return labels[cause] ?? cause.replaceAll("_", " ");
}

function criterionProvenance(
  key: keyof CandidateDecision["candidate"],
  criterion: Criterion,
): Provenance {
  if (key === "complementarity" || key === "goal_alignment") {
    return criterion.evidence.some((entry) => entry.source_type === "ai_interpretation")
      ? "ai_interpretation"
      : "unknown";
  }
  if (key === "taste_affinity") {
    return /Qloo (?:returned|affinity)/i.test(criterion.rationale) ? "qloo" : "unknown";
  }
  if (key === "evidence_relevance") {
    if (/^Qloo returned/i.test(criterion.rationale)) return "qloo";
    if (/OpenStreetMap category data/i.test(criterion.rationale)) return "external";
  }
  if (key === "geographic_logistical_suitability") {
    if (/^Qloo metadata/i.test(criterion.rationale)) return "qloo";
    if (/OpenStreetMap returned|exact-name OSM record was returned/i.test(criterion.rationale)) {
      return "external";
    }
  }
  return "rule_based";
}

function readableLimitation(limitation: string): string {
  const plainLanguage: Record<string, string> = {
    "The conventional baseline comes from OSM category data and has no Qloo taste evidence; it is not a like-for-like taste-affinity comparison.":
      "This same-industry option was found on the map, but it has no comparable taste signal.",
    "Some Qloo candidates could not be independently verified in the target market; they are shown as checks, not recommended candidates.":
      "Some candidates could not be confirmed by an independent map listing, so they are shown for review rather than recommended.",
    "Some complementarity or goal-alignment interpretations are missing or partial; unknowns remain unknown.":
      "Some partner-fit assessments are incomplete; unsupported questions remain unanswered.",
    "An OSM listing verifies only that OpenStreetMap currently returns a matching record; it does not prove ownership or current operation. Qloo and OSM provide no shared identifier, so cross-source entity linkage is unverified.":
      "The map returned a matching listing, but that does not confirm ownership, current operation, or that the taste result and map entry refer to the same business.",
    "The brief did not state an industry, so candidates cannot defensibly be classified as unexpected or used as a same-industry baseline.":
      "The brief does not specify an industry, so Vyuha could not identify outside-industry partners or a same-industry alternative.",
    "Qloo and OSM provide no shared identifier, so cross-source entity linkage is unverified.":
      "We cannot confirm that the taste result and map listing refer to the same business.",
  };
  return (
    plainLanguage[limitation] ??
    limitation
      .replace(/\bOSM\b/g, "map")
      .replace(/cross-source entity linkage/gi, "link between source records")
      .replace(/like-for-like/gi, "directly comparable")
      .replace(/complementarity or goal-alignment interpretations/gi, "partner-fit assessments")
      .replace(/unknowns remain unknown/gi, "unsupported questions remain unanswered")
  );
}

function readableEntityType(value: string): string {
  const parts = value.split(":").filter(Boolean);
  const label = parts[parts.length - 1] || value;
  if (label === "entity") return "Business or place";
  const readable = label.replaceAll("_", " ");
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`;
}

function CandidateCard({
  item,
  baselineWithoutTaste,
  indexedEvidence,
  criticTextSource,
}: {
  item: CandidateDecision;
  baselineWithoutTaste: boolean;
  indexedEvidence: Map<string, Evidence>;
  criticTextSource: Provenance;
}) {
  const comparison = item.candidate;
  const qlooTasteEvidence = comparison.taste_affinity.evidence.find(
    (entry) => entry.source_type === "qloo",
  );
  const nameSource: Provenance =
    comparison.role === "conventional_baseline" &&
    !comparison.identity_verification.evidence.some((entry) => entry.source_type === "qloo")
      ? "external"
      : comparison.candidate.evidence?.[0]?.source_type ?? "qloo";

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SourceTag source={nameSource} />
            {comparison.role === "conventional_baseline" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Conventional baseline
              </span>
            )}
            {comparison.candidate.identity_match_label && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">
                not an exact match
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold tracking-tight">{comparison.candidate.name}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {readableEntityType(comparison.candidate.entity_type)}
            {comparison.candidate.subtype
              ? ` · ${readableEntityType(comparison.candidate.subtype)}`
              : ""}
          </p>
          {qlooTasteEvidence && (
            <p className="mt-3 flex flex-wrap items-start gap-2 text-sm leading-6 text-slate-700">
              <SourceTag source="qloo" />
              <span>
                Why Qloo suggests this: {qlooTasteEvidence.claim} This is a taste signal, not
                evidence of shared customers.
              </span>
            </p>
          )}
        </div>
        <RatingBadge rating={item.final_rating} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-y border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Provisional rating
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RatingBadge rating={item.provisional_rating} />
            <SourceTag source="rule_based" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Final rating
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RatingBadge rating={item.final_rating} />
            <SourceTag source="rule_based" />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold">Decision rationale</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SourceTag source="rule_based" />
          <p
            className="line-clamp-1 text-sm leading-6 text-slate-700"
            title={item.rationale}
          >
            {item.rationale}
          </p>
          {item.final_rating === "SKIP" &&
          comparison.identity_verification.status !== "verified" && (
            <span className="text-sm font-semibold text-slate-800">Skipped: couldn&apos;t verify</span>
          )}
        </div>
        {item.downgrade_causes.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {item.downgrade_causes.map((cause) => (
              <li key={cause}>
                <SourceTag source="rule_based" /> {readableCause(cause)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {baselineWithoutTaste && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          Compared on map verification only; no taste data, so it can&apos;t outrank the others.
        </p>
      )}

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer font-semibold">
          Critic details ({item.criticisms.length})
        </summary>
        {item.criticisms.length ? (
          <ul className="mt-3 space-y-3">
            {item.criticisms.map((criticism, index) => (
              <li className="rounded-lg bg-paper p-3" key={`${criticism.code}-${index}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                      criticism.severity === "high"
                        ? "bg-rose-100 text-rose-900"
                        : criticism.severity === "medium"
                          ? "bg-amber-100 text-amber-950"
                          : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {criticism.severity} severity
                  </span>
                  <SourceTag source={criticTextSource} />
                </div>
                <p className="mt-2 text-sm leading-6">{criticism.issue}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Effect on recommendation: {criticism.effect_on_recommendation}
                </p>
                <div className="mt-3 space-y-3">
                  {referenceEvidence(criticism, indexedEvidence).map((entry, evidenceIndex) => (
                    <EvidenceLine
                      evidence={entry}
                      key={`${entry.source_reference}-${evidenceIndex}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No candidate-specific criticism was returned.
          </p>
        )}
      </details>

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer font-semibold">Evidence by criterion</summary>
        <ul className="mt-3 space-y-3">
          {criteria.map(([key, label]) => {
            const criterion = comparison[key];
            if (typeof criterion !== "object" || !("rationale" in criterion)) return null;
            return (
              <li key={key} className="rounded-lg bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{label}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs capitalize text-slate-700">
                    {criterion.assessment}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <SourceTag source={criterionProvenance(key, criterion)} />
                  <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700">
                    {criterion.rationale}
                  </p>
                </div>
                {criterion.evidence.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {criterion.evidence.map((entry, index) => (
                      <EvidenceLine
                        evidence={entry}
                        key={`${entry.source_reference}-${index}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <SourceTag source="unknown" /> No supporting evidence returned.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </details>

      {comparison.identity_verification.missing_evidence.length > 0 && (
        <p className="mt-4 text-sm leading-6 text-slate-700">
          <span className="font-semibold">Missing information · Unknown:</span>{" "}
          {comparison.identity_verification.missing_evidence.join(" · ")}
        </p>
      )}
    </article>
  );
}

export function AnalysisView({
  state,
  analysis,
  error,
  progress,
  onRetry,
  isSavedRun = false,
}: {
  state: ViewState;
  analysis: Analysis | null;
  error: string | null;
  progress: Map<string, { status: string; message: string }>;
  onRetry?: () => void;
  isSavedRun?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  if (state === "loading") {
    return (
      <section aria-live="polite" className="rounded-xl border border-line bg-white p-6">
        <p className="font-semibold">Analysis in progress</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Waking up the server? Free hosted instances can take up to a minute. The request stays
          open while the service starts.
        </p>
        <ul className="mt-5 space-y-3">
          {stageLabels.map(([stage, label]) => {
            const event = progress.get(stage);
            return (
              <li key={stage} className="flex items-start gap-3 text-sm">
                <span
                  aria-label={event?.status ?? "not started"}
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    event?.status === "complete" || event?.status === "degraded"
                      ? "bg-forest"
                      : event?.status === "running"
                        ? "animate-pulse bg-amber-600"
                        : event?.status === "failed"
                          ? "bg-rose-700"
                          : "bg-slate-300"
                  }`}
                />
                <span>
                  <span className="font-medium">{label}</span>
                  {event && <span className="ml-2 text-slate-600">{event.message}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section role="alert" className="rounded-xl border border-rose-300 bg-white p-6">
        <h2 className="text-lg font-bold">Analysis could not be completed</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {error || "The backend returned an error without further details."}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Check the backend configuration and connection, then try again.
        </p>
        {onRetry && (
          <button
            className="mt-4 rounded-lg bg-forest px-4 py-2 font-semibold text-white hover:bg-emerald-950"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        )}
      </section>
    );
  }

  if (state === "empty" || !analysis || !analysis.candidate_decisions.length) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">No candidates to compare</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          The {isSavedRun ? "saved" : "live"} analysis returned no candidate decisions. Vyuha
          won&apos;t fill the gap with suggestions or estimates.
        </p>
      </section>
    );
  }

  const baseline = analysis.discovery.conventional_baseline;
  const baselineWithoutTaste =
    baseline !== null &&
    !baseline.taste_affinity.evidence.some((entry) => entry.source_type === "qloo");
  const selected = analysis.overall_decision.selected_entity_id;
  const sortedDecisions = [...analysis.candidate_decisions].sort((left, right) => {
    const leftSelected = left.candidate.candidate.entity_id === selected ? 1 : 0;
    const rightSelected = right.candidate.candidate.entity_id === selected ? 1 : 0;
    const leftBaseline = left.candidate.role === "conventional_baseline" ? 1 : 0;
    const rightBaseline = right.candidate.role === "conventional_baseline" ? 1 : 0;
    return rightSelected - leftSelected || rightBaseline - leftBaseline;
  });
  const partial = state === "partial" || analysis.discovery.status === "partial";
  const outreach = analysis.outreach_drafts[0];
  const indexedEvidence = evidenceIndex(analysis);
  const activeDraft = draft ?? (outreach ? `${outreach.subject}\n\n${outreach.body}` : "");
  const criticCuts = analysis.candidate_decisions.filter(
    (decision) => decision.provisional_rating !== "SKIP" && decision.final_rating === "SKIP",
  ).length;
  const recommendedName =
    analysis.overall_decision.selected_candidate_name ?? "No candidate supported";
  const recommendedExperiment = analysis.experiments.find(
    (experiment) => experiment.candidate_name === analysis.overall_decision.selected_candidate_name,
  );
  const nextStep = recommendedExperiment?.next_step.trim() || "No next step was returned.";

  return (
    <div className="space-y-8">
      <section
        aria-label="Verdict"
        className="rounded-xl border border-forest/30 bg-forest p-5 text-white sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Verdict</p>
        <p className="mt-3 text-lg font-bold leading-7 sm:text-xl">
          {analysis.candidate_decisions.length} candidates found · critic cut {criticCuts} ·
          recommended: {recommendedName} ({analysis.overall_decision.result}) · next step: {nextStep}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag source="rule_based" />
          {recommendedExperiment ? (
            <SourceTag source="rule_based" />
          ) : (
            <SourceTag source="unknown" />
          )}
        </div>
        <p className="mt-3 text-xs leading-5 text-emerald-50">
          Candidate and critic counts come from this analysis; a rating is not a probability or
          commercial forecast.
        </p>
      </section>

      <section className="rounded-xl border border-forest/20 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-forest">
            Overall decision
          </span>
          <RatingBadge rating={analysis.overall_decision.result} />
          <SourceTag source="rule_based" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {analysis.overall_decision.selected_candidate_name ?? "No candidate supported"}
        </h2>
        <div className="mt-3 flex max-w-3xl flex-wrap items-start gap-2">
          <SourceTag source="rule_based" />
          <p className="min-w-0 flex-1 leading-7 text-slate-700">
            {analysis.overall_decision.rationale}
          </p>
        </div>
        {partial && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            Partial results: the backend reported limitations. Review what is missing before acting.
          </p>
        )}
        {analysis.discovery.location_query && (
          <p className="mt-4 text-xs leading-5 text-slate-600">
            Location caveat: Qloo used a {analysis.discovery.location_query.radius_miles}-mile
            radius, which is not a city boundary. Affinity is a relative signal from Qloo, not
            customer overlap.
          </p>
        )}
        {baselineWithoutTaste && (
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Compared on map verification only; no taste data, so it can&apos;t outrank the others.
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Candidate comparison
            </p>
          </div>
          <p className="text-xs text-slate-600">
            Affinity: relative signal from Qloo, not customer overlap.
          </p>
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {sortedDecisions.map((item) => (
            <CandidateCard
              baselineWithoutTaste={
                item.candidate.role === "conventional_baseline" && baselineWithoutTaste
              }
              item={item}
              indexedEvidence={indexedEvidence}
              criticTextSource={
                analysis.critic_text_status === "llm" ? "ai_interpretation" : "rule_based"
              }
              key={item.candidate.candidate.entity_id}
            />
          ))}
        </div>
      </section>

      {analysis.global_criticisms.length > 0 && (
        <details className="rounded-xl border border-line bg-white p-5">
          <summary className="cursor-pointer text-xl font-bold">
            Evidence limits across the comparison ({analysis.global_criticisms.length})
          </summary>
          <ul className="mt-4 space-y-4">
            {analysis.global_criticisms.map((criticism, index) => (
              <li className="border-t border-line pt-4" key={`${criticism.code}-${index}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{criticism.severity.toUpperCase()} severity</span>
                  <SourceTag
                    source={
                      analysis.critic_text_status === "llm"
                        ? "ai_interpretation"
                        : "rule_based"
                    }
                  />
                </div>
                <p className="mt-2 text-sm leading-6">{criticism.issue}</p>
                <p className="mt-1 text-sm text-slate-600">{criticism.effect_on_recommendation}</p>
                <div className="mt-3 space-y-3">
                  {referenceEvidence(criticism, indexedEvidence).map((entry, evidenceIndex) => (
                    <EvidenceLine
                      evidence={entry}
                      key={`${entry.source_reference}-${evidenceIndex}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Small experiment</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
              Suggested targets
            </span>
            <SourceTag source="rule_based" />
          </div>
          {analysis.experiments.length ? (
            <ul className="mt-4 space-y-5">
              {analysis.experiments.map((experiment, index) => (
                <li className="border-t border-line pt-4" key={`${experiment.title}-${index}`}>
                  <h3 className="font-semibold">
                    Experiment for {experiment.candidate_name}: {experiment.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{experiment.description}</p>
                  <p className="mt-3 text-sm">
                    Format: {experiment.test_format}
                  </p>
                  <p className="mt-3 text-sm">
                    Duration:{" "}
                    {experiment.duration_days === null
                      ? "Not specified in the brief; verify with the candidate."
                      : `${experiment.duration_days} ${
                          experiment.duration_days === 1 ? "day" : "days"
                        }, from the brief`}
                  </p>
                  {experiment.event_structure.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {experiment.event_structure.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-sm font-semibold">Costs to verify before commitment</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                    {experiment.costs_to_verify.map((cost) => (
                      <li key={cost}>{cost}</li>
                    ))}
                  </ul>
                  {experiment.budget && (
                    <p className="mt-3 text-sm">
                      Suggested test budget: {experiment.budget.minimum}–
                      {experiment.budget.maximum} {experiment.budget.currency}
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-6">
                    <span className="font-semibold">Next step: </span>
                    {experiment.next_step}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-700">
              No experiment plan was returned for this analysis.
            </p>
          )}
        </article>

        <article className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">
              Outreach draft{outreach?.recipient_name ? ` for ${outreach.recipient_name}` : ""}
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
              Unsent draft
            </span>
            <SourceTag source="ai_interpretation" />
          </div>
          {outreach ? (
            <>
              <label className="sr-only" htmlFor="outreach-draft">
                Editable outreach draft
              </label>
              <textarea
                className="mt-4 min-h-64 w-full resize-y rounded-lg border border-line bg-paper p-3 text-sm leading-6"
                id="outreach-draft"
                onChange={(event) => setDraft(event.target.value)}
                value={activeDraft}
              />
              <button
                className="mt-3 rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-moss"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activeDraft);
                    setCopyStatus("Draft copied.");
                  } catch {
                    setCopyStatus("Copy failed. Select and copy the draft manually.");
                  }
                }}
                type="button"
              >
                Copy draft
              </button>
              <p aria-live="polite" className="mt-2 text-sm text-slate-600">
                {copyStatus || "Unsent draft — review and verify every detail before contacting."}
              </p>
              {outreach.facts_not_verified.length > 0 && (
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  <SourceTag source="unknown" /> Not verified: {outreach.facts_not_verified.join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-700">No outreach draft was returned.</p>
          )}
        </article>
      </section>

      {(analysis.discovery.limitations.length > 0 ||
        analysis.discovery.business_identity.limitations.length > 0) && (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">What remains unknown</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {[
              ...analysis.discovery.limitations,
              ...analysis.discovery.business_identity.limitations,
            ].map((limitation, index) => (
              <li key={`${limitation}-${index}`}>
                <SourceTag source="unknown" /> {readableLimitation(limitation)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

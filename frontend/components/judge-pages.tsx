"use client";

import { useState } from "react";
import { SourceTag } from "@/components/evidence";
import demoDefinitions from "@/lib/demo-definitions.json";
import type {
  Analysis,
  CandidateDecision,
  Criterion,
  Evidence,
  SavedRun,
  TraceStep,
} from "@/lib/contracts";

type Demo = (typeof demoDefinitions)[number];

const criterionKeys = [
  "evidence_relevance",
  "taste_affinity",
  "complementarity",
  "competition",
  "geographic_logistical_suitability",
  "budget_compatibility",
  "goal_alignment",
  "uncertainty",
] as const;

function decisionsFor(analysis: Analysis): CandidateDecision[] {
  const selected = analysis.overall_decision.selected_entity_id;
  return [...analysis.candidate_decisions].sort(
    (left, right) =>
      Number(right.candidate.candidate.entity_id === selected) -
      Number(left.candidate.candidate.entity_id === selected),
  );
}

function partnerReason(item: CandidateDecision): string {
  const criteria = [
    item.candidate.taste_affinity,
    item.candidate.evidence_relevance,
    item.candidate.complementarity,
    item.candidate.geographic_logistical_suitability,
    item.candidate.budget_compatibility,
    item.candidate.goal_alignment,
  ];
  const supported = criteria.find(
    (criterion) =>
      (criterion.assessment === "supported" || criterion.assessment === "partial") &&
      criterion.rationale.trim() &&
      criterion.evidence.length > 0,
  );
  return supported?.rationale || "No positive reason with supporting evidence was returned.";
}

function partnerRisk(item: CandidateDecision): string {
  return (
    item.criticisms[0]?.issue ||
    item.candidate.uncertainty.rationale ||
    "Costs, availability, and current operation still need confirmation."
  );
}

function ratingLabel(rating: CandidateDecision["final_rating"]): string {
  if (rating === "STRONG FIT") return "Good signal — still test";
  if (rating === "WORTH TESTING") return "Worth testing";
  return "Skip";
}

function isCriterion(value: unknown): value is Criterion {
  return (
    value !== null &&
    typeof value === "object" &&
    "evidence" in value &&
    Array.isArray(value.evidence)
  );
}

function evidenceFor(item: CandidateDecision): Evidence[] {
  const comparison = item.candidate;
  const evidence = [
    ...(comparison.candidate.evidence ?? []),
    ...comparison.identity_verification.evidence,
    ...criterionKeys.flatMap((key) => {
      const criterion = comparison[key];
      return isCriterion(criterion) ? criterion.evidence : [];
    }),
    ...item.criticisms.flatMap((criticism) => criticism.evidence),
  ];
  return [...new Map(evidence.map((entry) => [`${entry.source_reference}:${entry.claim}`, entry])).values()];
}

function allEvidence(analysis: Analysis): Evidence[] {
  const entries = [
    ...analysis.discovery.business_identity.evidence,
    ...analysis.discovery.candidate_checks.flatMap((check) => check.evidence),
    ...analysis.candidate_decisions.flatMap(evidenceFor),
    ...analysis.global_criticisms.flatMap((criticism) => criticism.evidence),
  ];
  return [
    ...new Map(entries.map((entry) => [`${entry.source_reference}:${entry.claim}`, entry])).values(),
  ];
}

function mapFacts(item: CandidateDecision): Evidence[] {
  return evidenceFor(item).filter(
    (entry) =>
      entry.source_type === "external" ||
      /openstreetmap|nominatim|map verification/i.test(
      `${entry.source_reference} ${entry.claim}`,
      ),
  );
}

function detailRouteId(route: string): string | null {
  const prefix = "/result/partners/";
  if (!route.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(route.slice(prefix.length));
  } catch {
    return null;
  }
}

function actionButtonClass(primary = false): string {
  return primary
    ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-950"
    : "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest hover:bg-paper";
}

export function HomePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
          Partnership decisions for small businesses
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Small businesses guess who to partner with. Vyuha uses Qloo&apos;s taste signals to find
          unexpected partner options, then challenges its own pick before you risk money on a
          collaboration.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
          Qloo&apos;s taste clues help surface ideas worth testing; Vyuha checks the evidence,
          challenges its pick, and proposes a small experiment without claiming shared customers.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            className={actionButtonClass(true)}
            onClick={() => onNavigate("/demos")}
            type="button"
          >
            Try a demo
          </button>
          <button
            className={actionButtonClass()}
            onClick={() => onNavigate("/analyze")}
            type="button"
          >
            Try your own business
          </button>
        </div>
      </div>

      <ol
        aria-label="How Vyuha works"
        className="mt-10 grid gap-3 md:grid-cols-3"
      >
        {[
          ["①", "You describe your business", "Tell Vyuha who you are, where you work, and what you want to try."],
          ["②", "Vyuha checks Qloo taste data", "Qloo helps find possible partners from another category."],
          ["③", "Vyuha argues back", "It checks risks and gives you a low-cost idea to test first."],
        ].map(([icon, title, text]) => (
          <li className="rounded-xl border border-line bg-white p-5" key={title}>
            <span aria-hidden="true" className="text-2xl font-bold text-forest">{icon}</span>
            <h2 className="mt-2 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm font-semibold text-slate-700">
        Powered by Qloo taste data · Groq (primary) with Mistral (fallback) · Every claim shows where it came from
      </p>

      <section className="mt-8 rounded-xl border border-line bg-white p-5 sm:p-7">
        <h2 className="text-lg font-bold">What Vyuha will never claim</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Qloo&apos;s taste signals do not prove shared customers or purchase intent. A map listing
          does not confirm ownership or availability. No partner is guaranteed to succeed.
        </p>
      </section>
    </section>
  );
}

export function DemoGallery({
  savedRuns,
  savedRunsLoading,
  onRun,
  onViewSaved,
}: {
  savedRuns: Partial<Record<string, SavedRun>>;
  savedRunsLoading: boolean;
  onRun: (demo: Demo) => void;
  onViewSaved: (id: Demo["id"]) => void;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Demo gallery</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Pick a business to explore</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
        Each demo can run against live services. If the live run is unavailable, a dated saved
        result is clearly marked as not live.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {demoDefinitions.map((demo) => {
          const saved = savedRuns[demo.id];
          const city = demo.input.city || "City not specified";
          const expected = `${demo.input.industry || "Local business"} in ${city} looking for a pop-up partner.`;
          return (
            <li className="flex min-w-0 flex-col rounded-xl border border-line bg-white p-5" key={demo.id}>
              <h2 className="text-lg font-bold">{demo.input.business_name}</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">{city}</p>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-700">{expected}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={actionButtonClass(true)}
                  onClick={() => onRun(demo)}
                  type="button"
                >
                  Run live
                </button>
                {saved ? (
                  <button
                    className={actionButtonClass()}
                    onClick={() => onViewSaved(demo.id)}
                    type="button"
                  >
                    View saved result (not live)
                  </button>
                ) : savedRunsLoading ? (
                  <span className="flex min-h-11 items-center text-xs text-slate-600">
                    Checking for a saved result…
                  </span>
                ) : (
                  <span className="flex min-h-11 items-center text-xs text-slate-600">
                    No saved result is available
                  </span>
                )}
              </div>
              {saved && (
                <p className="mt-2 text-xs text-slate-600">
                  Saved capture: {new Date(saved.captured_at).toLocaleDateString()}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function VerdictPage({
  analysis,
  isSavedRun,
  onNavigate,
}: {
  analysis: Analysis | null;
  isSavedRun: boolean;
  onNavigate: (path: string) => void;
}) {
  if (!analysis) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold">No result to show yet</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Run a live brief or open a saved demo to see a result based on real analysis data.
        </p>
        <button className={`${actionButtonClass(true)} mt-5`} onClick={() => onNavigate("/demos")} type="button">
          Choose a demo
        </button>
      </section>
    );
  }

  const decisions = decisionsFor(analysis);
  const selectedId = analysis.overall_decision.selected_entity_id;
  const selected = decisions.find((item) => item.candidate.candidate.entity_id === selectedId);
  const name = analysis.overall_decision.selected_candidate_name;
  const recommended = Boolean(selected && name && analysis.overall_decision.result !== "no candidate supported");
  const checked = analysis.candidate_decisions.length;
  const rejected = analysis.candidate_decisions.filter(
    (item) => item.provisional_rating !== "SKIP" && item.final_rating === "SKIP",
  ).length;
  const experiment = analysis.experiments.find((item) => item.candidate_name === name);
  const bestReason = selected ? partnerReason(selected) : "No possible partner passed the minimum evidence checks.";
  const mainRisk = selected ? partnerRisk(selected) : "The available evidence was not strong enough to recommend a partner.";
  const firstTest = experiment?.next_step || experiment?.description || "No test plan was returned for this result; do not spend until a small, feasible test is agreed.";

  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      {isSavedRun && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Saved result — not live
        </p>
      )}
      <article className="rounded-2xl border border-forest/20 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-forest">Vyuha&apos;s decision</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {recommended ? `Vyuha recommends testing ${name}` : "Vyuha says no safe partner found"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {recommended
            ? "A suggestion to test with care, not a promise of commercial success."
            : "Vyuha refuses to guess when the evidence does not support a safe recommendation."}
        </p>
        <ul className="mt-6 space-y-4">
          <li className="rounded-lg bg-paper p-4">
            <h2 className="font-bold">✅ Best reason</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">{bestReason}</p>
          </li>
          <li className="rounded-lg bg-paper p-4">
            <h2 className="font-bold">⚠️ Biggest risk</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">{mainRisk}</p>
          </li>
          <li className="rounded-lg bg-paper p-4">
            <h2 className="font-bold">🧪 The cheap test to run first</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">{firstTest}</p>
          </li>
        </ul>
        <p className="mt-5 text-sm text-slate-700">
          Why trust this? {checked} {checked === 1 ? "partner checked" : "partners checked"} · {rejected} rejected by the devil&apos;s advocate.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Qloo supplied taste clues for discovery. Taste affinity is not proof that the businesses share customers.
        </p>
        {analysis.discovery.status === "partial" && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            This is a partial result. Some checks could not be completed; review the evidence before acting.
          </p>
        )}
      </article>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className={actionButtonClass(true)} onClick={() => onNavigate("/result/partners")} type="button">
          See the top 3 partners
        </button>
        <button className={actionButtonClass()} onClick={() => onNavigate("/result/evidence")} type="button">
          How did Vyuha decide?
        </button>
      </div>
    </section>
  );
}

export function PartnersPage({
  analysis,
  onNavigate,
}: {
  analysis: Analysis | null;
  onNavigate: (path: string) => void;
}) {
  if (!analysis) return <NoAnalysis onNavigate={onNavigate} />;
  const decisions = decisionsFor(analysis);
  const ratingRank = { "STRONG FIT": 0, "WORTH TESTING": 1, SKIP: 2 };
  const qlooDecisions = decisions
    .filter((item) => item.candidate.candidate.discovery_basis !== "osm_category_baseline")
    .sort((left, right) => ratingRank[left.final_rating] - ratingRank[right.final_rating]);
  const top = qlooDecisions.slice(0, 3);
  const others = [...qlooDecisions.slice(3), ...decisions.filter(
    (item) => item.candidate.candidate.discovery_basis === "osm_category_baseline",
  )];

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Possible partners</p>
      <h1 className="mt-2 text-3xl font-bold">The top {top.length} to review</h1>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        A rating is a prompt for what to do next, not a promise of commercial success.
        <span className="mt-1 block">Good signal — still test · Worth testing · Skip</span>
      </p>
      {top.length ? (
        <ol className="mt-5 space-y-3">
          {top.map((item, index) => {
            const partner = item.candidate.candidate;
            return (
              <li key={partner.entity_id}>
                <button
                  className="w-full rounded-xl border border-line bg-white p-5 text-left hover:border-forest focus-visible:outline-forest"
                  onClick={() => onNavigate(`/result/partners/${encodeURIComponent(partner.entity_id)}`)}
                  type="button"
                >
                  <span className="flex flex-wrap items-start justify-between gap-3">
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                        Possible partner {index + 1}
                      </span>
                      <span className="mt-1 block break-words text-xl font-bold">{partner.name}</span>
                    </span>
                    <span className="rounded-full bg-moss px-3 py-1 text-xs font-bold text-forest">
                      {ratingLabel(item.final_rating)}
                    </span>
                  </span>
                  <span className="mt-4 block text-sm leading-6 text-slate-700">
                    <strong>Why it may work:</strong> {partnerReason(item)}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-700">
                    <strong>What could go wrong:</strong> {partnerRisk(item)}
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-forest">See partner details →</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-5 rounded-lg border border-line bg-white p-5 text-sm leading-6 text-slate-700">
          No Qloo-supported possible partners were returned. Vyuha will not invent a shortlist.
        </p>
      )}
      {others.length > 0 && (
        <details className="mt-5 rounded-xl border border-line bg-white p-5">
          <summary className="cursor-pointer font-semibold">Other places we checked ({others.length})</summary>
          <ul className="mt-3 space-y-2">
            {others.map((item) => (
              <li key={item.candidate.candidate.entity_id}>
                <button
                  className="w-full rounded-lg border border-line p-3 text-left text-sm hover:bg-paper"
                  onClick={() => onNavigate(`/result/partners/${encodeURIComponent(item.candidate.candidate.entity_id)}`)}
                  type="button"
                >
                  <span className="font-semibold">{item.candidate.candidate.name}</span>
                  <span className="ml-2 text-slate-600">{ratingLabel(item.final_rating)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function NoAnalysis({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <h1 className="text-3xl font-bold">No result to show yet</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Start a live analysis or choose a saved demo result.
      </p>
      <button className={`${actionButtonClass(true)} mt-5`} onClick={() => onNavigate("/demos")} type="button">
        Choose a demo
      </button>
    </section>
  );
}

export function PartnerDetailPage({
  analysis,
  route,
  isSavedRun,
  onNavigate,
}: {
  analysis: Analysis | null;
  route: string;
  isSavedRun: boolean;
  onNavigate: (path: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  if (!analysis) return <NoAnalysis onNavigate={onNavigate} />;
  const id = detailRouteId(route);
  const item = analysis.candidate_decisions.find(
    (decision) => decision.candidate.candidate.entity_id === id,
  );
  if (!item) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold">Partner details are unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          This partner was not part of the current result. Return to the list and choose a partner from this run.
        </p>
      </section>
    );
  }
  const partner = item.candidate.candidate;
  const experiment = analysis.experiments.find((entry) => entry.candidate_name === partner.name);
  const outreach = analysis.outreach_drafts.find((entry) => entry.recipient_name === partner.name);
  const mapEvidence = mapFacts(item);
  const currentMessage = message ?? (outreach ? `${outreach.subject}\n\n${outreach.body}` : "");
  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      {isSavedRun && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Saved result — not live
        </p>
      )}
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Possible partner</p>
      <h1 className="mt-2 break-words text-3xl font-bold">{partner.name}</h1>
      <p className="mt-2 text-sm font-semibold text-slate-700">{ratingLabel(item.final_rating)}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Why this could work</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {partnerReason(item)}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Qloo taste signals are not proof of shared customers.
          </p>
        </article>
        <article className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">What could go wrong</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {item.criticisms[0]?.issue || partnerRisk(item)}
          </p>
          {item.criticisms.length > 1 && (
            <details className="mt-3 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Other concerns ({item.criticisms.length - 1})
              </summary>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                {item.criticisms.slice(1).map((criticism, index) => (
                  <li key={`${criticism.code}-${index}`}>{criticism.issue}</li>
                ))}
              </ul>
            </details>
          )}
          {item.candidate.identity_verification.missing_evidence.length > 0 && (
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Still to confirm: {item.candidate.identity_verification.missing_evidence.join(", ")}.
            </p>
          )}
        </article>
      </div>

      <button
        className={`${actionButtonClass()} mt-4`}
        onClick={() => onNavigate("/result/evidence")}
        type="button"
      >
        See full evidence
      </button>

      {experiment && (
        <article className="mt-4 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">A small experiment to try</h2>
          <h3 className="mt-2 font-semibold">{experiment.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{experiment.description}</p>
          {experiment.budget && (
            <p className="mt-2 text-sm text-slate-700">
              Suggested budget from this run: {experiment.budget.minimum}–{experiment.budget.maximum} {experiment.budget.currency}
            </p>
          )}
          {experiment.costs_to_verify.length > 0 && (
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Check these costs first: {experiment.costs_to_verify.join("; ")}.
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-slate-700">
            <strong>First step:</strong> {experiment.next_step}
          </p>
        </article>
      )}

      {outreach && (
        <details className="mt-4 rounded-xl border border-line bg-white p-5">
          <summary className="cursor-pointer font-semibold">
            Edit the unsent outreach message
          </summary>
          <textarea
            aria-label="Editable unsent outreach message"
            className="mt-3 min-h-48 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-6"
            onChange={(event) => setMessage(event.target.value)}
            value={currentMessage}
          />
          {outreach.facts_not_verified.length > 0 && (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Verify before sending: {outreach.facts_not_verified.join("; ")}.
            </p>
          )}
        </details>
      )}

      <details className="mt-4 rounded-xl border border-line bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          {mapEvidence.length} map-verified {mapEvidence.length === 1 ? "fact" : "facts"}
        </summary>
        {mapEvidence.length ? (
          <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            {mapEvidence.map((entry) => (
              <li className="border-t border-line pt-3" key={`${entry.source_reference}-${entry.claim}`}>
                <SourceTag source="external" /> <span className="ml-2">{entry.claim}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-700">No map facts were returned for this possible partner.</p>
        )}
      </details>
    </section>
  );
}

export function EvidencePage({
  analysis,
  trace,
  isSavedRun,
  onNavigate,
}: {
  analysis: Analysis | null;
  trace: TraceStep[];
  isSavedRun: boolean;
  onNavigate: (path: string) => void;
}) {
  if (!analysis) return <NoAnalysis onNavigate={onNavigate} />;
  const evidence = allEvidence(analysis);
  const sentences: Record<string, string> = {
    Plan: "The workflow sets up the checks for this business brief.",
    "Qloo search": "Qloo looks up the business and possible partner entities.",
    "Qloo insights": "Qloo returns cross-category taste signals used to find possible partners.",
    "Map verification": "Map data is checked for local listings; a listing does not prove ownership.",
    Compare: "The available evidence is compared against the brief and a conventional alternative where available.",
    Critic: "The devil's advocate looks for evidence that weakens or rules out each pick.",
    Decision: "Fixed decision rules choose what to test or refuse to guess.",
  };
  const provenance = [
    ["qloo", "From Qloo"],
    ["external", "From map data"],
    ["ai_interpretation", "AI interpretation"],
    ["unknown", "Not known or not verified"],
  ] as const;

  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      {isSavedRun && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Saved result — not live</p>}
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Decision details</p>
      <h1 className="mt-2 text-3xl font-bold">How Vyuha decided</h1>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Qloo provides cross-category taste clues. Vyuha checks local listings, compares the evidence,
        and uses fixed rules to decide whether any partner is safe to test.
      </p>
      <details className="mt-5 rounded-xl border border-line bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          See the agent steps{trace.length ? ` (${trace.length})` : ""}
        </summary>
        <ol className="mt-4 space-y-2">
          {trace.length ? trace.map((step) => (
            <li className="rounded-xl border border-line bg-paper p-4" key={step.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">{step.name === "Critic" ? "Devil's advocate" : step.name}</h2>
                <span className="text-xs text-slate-600">
                  {step.duration_ms === null ? "Timing not returned" : `${step.duration_ms} ms`}
                  {step.result_count !== null && step.name !== "Plan" ? ` · ${step.result_count} results or checks` : ""}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {sentences[step.name] || "This step used the returned data for this analysis."}
              </p>
            </li>
          )) : (
            <li className="text-sm leading-6 text-slate-700">
              No step timing was returned for this result. The decision and evidence below come from the analysis result.
            </li>
          )}
        </ol>
      </details>

      <section className="mt-6 rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Where the information came from</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {provenance.map(([source, label]) => (
            <li className="flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-xs font-semibold" key={source}>
              <SourceTag source={source} />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-xs font-semibold">
            <span className="rounded-full border border-slate-500/20 bg-slate-100 px-2 py-0.5 text-slate-800">
              Rule-based decision
            </span>
            Fixed decision rules
          </li>
        </ul>
        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer font-semibold">See full evidence ({evidence.length})</summary>
          <ul className="mt-4 space-y-4">
            {evidence.length ? evidence.map((entry, index) => (
              <li className="border-t border-line pt-3" key={`${entry.source_reference}-${index}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <SourceTag source={entry.source_type} />
                  <span className="text-xs text-slate-600">{sourceLabel(entry.source_type)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{entry.claim}</p>
              </li>
            )) : (
              <li className="text-sm leading-6 text-slate-700">No evidence claims were returned.</li>
            )}
          </ul>
        </details>
      </section>
    </section>
  );
}

function sourceLabel(source: Evidence["source_type"]): string {
  if (source === "qloo") return "From Qloo";
  if (source === "external") return "From map or external data";
  if (source === "ai_interpretation") return "AI interpretation";
  return "Source not established";
}

export function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-forest">About Vyuha</p>
      <h1 className="mt-2 text-3xl font-bold">A safer way to choose a small-business partner</h1>
      <div className="mt-5 space-y-5 rounded-xl border border-line bg-white p-5 sm:p-7">
        <section>
          <h2 className="font-bold">The problem</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Independent businesses often have to guess whether a pop-up or collaboration partner is
            worth their limited time and budget. Vyuha looks for unexpected partners, then tries to
            find reasons not to recommend them.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Who it is for</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Independent brands and local businesses planning pop-ups, events, and small collaborations.
          </p>
        </section>
        <section>
          <h2 className="font-bold">What Qloo contributes</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Vyuha uses Qloo&apos;s business lookup and{" "}
            <span title="Qloo's tool for finding taste connections across different kinds of businesses">
              cross-category Insights
            </span>{" "}
            to find taste connections between a business and possible partners. These clues do not
            prove that customers overlap or intend to buy.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Technology</h2>
          <p className="mt-1 flex flex-wrap gap-x-1 text-sm leading-6 text-slate-700">
            <span title="Python web framework for the backend API">FastAPI</span> ·{" "}
            <span title="Framework that coordinates the agent's workflow steps">LangGraph</span> ·{" "}
            <span title="React framework used for the website">Next.js</span> ·{" "}
            <span title="Primary language model service">Groq (primary)</span> with{" "}
            <span title="Backup language model service if Groq is unavailable">Mistral (fallback)</span> ·{" "}
            <span title="Hosts the backend API">Render</span> ·{" "}
            <span title="Hosts the website">Vercel</span>
          </p>
        </section>
        <section>
          <h2 className="font-bold">Evaluation set counts</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Saved analyses captured October 18, 2026: 5 runs · 2 cases where Vyuha said no · 15 partners
            downgraded by the devil&apos;s advocate · 0 claims without a source reference.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Counts describe this fixed saved set only; they are not performance estimates.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Limitations</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Taste affinity is not shared customers, demand, or purchase intent.</li>
            <li>A map result does not prove ownership, current operation, costs, or availability.</li>
            <li>Vyuha can return partial results or refuse to recommend anyone.</li>
          </ul>
        </section>
        <a
          className="inline-flex min-h-11 items-center font-semibold text-forest underline"
          href="https://github.com/Abirami-2743/vyuha"
          rel="noreferrer"
          target="_blank"
        >
          View the Vyuha source on GitHub
        </a>
        <section>
          <h2 className="font-bold">What Vyuha will never claim</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            It will not invent evidence, promise a successful collab, or treat a taste signal as proof
            of shared customers.
          </p>
        </section>
      </div>
    </section>
  );
}

export function RoutedJudgePage({
  route,
  analysis,
  trace,
  savedRuns,
  savedRunsLoading,
  isSavedRun,
  onNavigate,
  onRun,
  onViewSaved,
}: {
  route: string;
  analysis: Analysis | null;
  trace: TraceStep[];
  savedRuns: Partial<Record<string, SavedRun>>;
  savedRunsLoading: boolean;
  isSavedRun: boolean;
  onNavigate: (path: string) => void;
  onRun: (demo: Demo) => void;
  onViewSaved: (id: Demo["id"]) => void;
}) {
  if (route === "/") return <HomePage onNavigate={onNavigate} />;
  if (route === "/demos") {
    return <DemoGallery savedRuns={savedRuns} savedRunsLoading={savedRunsLoading} onRun={onRun} onViewSaved={onViewSaved} />;
  }
  if (route === "/about") return <AboutPage />;
  if (route === "/result") return <VerdictPage analysis={analysis} isSavedRun={isSavedRun} onNavigate={onNavigate} />;
  if (route === "/result/partners") return <PartnersPage analysis={analysis} onNavigate={onNavigate} />;
  if (route.startsWith("/result/partners/")) {
    return <PartnerDetailPage analysis={analysis} route={route} isSavedRun={isSavedRun} onNavigate={onNavigate} />;
  }
  if (route === "/result/evidence") return <EvidencePage analysis={analysis} trace={trace} isSavedRun={isSavedRun} onNavigate={onNavigate} />;
  return null;
}

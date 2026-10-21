"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { SourceTag } from "@/components/evidence";
import { SavedRunBanner } from "@/components/saved-run-banner";
import { analyze, checkApi, getSavedRun } from "@/lib/api";
import demoDefinitions from "@/lib/demo-definitions.json";
import type {
  Analysis,
  DiscoveryRequest,
  Place,
  ProgressEvent,
  SavedRun,
  StageEvent,
  TraceStep,
} from "@/lib/contracts";

type Screen = "landing" | "brief" | "analysis";
type DemoId = (typeof demoDefinitions)[number]["id"];
type ChoiceState = {
  osm: Place | null;
  qlooEntityId: string;
  seedIds: Record<string, string>;
};

const initialBrief = {
  businessName: "",
  industry: "",
  city: "",
  targetMarket: "",
  website: "",
  identifyingInfo: "",
  goal: "",
  budgetMin: "0",
  budgetMax: "500",
  requirements: "",
  constraints: "",
  seeds: "",
};

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function placeLabel(place: Place): string {
  return `${place.name} — ${place.display_name}`;
}

function ChoicePanel({
  analysis,
  request,
  onSubmit,
  onEdit,
  submitting,
}: {
  analysis: Analysis;
  request: DiscoveryRequest;
  onSubmit: (nextRequest: DiscoveryRequest) => void;
  onEdit: () => void;
  submitting: boolean;
}) {
  const identity = analysis.discovery.business_identity;
  const requiresOsm =
    identity.osm_status === "ambiguous" || identity.osm_status === "selection_invalid";
  const requiresQloo =
    identity.qloo_status === "ambiguous" || identity.qloo_status === "selection_invalid";
  const pendingSeeds = identity.seed_resolutions.filter(
    (resolution) => resolution.status === "needs_user_choice",
  );
  const [choice, setChoice] = useState<ChoiceState>({
    osm: null,
    qlooEntityId: "",
    seedIds: {},
  });
  const missingRequiredChoice =
    (requiresOsm && identity.osm_options.length > 0 && !choice.osm) ||
    (requiresQloo && identity.qloo_options.length > 0 && !choice.qlooEntityId) ||
    pendingSeeds.some((resolution) => !choice.seedIds[resolution.query]);
  const hasOptions =
    identity.osm_options.length > 0 ||
    identity.qloo_options.length > 0 ||
    pendingSeeds.some((resolution) => resolution.options.length > 0);

  function submitChoices() {
    if (missingRequiredChoice || !hasOptions) return;
    const nextRequest: DiscoveryRequest = { ...request };
    if (choice.osm) {
      nextRequest.selected_osm_type = choice.osm.osm_type;
      nextRequest.selected_osm_id = choice.osm.osm_id;
    }
    if (choice.qlooEntityId) nextRequest.selected_qloo_entity_id = choice.qlooEntityId;
    nextRequest.seed_brands = request.seed_brands.map((seed) => {
      const selectedId = choice.seedIds[seed.name];
      return selectedId ? { ...seed, selected_entity_id: selectedId } : seed;
    });
    onSubmit(nextRequest);
  }

  return (
    <section className="rounded-xl border border-amber-300 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-900">
        More information needed
      </p>
      <h2 className="mt-2 text-2xl font-bold">Choose the correct identity</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
        The backend found more than one possible match. Select only a record you recognize. Your
        selection will be sent back with the exact identifier returned by the backend.
      </p>
      {!hasOptions && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          The backend needs a choice but returned no selectable records. Revise the identifying
          information or seed brands and try again.
        </p>
      )}

      {requiresOsm && identity.osm_options.length > 0 && (
        <fieldset className="mt-5">
          <legend className="font-semibold">Business location · External (map)</legend>
          <div className="mt-2 space-y-2">
            {identity.osm_options.map((place) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-paper"
                key={`${place.osm_type}-${place.osm_id}`}
              >
                <input
                  checked={choice.osm?.osm_id === place.osm_id && choice.osm.osm_type === place.osm_type}
                  name="osm-option"
                  onChange={() => setChoice((current) => ({ ...current, osm: place }))}
                  type="radio"
                />
                <span>{placeLabel(place)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {requiresQloo && identity.qloo_options.length > 0 && (
        <fieldset className="mt-5">
          <legend className="font-semibold">Qloo business match · Qloo evidence</legend>
          <div className="mt-2 space-y-2">
            {identity.qloo_options.map((candidate) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-paper"
                key={candidate.entity_id}
              >
                <input
                  checked={choice.qlooEntityId === candidate.entity_id}
                  name="qloo-option"
                  onChange={() =>
                    setChoice((current) => ({ ...current, qlooEntityId: candidate.entity_id }))
                  }
                  type="radio"
                />
                <span>
                  <span className="font-semibold">{candidate.name}</span>
                  {candidate.identity_match_label && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
                      not an exact match
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-slate-600">{candidate.entity_type}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {pendingSeeds.map((resolution) => (
        <fieldset className="mt-5" key={resolution.query}>
          <legend className="font-semibold">
            Customer-liked brand: {resolution.query} · Qloo
          </legend>
          <div className="mt-2 space-y-2">
            {resolution.options.map((candidate) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-paper"
                key={candidate.entity_id}
              >
                <input
                  checked={choice.seedIds[resolution.query] === candidate.entity_id}
                  name={`seed-${resolution.query}`}
                  onChange={() =>
                    setChoice((current) => ({
                      ...current,
                      seedIds: { ...current.seedIds, [resolution.query]: candidate.entity_id },
                    }))
                  }
                  type="radio"
                />
                <span>
                  <span className="font-semibold">{candidate.name}</span>
                  {candidate.identity_match_label && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
                      not an exact match
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-slate-600">{candidate.entity_type}</span>
                </span>
              </label>
            ))}
            {!resolution.options.length && (
              <p className="text-sm text-slate-600">No Qloo match options were returned.</p>
            )}
          </div>
        </fieldset>
      ))}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting || missingRequiredChoice || !hasOptions}
          onClick={submitChoices}
          type="button"
        >
          {submitting ? "Resubmitting…" : "Continue with selected records"}
        </button>
        <button
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold hover:bg-paper"
          onClick={onEdit}
          type="button"
        >
          Revise brief
        </button>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {identity.limitations.map((limitation) => (
          <li key={limitation}>
            <SourceTag source="unknown" /> {limitation}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [apiMessage, setApiMessage] = useState("");
  const [form, setForm] = useState(initialBrief);
  const [formError, setFormError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [savedRun, setSavedRun] = useState<SavedRun | null>(null);
  const [savedRuns, setSavedRuns] = useState<Partial<Record<DemoId, SavedRun>>>({});
  const [savedRunsLoading, setSavedRunsLoading] = useState(true);
  const [activeSavedRun, setActiveSavedRun] = useState<SavedRun | null>(null);
  const [activeDemoId, setActiveDemoId] = useState<DemoId | null>(null);
  const [analysisIsSaved, setAnalysisIsSaved] = useState(false);
  const [progress, setProgress] = useState<Map<string, ProgressEvent>>(new Map());
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthCheckWakingUp, setHealthCheckWakingUp] = useState(false);
  const [analysisWakingUp, setAnalysisWakingUp] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<DiscoveryRequest | null>(null);
  const analysisInFlight = useRef(false);

  const checkBackend = useCallback(async () => {
    setApiReady(null);
    setApiMessage("");
    setHealthCheckWakingUp(false);
    const wakingTimeoutId = window.setTimeout(() => setHealthCheckWakingUp(true), 5_000);
    try {
      await checkApi();
      setApiReady(true);
    } catch (error) {
      setApiReady(false);
      setApiMessage(
        error instanceof TypeError
          ? "The backend could not be reached. Check that it is running and that the API URL is correct."
          : error instanceof Error
            ? error.message
            : "Backend health check could not be completed.",
      );
    } finally {
      window.clearTimeout(wakingTimeoutId);
      setHealthCheckWakingUp(false);
    }
  }, []);

  useEffect(() => {
    if (screen !== "landing") return;
    const checkTimerId = window.setTimeout(() => void checkBackend(), 0);
    return () => window.clearTimeout(checkTimerId);
  }, [screen, checkBackend]);

  useEffect(() => {
    let mounted = true;
    void Promise.all(
      demoDefinitions.map(async ({ id }) => {
        try {
          return [id, await getSavedRun(id)] as const;
        } catch (error: unknown) {
          console.error("saved_demo_run_load_failed", {
            event: "saved_demo_run_load_failed",
            demo_id: id,
            exception_type: error instanceof Error ? error.name : "UnknownError",
          });
          return [id, null] as const;
        }
      }),
    ).then((runs) => {
      if (!mounted) return;
      const available: Partial<Record<DemoId, SavedRun>> = {};
      for (const [id, run] of runs) {
        if (run) available[id] = run;
      }
      setSavedRuns(available);
      setSavedRunsLoading(false);
    });
    void getSavedRun()
      .then((run) => {
        if (mounted && run) setSavedRun(run);
      })
      .catch((error: unknown) => {
        if (mounted) {
          console.error("saved_run_load_failed", {
            event: "saved_run_load_failed",
            exception_type: error instanceof Error ? error.name : "UnknownError",
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const submitAnalysis = useCallback(async (request: DiscoveryRequest, demoId?: DemoId) => {
    if (analysisInFlight.current) return;
    analysisInFlight.current = true;
    setActiveDemoId(demoId ?? null);
    setCurrentRequest(request);
    setScreen("analysis");
    setLoading(true);
    setAnalysis(null);
    setAnalysisError(null);
    setActiveSavedRun(null);
    setAnalysisIsSaved(false);
    setProgress(new Map());
    setTrace([]);
    setAnalysisWakingUp(false);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 240_000);
    const wakingTimeoutId = window.setTimeout(() => setAnalysisWakingUp(true), 5_000);

    try {
      let receivedResult = false;
      await analyze(
        request,
        (event: StageEvent) => {
          window.clearTimeout(wakingTimeoutId);
          setAnalysisWakingUp(false);
          setProgress((current) => {
            const next = new Map(current);
            next.set(event.stage, { status: event.status, message: event.message });
            return next;
          });
          if (event.status === "failed") throw new Error(event.message);
          if (event.trace) setTrace(event.trace);
          if (event.result) {
            setAnalysis(event.result);
            receivedResult = true;
          }
        },
        controller.signal,
      );
      if (!receivedResult) throw new Error("The stream ended before a complete analysis arrived.");
    } catch (error) {
      const failureMessage =
        controller.signal.aborted
          ? "The analysis timed out while waiting for the backend. Check backend logs and try again."
          : error instanceof TypeError &&
              /^(failed to fetch|network error|load failed)$/i.test(error.message)
            ? "The backend connection was lost during analysis."
            : error instanceof Error
              ? error.message
              : "The analysis request could not be completed.";
      let fileRun: SavedRun | null = null;
      let savedRunLoadFailed = false;
      try {
        fileRun = await getSavedRun(demoId);
      } catch {
        savedRunLoadFailed = true;
      }
      const fallback = fileRun ?? (demoId ? savedRuns[demoId] ?? null : savedRun);
      if (fallback) {
        setAnalysis(fallback.analysis);
        setActiveSavedRun(fallback);
        if (demoId) {
          setSavedRuns((current) => ({ ...current, [demoId]: fallback }));
        } else {
          setSavedRun(fallback);
        }
        setAnalysisIsSaved(true);
        setAnalysisError(failureMessage);
      } else {
        setAnalysisError(
          `${failureMessage} ${
            savedRunLoadFailed
              ? "The configured saved run could not be loaded."
              : "No private saved run is available."
          }`,
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      window.clearTimeout(wakingTimeoutId);
      setAnalysisWakingUp(false);
      analysisInFlight.current = false;
      setLoading(false);
    }
  }, [savedRun, savedRuns]);

  function createRequest(values: typeof initialBrief = form): DiscoveryRequest | null {
    const minimum = Number(values.budgetMin);
    const maximum = Number(values.budgetMax);
    const seeds = lines(values.seeds);
    const requirements = lines(values.requirements);
    const constraints = lines(values.constraints);
    if (!values.businessName.trim()) {
      setFormError("Enter the business name.");
      return null;
    }
    if (
      values.businessName.trim().length > 160 ||
      values.industry.trim().length > 160 ||
      values.city.trim().length > 120 ||
      values.targetMarket.trim().length > 240
    ) {
      setFormError("Business name, industry, city, or target market exceeds its allowed length.");
      return null;
    }
    if (!values.goal.trim() || values.goal.trim().length < 10) {
      setFormError("Describe the collaboration goal in at least 10 characters.");
      return null;
    }
    if (values.goal.trim().length > 2000 || values.identifyingInfo.trim().length > 1000) {
      setFormError("The collaboration goal or identifying information exceeds its allowed length.");
      return null;
    }
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      values.budgetMin.trim() === "" ||
      values.budgetMax.trim() === "" ||
      minimum < 0 ||
      maximum < minimum
    ) {
      setFormError("Enter a valid budget range; the maximum must be at least the minimum.");
      return null;
    }
    if (!values.city.trim() && !values.targetMarket.trim()) {
      setFormError("Enter a city or target market.");
      return null;
    }
    if (!values.website.trim() && !values.identifyingInfo.trim()) {
      setFormError("Enter a website or other information that identifies the business.");
      return null;
    }
    if (
      (values.website.trim() && !/^https?:\/\/.+/i.test(values.website.trim())) ||
      (values.website.trim() && !URL.canParse(values.website.trim()))
    ) {
      setFormError("Enter a complete website address starting with http:// or https://.");
      return null;
    }
    if (seeds.length > 3) {
      setFormError("Add no more than 3 seed brands.");
      return null;
    }
    if (new Set(seeds.map((seed) => seed.toLocaleLowerCase())).size !== seeds.length) {
      setFormError("Seed brands must be distinct.");
      return null;
    }
    if (seeds.some((seed) => seed.length > 160)) {
      setFormError("Each seed brand must be 160 characters or fewer.");
      return null;
    }
    if (requirements.length > 30 || constraints.length > 30) {
      setFormError("Enter no more than 30 event requirements and 30 constraints.");
      return null;
    }
    if ([...requirements, ...constraints].some((item) => item.length > 500)) {
      setFormError("Each event requirement and constraint must be 500 characters or fewer.");
      return null;
    }

    setFormError("");
    return {
      brief: {
        business_name: values.businessName.trim(),
        industry: values.industry.trim() || null,
        city: values.city.trim() || null,
        target_market: values.targetMarket.trim() || null,
        website: values.website.trim() || null,
        identifying_info: values.identifyingInfo.trim() || null,
        collaboration_goal: values.goal.trim(),
        budget_range: { minimum, maximum, currency: "USD" },
        event_requirements: requirements,
        constraints,
      },
      seed_brands: seeds.map((name) => ({ name })),
    };
  }

  function updateField(field: keyof typeof initialBrief, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const viewState = useMemo(() => {
    if (loading) return "loading" as const;
    if (analysisError && !analysis) return "error" as const;
    if (!analysis || analysis.candidate_decisions.length === 0) return "empty" as const;
    if (analysis.discovery.status === "partial") return "partial" as const;
    return "results" as const;
  }, [analysis, analysisError, loading]);

  function startDemo(demo: (typeof demoDefinitions)[number]) {
    const values = {
      ...initialBrief,
      businessName: demo.input.business_name,
      industry: demo.input.industry,
      city: demo.input.city,
      targetMarket: demo.input.target_market,
      website: demo.input.website,
      identifyingInfo: demo.input.identifying_info,
      goal: demo.input.collaboration_goal,
      budgetMin: demo.input.budget_min,
      budgetMax: demo.input.budget_max,
      requirements: demo.input.event_requirements.join("\n"),
      constraints: demo.input.constraints.join("\n"),
      seeds: demo.input.seed_brands.join("\n"),
    };
    setForm(values);
    const request = createRequest(values);
    if (request) void submitAnalysis(request, demo.id);
  }

  function viewSavedDemo(demoId: DemoId) {
    const run = savedRuns[demoId];
    if (!run) return;
    setActiveDemoId(demoId);
    setActiveSavedRun(run);
    setAnalysis(run.analysis);
    setAnalysisError(null);
    setAnalysisIsSaved(true);
    setCurrentRequest(null);
    setProgress(new Map());
    setTrace([]);
    setScreen("analysis");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            aria-label="Vyuha home"
            className="text-lg font-black tracking-tight text-forest"
            onClick={() => setScreen("landing")}
            type="button"
          >
            Vyuha<span className="text-ink">.</span>
          </button>
          <p className="hidden text-sm text-slate-600 sm:block">
            Evidence before commitment
          </p>
        </div>
      </header>

      {screen === "landing" && (
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
              Partnership decision support
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              The unexpected partner finder that argues against itself.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Find cross-industry collaboration ideas, inspect the evidence, and pressure-test a
              small experiment before committing your budget.
            </p>
            <p className="mt-4 text-lg font-bold text-forest">
              Every AI recommends. Vyuha argues back.
            </p>
          </div>

          <section aria-labelledby="how-vyuha-works" className="mt-10 max-w-4xl rounded-xl border border-line bg-white p-5 sm:p-7">
            <h2 className="text-xl font-bold" id="how-vyuha-works">
              A partnership bet should be tested, not guessed.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Independent businesses can spend scarce time and budget on a pop-up partner without
              knowing whether the idea is worth testing.
            </p>
            <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
              <li>1. Compare unexpected partners with a conventional alternative using cultural taste evidence.</li>
              <li>2. Check available identity and local-listing evidence; keep gaps marked unknown.</li>
              <li>3. Ask a critic to challenge the pick, downgrade it, or abstain before proposing a small test.</li>
            </ol>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm leading-6 text-slate-700">
              <SourceTag source="qloo" />
              Qloo contributes cross-category taste affinity—not proof of shared customers, demand, or success.
            </p>
          </section>

          <section
            aria-labelledby="never-claims"
            className="mt-5 max-w-4xl rounded-xl border border-line bg-white p-5 sm:p-7"
          >
            <h2 className="text-xl font-bold" id="never-claims">
              What Vyuha will never claim
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Taste affinity is not customer overlap, purchase intent, attendance, or commercial
              success. A map listing does not prove ownership or current operation. Unknowns stay
              unknown until verified.
            </p>
          </section>

          <section aria-labelledby="demo-gallery-title" className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
                  Judge demos
                </p>
                <h2 className="mt-2 text-2xl font-bold" id="demo-gallery-title">
                  Five briefs, one evidence-first pipeline
                </h2>
              </div>
              <button
                className="rounded-lg bg-forest px-5 py-3 font-semibold text-white hover:bg-emerald-950"
                onClick={() => {
                  setForm(initialBrief);
                  setActiveDemoId(null);
                  setScreen("brief");
                }}
                type="button"
              >
                Type your own brief
              </button>
            </div>
            <ul className="stagger-enter mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {demoDefinitions.map((demo) => {
                const saved = savedRuns[demo.id];
                return (
                  <li
                    className="flex min-w-0 flex-col rounded-xl border border-line bg-white p-5"
                    key={demo.id}
                  >
                    <h3 className="text-lg font-bold">{demo.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">{demo.watchFor}</p>
                    {saved && (
                      <p className="mt-3 text-xs text-slate-600">
                        Saved capture: {new Date(saved.captured_at).toLocaleDateString()}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="min-h-11 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950"
                        onClick={() => startDemo(demo)}
                        type="button"
                      >
                        Run live
                      </button>
                      {saved ? (
                        <button
                          className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-forest hover:bg-paper"
                          onClick={() => viewSavedDemo(demo.id)}
                          type="button"
                        >
                          View saved run
                        </button>
                      ) : savedRunsLoading ? (
                        <span className="flex min-h-11 items-center px-2 text-xs text-slate-500">
                          Checking saved run…
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <ol className="mt-16 grid gap-4 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Discover", "Find candidates using real taste signals and verified listings."],
              ["02", "Compare", "Put an unexpected idea beside a conventional alternative."],
              ["03", "Challenge", "Try to disprove the pick; downgrade or abstain when evidence fails."],
              ["04", "Test", "Plan a bounded experiment and prepare an unsent outreach draft."],
            ].map(([number, title, description]) => (
              <li className="border-l-2 border-forest pl-4" key={title}>
                <span className="text-xs font-bold tracking-widest text-forest">{number}</span>
                <h2 className="mt-2 text-xl font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
              </li>
            ))}
          </ol>

          <div aria-live="polite" className="mt-12 flex flex-wrap items-center gap-3 text-sm">
            {apiReady === null ? (
              <span className="text-slate-600">
                {healthCheckWakingUp
                  ? "Waking up the server; free hosted instances can take up to a minute."
                  : "Checking the live connection…"}
              </span>
            ) : apiReady ? (
              <span className="font-semibold text-forest">Backend connected</span>
            ) : (
              <>
                <span className="text-rose-800">
                  Backend may be waking up; free hosted instances can take up to a minute.{" "}
                  {apiMessage}
                </span>
                <button
                  className="rounded border border-line px-3 py-1.5 font-semibold hover:bg-white"
                  onClick={() => void checkBackend()}
                  type="button"
                >
                  Check again
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {screen === "brief" && (
        <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
          <button
            className="text-sm font-semibold text-forest hover:underline"
            onClick={() => setScreen("landing")}
            type="button"
          >
            ← Back
          </button>
          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-forest">Your brief</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">What are you planning?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
            Include enough information to identify your business and market. Vyuha sends this brief
            to the live analysis backend; it does not generate sample partners.
          </p>

          <form
            className="mt-8 space-y-6 rounded-xl border border-line bg-white p-5 sm:p-8"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const request = createRequest();
              if (request) void submitAnalysis(request);
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Business name <span className="text-rose-700">*</span>
                <input
                  autoComplete="organization"
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={160}
                  onChange={(event) => updateField("businessName", event.target.value)}
                  required
                  value={form.businessName}
                />
              </label>
              <label className="block text-sm font-semibold">
                Industry
                <input
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={160}
                  onChange={(event) => updateField("industry", event.target.value)}
                  value={form.industry}
                />
              </label>
              <label className="block text-sm font-semibold">
                City
                <input
                  autoComplete="address-level2"
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={120}
                  onChange={(event) => updateField("city", event.target.value)}
                  value={form.city}
                />
              </label>
              <label className="block text-sm font-semibold">
                Broader target market
                <input
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={240}
                  onChange={(event) => updateField("targetMarket", event.target.value)}
                  value={form.targetMarket}
                />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Website
                <input
                  autoComplete="url"
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  onChange={(event) => updateField("website", event.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  value={form.website}
                />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Other identifying information
                <textarea
                  className="mt-2 min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={1000}
                  onChange={(event) => updateField("identifyingInfo", event.target.value)}
                  value={form.identifyingInfo}
                />
                <span className="mt-1 block text-xs font-normal text-slate-600">
                  Provide a website or this identifying information.
                </span>
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Collaboration goal <span className="text-rose-700">*</span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  maxLength={2000}
                  minLength={10}
                  onChange={(event) => updateField("goal", event.target.value)}
                  placeholder="What would a useful, low-risk collaboration help you learn or do?"
                  required
                  value={form.goal}
                />
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Budget range (USD)</legend>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Minimum
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5"
                    min="0"
                    onChange={(event) => updateField("budgetMin", event.target.value)}
                    type="number"
                    value={form.budgetMin}
                  />
                </label>
                <label className="text-sm">
                  Maximum
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5"
                    min="0"
                    onChange={(event) => updateField("budgetMax", event.target.value)}
                    type="number"
                    value={form.budgetMax}
                  />
                </label>
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Event requirements
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  placeholder="One item per line"
                  onChange={(event) => updateField("requirements", event.target.value)}
                  value={form.requirements}
                />
              </label>
              <label className="block text-sm font-semibold">
                Constraints
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                  placeholder="One item per line"
                  onChange={(event) => updateField("constraints", event.target.value)}
                  value={form.constraints}
                />
              </label>
            </div>

            <label className="block text-sm font-semibold">
              Optional seed brands (up to 3)
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal"
                placeholder="One brand per line"
                onChange={(event) => updateField("seeds", event.target.value)}
                value={form.seeds}
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">
                If Qloo doesn&apos;t know your brand, name brands your customers like.
              </span>
            </label>

            {(formError || analysisError) && (
              <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                {formError || analysisError}
              </p>
            )}
            <button
              className="w-full rounded-lg bg-forest px-5 py-3 font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={loading}
              type="submit"
            >
              Discover partners
            </button>
          </form>
        </section>
      )}

      {screen === "analysis" && (
        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
          {analysisIsSaved && activeSavedRun && (
            <SavedRunBanner
              capturedAt={activeSavedRun.captured_at}
              liveError={analysisError}
            />
          )}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-forest">
                Vyuha analysis
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                {analysis ? "The recommendation, challenged" : "Testing the evidence"}
              </h1>
            </div>
            {!loading && (
              <button
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-paper"
                onClick={() => {
                  setActiveDemoId(null);
                  setScreen("brief");
                }}
                type="button"
              >
                Edit brief
              </button>
            )}
          </div>

          {analysis &&
          (analysis.discovery.status === "needs_user_choice" ||
            analysis.discovery.business_identity.status === "needs_user_choice") &&
          currentRequest ? (
            <ChoicePanel
              analysis={analysis}
              onEdit={() => setScreen("brief")}
              onSubmit={(request) => void submitAnalysis(request, activeDemoId ?? undefined)}
              request={currentRequest}
              submitting={loading}
            />
          ) : (
            <AnalysisView
              analysis={analysis}
              error={analysisError}
              onRetry={
                currentRequest
                  ? () => void submitAnalysis(currentRequest, activeDemoId ?? undefined)
                  : undefined
              }
              progress={progress}
              trace={trace}
              state={viewState}
              isSavedRun={analysisIsSaved}
              wakingUp={analysisWakingUp}
            />
          )}
        </section>
      )}

      <footer className="mt-16 border-t border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 text-xs leading-5 text-slate-600 sm:px-8">
          Vyuha reports evidence and uncertainty, not customer overlap, purchase intent, or
          commercial outcomes. Verify costs, availability, identity, and permissions before acting.
        </div>
      </footer>
    </main>
  );
}

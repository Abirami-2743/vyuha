"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { BusinessBriefForm } from "@/components/business-brief-form";
import { SourceTag } from "@/components/evidence";
import { SavedRunBanner } from "@/components/saved-run-banner";
import { RoutedJudgePage } from "@/components/judge-pages";
import { SiteHeader } from "@/components/site-header";
import { analyze, checkApi, getSavedRun } from "@/lib/api";
import { emptyBrief, validateBrief, type BriefFields } from "@/lib/brief";
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
  anyOsmLocation: boolean;
  qlooEntityId: string;
  seedIds: Record<string, string>;
};
type Demo = (typeof demoDefinitions)[number];

function placeLabel(place: Place): string {
  return `${place.name} — ${place.display_name}`;
}

export function ChoicePanel({
  identity,
  request,
  onSubmit,
  onEdit,
  submitting,
}: {
  identity: Analysis["discovery"]["business_identity"];
  request: DiscoveryRequest;
  onSubmit: (nextRequest: DiscoveryRequest) => void;
  onEdit: () => void;
  submitting: boolean;
}) {
  const requiresOsm =
    identity.osm_status === "ambiguous" || identity.osm_status === "selection_invalid";
  const requiresQloo =
    identity.qloo_status === "ambiguous" || identity.qloo_status === "selection_invalid";
  const pendingSeeds = identity.seed_resolutions.filter(
    (resolution) => resolution.status === "needs_user_choice",
  );
  const [choice, setChoice] = useState<ChoiceState>({
    osm: null,
    anyOsmLocation: false,
    qlooEntityId: "",
    seedIds: {},
  });
  const missingRequiredChoice =
    (requiresOsm &&
      identity.osm_options.length > 0 &&
      !choice.osm &&
      !choice.anyOsmLocation) ||
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
    if (choice.anyOsmLocation) nextRequest.selected_osm_any_location = true;
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
                  onChange={() =>
                    setChoice((current) => ({
                      ...current,
                      osm: place,
                      anyOsmLocation: false,
                    }))
                  }
                  type="radio"
                />
                <span>{placeLabel(place)}</span>
              </label>
            ))}
            {identity.osm_options.length > 1 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-paper">
                <input
                  checked={choice.anyOsmLocation}
                  name="osm-option"
                  onChange={() =>
                    setChoice((current) => ({
                      ...current,
                      osm: null,
                      anyOsmLocation: true,
                    }))
                  }
                  type="radio"
                />
                <span>Any location (use the brand)</span>
              </label>
            )}
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
  const [form, setForm] = useState<BriefFields>(emptyBrief);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<Partial<Record<DemoId, SavedRun>>>({});
  const [savedRunErrors, setSavedRunErrors] = useState<Partial<Record<DemoId, boolean>>>({});
  const [savedRunsLoading, setSavedRunsLoading] = useState(true);
  const [activeSavedRun, setActiveSavedRun] = useState<SavedRun | null>(null);
  const [activeDemoId, setActiveDemoId] = useState<DemoId | null>(null);
  const [analysisIsSaved, setAnalysisIsSaved] = useState(false);
  const [progress, setProgress] = useState<Map<string, ProgressEvent>>(new Map());
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisTakingLong, setAnalysisTakingLong] = useState(false);
  const [healthCheckWakingUp, setHealthCheckWakingUp] = useState(false);
  const [analysisWakingUp, setAnalysisWakingUp] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<DiscoveryRequest | null>(null);
  const [route, setRoute] = useState("/");
  const [routeReady, setRouteReady] = useState(false);
  const routeHistory = useRef<string[]>([]);
  const analysisInFlight = useRef(false);
  const analysisController = useRef<AbortController | null>(null);
  const analysisRequestId = useRef(0);
  const cancelRequested = useRef(false);

  const navigate = useCallback((path: string, replace = false) => {
    if (path !== "/analyze") analysisRequestId.current += 1;
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== path) {
        if (replace) {
          window.history.replaceState({ vyuha: true }, "", path);
          if (routeHistory.current.length) {
            routeHistory.current[routeHistory.current.length - 1] = path;
          } else {
            routeHistory.current.push(path);
          }
        } else {
          window.history.pushState({ vyuha: true }, "", path);
          routeHistory.current.push(path);
        }
      }
    }
    setRoute(path);
  }, []);

  useEffect(() => {
    window.history.replaceState({ vyuha: true }, "", window.location.pathname);
    const syncRoute = () => {
      const nextRoute = window.location.pathname;
      const previousIndex = routeHistory.current.lastIndexOf(nextRoute);
      routeHistory.current =
        previousIndex < 0
          ? [...routeHistory.current, nextRoute]
          : routeHistory.current.slice(0, previousIndex + 1);
      if (analysisController.current && nextRoute !== "/analyze") {
        analysisRequestId.current += 1;
        cancelRequested.current = true;
        analysisController.current.abort();
        analysisController.current = null;
        analysisInFlight.current = false;
        setLoading(false);
      }
      setRoute(nextRoute);
      if (nextRoute !== "/analyze") setScreen("landing");
      setRouteReady(true);
    };
    window.addEventListener("popstate", syncRoute);
    syncRoute();
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (route === "/analyze" && !analysisInFlight.current && !analysis) {
      setScreen("brief");
    }
  }, [analysis, route]);

  const checkBackend = useCallback(async () => {
    setApiReady(null);
    setApiMessage("");
    setHealthCheckWakingUp(false);
    const wakingTimeoutId = window.setTimeout(() => setHealthCheckWakingUp(true), 3_000);
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
    const checkTimerId = window.setTimeout(() => void checkBackend(), 0);
    return () => window.clearTimeout(checkTimerId);
  }, [checkBackend]);

  useEffect(() => {
    let mounted = true;
    void Promise.all(
      demoDefinitions.map(async ({ id }) => {
        try {
          return [id, await getSavedRun(id), false] as const;
        } catch (error: unknown) {
          console.error("saved_demo_run_load_failed", {
            event: "saved_demo_run_load_failed",
            demo_id: id,
            exception_type: error instanceof Error ? error.name : "UnknownError",
          });
          return [id, null, true] as const;
        }
      }),
    ).then((runs) => {
      if (!mounted) return;
      const available: Partial<Record<DemoId, SavedRun>> = {};
      const errors: Partial<Record<DemoId, boolean>> = {};
      for (const [id, run, failed] of runs) {
        if (run) available[id] = run;
        if (failed) errors[id] = true;
      }
      setSavedRuns(available);
      setSavedRunErrors(errors);
      setSavedRunsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const submitAnalysis = useCallback(async (request: DiscoveryRequest, demoId?: DemoId) => {
    if (analysisInFlight.current) return;
    const requestId = ++analysisRequestId.current;
    analysisInFlight.current = true;
    cancelRequested.current = false;
    navigate("/analyze");
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
    setAnalysisTakingLong(false);
    const controller = new AbortController();
    analysisController.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 240_000);
    const wakingTimeoutId = window.setTimeout(() => setAnalysisWakingUp(true), 5_000);
    const longRunTimeoutId = window.setTimeout(() => setAnalysisTakingLong(true), 60_000);

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
            if (
              event.result.discovery.status !== "needs_user_choice" &&
              event.result.discovery.business_identity.status !== "needs_user_choice"
            ) {
              navigate("/result", true);
            }
          }
        },
        controller.signal,
      );
      if (!receivedResult) throw new Error("The stream ended before a complete analysis arrived.");
    } catch (error) {
      if (cancelRequested.current) return;
      const failureMessage =
        controller.signal.aborted
          ? "The analysis timed out while waiting for the backend. Check backend logs and try again."
          : error instanceof TypeError &&
              /^(failed to fetch|network error|load failed)$/i.test(error.message)
            ? "The backend connection was lost during analysis."
            : error instanceof Error
              ? error.message
              : "The analysis request could not be completed.";
      const fallback = demoId ? savedRuns[demoId] ?? null : null;
      if (fallback) {
        setAnalysis(fallback.analysis);
        setActiveSavedRun(fallback);
        setAnalysisIsSaved(true);
        setAnalysisError(failureMessage);
        navigate("/result", true);
      } else {
        setAnalysisError(`${failureMessage} Browse saved results to see any available dated runs.`);
        if (demoId) {
          void getSavedRun(demoId)
            .then((run) => {
              if (!run || cancelRequested.current || requestId !== analysisRequestId.current) return;
              setSavedRuns((current) => ({ ...current, [demoId]: run }));
              setSavedRunErrors((current) => ({ ...current, [demoId]: false }));
              setAnalysis(run.analysis);
              setActiveSavedRun(run);
              setAnalysisIsSaved(true);
              setAnalysisError(failureMessage);
              navigate("/result", true);
            })
            .catch((savedRunError: unknown) => {
              console.error("saved_demo_run_fallback_failed", {
                event: "saved_demo_run_fallback_failed",
                demo_id: demoId,
                exception_type:
                  savedRunError instanceof Error ? savedRunError.name : "UnknownError",
              });
            });
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      window.clearTimeout(wakingTimeoutId);
      window.clearTimeout(longRunTimeoutId);
      setAnalysisWakingUp(false);
      setAnalysisTakingLong(false);
      analysisInFlight.current = false;
      analysisController.current = null;
      setLoading(false);
    }
  }, [navigate, savedRuns]);

  function updateField(field: keyof BriefFields, value: string) {
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
    const values: BriefFields = {
      ...emptyBrief,
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
    const request = validateBrief(values).request;
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
    navigate("/result");
  }

  function runDemo(demo: Demo) {
    setScreen("analysis");
    startDemo(demo);
  }

  function backTarget(): string {
    if (route.startsWith("/result/partners/")) return "/result/partners";
    if (route === "/result/partners" || route === "/result/evidence") return "/result";
    if (route === "/result" || route === "/analyze") return "/demos";
    if (route === "/about") return "/";
    return "/";
  }

  function handleBack() {
    if (route === "/analyze" && analysisController.current) {
      analysisRequestId.current += 1;
      cancelRequested.current = true;
      analysisController.current.abort();
      analysisController.current = null;
      analysisInFlight.current = false;
      setLoading(false);
    }
    const target = backTarget();
    const previousRoute = routeHistory.current[routeHistory.current.length - 2];
    if (previousRoute === target) {
      window.history.back();
    } else {
      navigate(target, true);
    }
  }

  function browseSavedResults() {
    analysisRequestId.current += 1;
    cancelRequested.current = true;
    analysisController.current?.abort();
    analysisController.current = null;
    analysisInFlight.current = false;
    setLoading(false);
    setAnalysisTakingLong(false);
    navigate("/demos");
  }

  return (
    <main className="min-h-screen">
      <SiteHeader
        backLabel={backTarget() === "/" ? "home" : backTarget()}
        backText={route === "/analyze" && loading ? "Cancel run" : "← Back"}
        onAbout={() => navigate("/about")}
        onBack={handleBack}
        onHome={() => {
          setScreen("landing");
          navigate("/");
        }}
        route={route}
      />

      {healthCheckWakingUp &&
        (route === "/demos" || (route === "/analyze" && screen === "brief")) && (
          <p
            aria-live="polite"
            className="mx-auto max-w-7xl px-5 pt-4 text-sm font-medium text-slate-700 sm:px-8"
            role="status"
          >
            Waking up the AI engine, this can take up to 40 seconds
          </p>
        )}

      {routeReady && route !== "/analyze" && (
        <>
          {route.startsWith("/result") && analysisIsSaved && activeSavedRun && (
            <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
              <SavedRunBanner
                capturedAt={activeSavedRun.captured_at}
                liveError={analysisError}
              />
            </div>
          )}
          <RoutedJudgePage
            analysis={analysis}
            onNavigate={(path) => {
              if (path === "/analyze") {
                setForm(emptyBrief);
                setActiveDemoId(null);
                setScreen("brief");
              }
              navigate(path);
            }}
            onRun={runDemo}
            onViewSaved={viewSavedDemo}
            route={route}
            savedRuns={savedRuns}
            savedRunErrors={savedRunErrors}
            savedRunsLoading={savedRunsLoading}
            trace={trace}
          />
        </>
      )}

      {screen === "landing" && route === "/legacy-landing" && (
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
                  setForm(emptyBrief);
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
                        Saved result, not live · captured {new Date(saved.captured_at).toLocaleDateString()}
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
                          View saved result, not live
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
                  ? "Waking up the AI engine, this can take up to 40 seconds"
                  : "Checking the live connection…"}
              </span>
            ) : apiReady ? (
              <span className="font-semibold text-forest">Backend connected</span>
            ) : (
              <>
                <span className="text-rose-800">
                  The backend did not respond. It may still be waking up. {apiMessage}
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
        route === "/analyze" &&
        <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-forest">Your brief</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">What are you planning?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
            Include enough information to identify your business and market. Vyuha sends this brief
            to the live analysis backend; it does not generate sample partners.
          </p>

          <BusinessBriefForm
            onChange={updateField}
            onSubmit={(request) => void submitAnalysis(request)}
            submitting={loading}
            values={form}
          />
        </section>
      )}

      {screen === "analysis" && (
        route === "/analyze" &&
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
                onClick={() => { setActiveDemoId(null); setScreen("brief"); }}
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
              identity={analysis.discovery.business_identity}
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
              onViewSaved={browseSavedResults}
              progress={progress}
              trace={trace}
              state={viewState}
              isSavedRun={analysisIsSaved}
              wakingUp={analysisWakingUp}
              takingLong={analysisTakingLong}
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

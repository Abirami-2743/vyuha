# Vyuha progress — deployment readiness

Updated: October 23, 2026

## Done

- Tasks 1–7: real Qloo-backed discovery, verification, adversarial critique, abstention, evidence provenance, a responsive Next.js decision flow, and judge-led product improvements.
- Frontend calls the live FastAPI health and streaming analysis endpoints; includes brief validation, identity selection/resubmission, stage progress, evidence-tagged comparisons, experiment plan, and editable unsent outreach.
- Candidate discovery excludes the selected business, resolved seed brands, duplicate OSM/Qloo identities, and the selected business's named premises. Critic citations resolve to available claim text; unsupported reference-only lines are omitted.
- Experiments and partner drafts now name their candidate, use the brief's event requirements and stated duration, and list costs to verify without forecasting outcomes. Critic/evidence detail panels are collapsed by default.
- UI provenance now distinguishes AI interpretations from Qloo evidence and rule-based decisions/critic findings. Tied top ratings disclose the number of tied candidates and the tie-break rule.
- OSM same-industry searches use a plural category query; the Blue Bottle / San Francisco brief now returns a verified Starbucks conventional baseline when matching listings exist.
- Added a one-click Blue Bottle Coffee / San Francisco sample brief that submits only user inputs to the live pipeline and still requires explicit identity selection.
- Added a data-derived verdict summary, a short customer/problem and Qloo explainer, a query-grounded Qloo rationale, and explicit cold-start/rate-limit messaging.
- Added in-memory per-IP and per-process daily analysis limits. A configured `VYUHA_SAVED_RUN_PATH` persists the latest complete analysis privately and supports a dated, visibly non-live fallback; `.vyuha-private/` is gitignored.
- Corrected the local CORS default to allow both `localhost:3000` and `127.0.0.1:3000`.
- No production mock data; saved fallback data is not committed or presented as live.

## Verified

- Qloo Search/Place Insights, Nominatim same-city category checks, and the 100-mile-radius caveat were verified.
- Blue Bottle Coffee / San Francisco sample completed in the browser after explicitly selecting the Ferry Building location. Live Qloo Search and Insights returned HTTP 200; the page displayed the response-derived candidate count, critic cuts, recommendation/rating and next step.
- Browser fallback check: with the backend stopped and the page reloaded, the real sample request failed and the app loaded the private saved analysis with its capture date and “not live” banner. Identity selection remained user-controlled.
- Backend CORS, daily/per-IP limiter unit test, and request validation are covered. The local saved-run file was confirmed ignored by Git.
- Backend final checks: `python -m pytest tests -q` (56 passed), `python -m ruff check backend tests --config backend\pyproject.toml` (all checks passed), and `python -m mypy --config-file backend\pyproject.toml backend\app` (success, 13 source files).
- Frontend prior checks: `npm run lint`, `npm run typecheck`, `npm run test` (8 passed), and `npm run build` (optimized build succeeded).
- Judge review and before/after self-assessment are in `docs/judge-review.md`; scores are self-assessment, not measurement.

## Blocked

- Hosted verification is pending because this task did not authorize deployment. Render/Vercel secrets, public URLs, cross-network behavior, and live provider calls must be verified after the owner deploys.
- Raw API response samples were removed from the repository and its history; none are published.
- npm reported 12 dependency advisories after the normal Next.js/PostCSS upgrade (3 moderate, 7 high, 2 critical); no forced audit fix was run.

## Next

- Follow [docs/deploy.md](./docs/deploy.md) to connect the private repository, configure Render/Vercel, upload the saved-run secret file, and verify the hosted demo from a phone and private window.

## Deployment-readiness changes

- Backend `GET /saved-run` reads and validates the dated file from `VYUHA_SAVED_RUN_PATH`; writable live-run persistence is separate so Render's read-only secret file is not overwritten.
- Render Blueprint pins Python 3.12.11, configures proxy headers, health checks, CORS, and judging-window rate limits; Vercel build configuration and public API URL steps are documented.
- Frontend reads saved data from the backend, labels it non-live, delays cold-start messaging, and presents a single verdict with returned limitations and accurate ordering/tie-break explanations.
- Added the Render/Vercel runbook, ignored/untracked `docs/live-samples`, and aligned the MIT copyright holder with `git config user.name`.

## Verified for deployment readiness

- Python 3.12.11 installed all 59 packages in `backend/requirements.txt` and `backend/requirements-dev.txt`.
- `pytest tests -q`: 61 passed; `ruff check backend tests --config backend\\pyproject.toml`: all checks passed; mypy: success for 13 source files.
- `npm run lint`, `npm run typecheck`, and `npm run test`: passed (10 frontend tests); `npm run build`: Next.js 16.4.2 production build succeeded.
- `render.yaml` parsed and its Python pin, app target, and `/health` check were verified. Render's current secret-file documentation confirms `/etc/secrets/<filename>` for non-Docker services.
- No deployment or commit was made.

## Demo gallery and private saved runs — October 18, 2026

- Added five input-only demo briefs to the landing-page gallery, per-demo allowlisted saved-run reads, explicit identity selection, per-demo live-failure fallback, private capture and evaluation scripts, and Render secret-file instructions. Updated the example and Render LLM configuration to use a Groq primary model and a second Groq model as fallback, with model IDs supplied through environment variables.
- Captured five real runs from the local `.env` pipeline into the gitignored `.vyuha-private/demo-runs/`; each file validates against the API schema and includes its capture timestamp and deterministic identity-selection metadata. Captured outputs are not tracked.
- Evaluation counts from those five snapshots: 5 runs, 2 abstentions, 15 candidate downgrades, and 0 evidence claims without a source reference. These are counts only, not significance or performance claims; limitations are in `docs/evaluation.md`.
- Browser verified all five live buttons (including explicit identity pickers for Blue Bottle, The Ordinary, and Starbucks; the invented business returned the live empty state), all five saved-run views and their “not live” banners, a missing-file 404/hidden button, and 375px layout without horizontal overflow.
- Final checks: `python -m pytest tests -q` (64 passed), Ruff (all checks passed after removing two unused imports), mypy (13 source files), npm lint/typecheck, frontend tests (13 passed), and production build all passed. Ruff and frontend tests were rerun after their initial targeted failures were corrected.
- No commit or deployment was made. Hosted Render/Vercel secret-file and live-provider verification remains next.

## Signature product work — October 20, 2026

- Verdict now reports separate data-derived counts for Qloo-suggested candidates and OSM-only baseline places. The top three candidates lead with a provenance-tagged positive case, critic severity, and provisional-to-final rating; remaining debates and detailed evidence sit behind “See evidence.” Map-only places expand from one summary line.
- Added streamed agent trace metadata for Plan, Qloo Search, Qloo Insights, map verification, compare, critic, and decision. External-call durations, result counts, and observed HTTP statuses are request-local; raw provider bodies and credentials are excluded.
- Added the landing-page pitch and “What Vyuha will never claim” section, reduced-motion-aware staggered entrances, and an explicit note that chain affiliation is unknown because available source data has no reliable chain signal.
- Backend checks: pytest 64 passed; Ruff passed after a line-length correction; mypy succeeded for 14 source files. Frontend lint, typecheck, and production build succeeded; Vitest passed all 16 tests after refining one disclosure-visibility assertion.
- Browser verified using the existing dated real saved Blue Bottle analysis (not a new live run): 375px viewport without horizontal overflow (document width 360px), three shortlist cards, keyboard-accessible evidence summary with visible focus outline, reduced-motion animation disabled, and 16.15:1 summary-text contrast on white.
- Powell’s Books / Portland seed-brand exploration was not run; the optional live demo was left unchanged. No commit or deployment was made.

## Judge-first redesign and LLM copy correction — October 21, 2026

- Confirmed the official 2026 Devpost criteria in the browser: Technological Implementation, Design, Potential Impact, and Quality of the Idea (equally weighted).
- Updated provider descriptions to Groq (primary model) with a second Groq model as fallback in the developer instructions, environment example, architecture, deployment guide, and progress record. Model IDs are environment-supplied.
- Added route-backed Home, demo gallery, verdict, partner list/details, evidence, and About views. Reused the existing five input-only briefs, live analysis stream, and saved-run contracts; added browser-history handling, explicit Back/Home navigation, cancel-on-back, and plain-language progress steps.
- Reworded the home pitch to describe Qloo taste signals without asserting shared customers; verdict reasons now require a supported/partial criterion with evidence. Direct-link empty states route back to demos, and the evidence timeline is collapsed until requested.
- Verified the five private saved demo runs are available through the local API and marked non-live in the gallery/result flow. Confirmed that a live request can still fall back to the saved result when the backend is unavailable; no live analysis was triggered during this verification.
- Browser verified judge routes at a 375px viewport with no horizontal overflow; each route shows Back and Home, browser history navigation works, visible keyboard focus is present, and reduced-motion disables animation. Qloo comparison details and evidence are presented through disclosures.
- Final frontend lint, typecheck, tests, and production build passed; targeted backend LLM tests passed. No commit or deployment was made.
- No commit or deployment was made.

## Review fixes and final verification — October 21, 2026

- Resolved the four latest review findings: partner details now use an evidence-backed positive rationale or an honest fallback; Back uses in-app history when available and safe route replacement on direct links; direct routes do not flash the Home page before route sync; the unsupported-rationale test scopes its assertion and also covers partner details.
- Kept the candidate-debate test timeout unchanged. It passes alone in 0.83s and in the full suite; the earlier timeout occurred when frontend tests competed with concurrent builds, type checks, backend tests, and dev servers.
- Final frontend checks, run in the requested order: `npm run lint` passed; `npm run typecheck` passed; `npm run test` passed (4 files, 22 tests); `npm run build` passed (optimized Next.js build).
- Final backend checks: `python -m pytest tests -q` passed (64 tests); `python -m ruff check backend tests --config backend\pyproject.toml` passed; `python -m mypy --config-file backend\pyproject.toml backend\app` passed (14 source files).
- Browser checked Home, Demos, Analyze, Verdict, Partners, Partner Detail, Evidence, and About at a 375px viewport. Every page showed Back and Home, Back navigated to its expected destination, browser Back from Partner Detail returned to the Verdict without a detail-page loop, and each page had equal document client/scroll widths (no horizontal overflow). The Home hero states the product plainly; a saved, non-live result clearly named the recommended partner and showed its reason, risk, first test, Qloo caveat, and real run counts.
- The provider-text search at that time found no incorrect provider names in source. Google mentions described a hackathon form and historical web search; OpenAI mentions described the compatible API format, not a model provider. Model identifiers are configuration, not source-code constants.
- `.next/`, `*.tsbuildinfo`, and the generated `frontend/AGENTS.md` are ignored by Git; the tracked `frontend/next-env.d.ts` matches its original contents. Generated files do not appear in `git status`.
- No fresh live LLM/Qloo analysis was run. Browser result checks used the existing private saved run and displayed the non-live label. No commit or deployment was made.

## Honesty audit and Groq fallback — October 21, 2026

### Done

- Replaced the prior fallback-provider references with Groq (primary model) and a distinct second Groq model as fallback. Kept all primary/fallback environment-variable names; Render now requires model IDs as environment values instead of pinning them in the Blueprint.
- Primary 429s and timeouts now switch immediately to the fallback. A fallback 429 retries once after a short bounded delay; if rate-limited again, the API reports the specified busy message. Structured responses from either model are validated before use; invalid fallback output gets one attempt on the other model and is never returned.
- Added step/provider/model logging without credentials, the `GET /` service status response, and tests for rate-limit fallback, timeout fallback, exhausted rate limits, invalid fallback output, and the distinct fallback model requirement.
- Kept the two existing batched logical LLM steps: one optional interpretation call across Qloo-backed candidates, plus one critic call. Deterministic decision, experiment, and outreach steps make no LLM calls; no quality-reducing call reduction was available.
- Removed the unmeasured Plan trace count and static About-page evaluation metrics; clarified user-facing recommendation limits and evidence labels. Saved results now consistently say “Saved result, not live” with a capture timestamp, including the live-failure explanation.
- Restricted the LLM probe script to HTTPS.

### Verified

- `python -m pytest tests -q`: 67 passed.
- `python -m ruff check backend tests --config backend\pyproject.toml`: all checks passed.
- `python -m mypy --config-file backend\pyproject.toml backend\app`: success for 14 source files.
- Frontend `npm run lint`, `npm run typecheck`, and `npm run test`: passed; Vitest reports 4 files and 23 tests passed.
- Frontend `npm run build`: optimized Next.js production build completed successfully.
- Tracked-source provider-name scan: no matches. Credential-pattern scan found no matching literals.
- `git diff --check`: passed. No commit or deployment was made.

### Blocked / unverified

- No live Groq or Qloo request or hosted Vercel/Render verification was run. Live behavior remains unverified until Render has valid credentials and distinct supported Groq model IDs.
- The configured model values are deliberately not guessed or embedded; set `LLM_MODEL` and `LLM_FALLBACK_MODEL` in Render to supported, different Groq model IDs.

### Next

- Configure the existing server-side environment variables and, when authorized, verify `GET /`, `/health`, a live analysis, and the saved-result fallback on the hosted deployment.

## Navigation, Home, and business brief — October 21, 2026

### Done

- Removed Back from Home only; retained Back alongside Home and About navigation on other routes.
- Shortened the Home headline to 15 words and kept Qloo's role in the subheading.
- Fixed shared brief state so a new business brief starts empty, including both budget fields. Returning to the Home CTA after a demo also resets the brief.
- Added four editable example chips (cafe, skincare shop, gym, bookstore). Each fills every field without submitting; tests verify a later selection replaces the earlier example rather than mixing business text.
- Added visible required markers and the website-or-description rule before submission. Invalid fields are highlighted; the first invalid field is scrolled into view and focused.
- Added run-aware guidance for missing business listings, no local-market match, no eligible Qloo business match, rate limits, AI-service busy responses, and an unresponsive/waking backend. Rate-limit and AI-busy states link to the saved-results gallery.

### Verified

- Frontend `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`: passed; Vitest reports 6 files and 42 tests passed.
- Backend `python -m pytest tests -q`: 67 passed.
- Backend `python -m ruff check backend tests --config backend\pyproject.toml`: all checks passed.
- Backend `python -m mypy --config-file backend\pyproject.toml backend\app`: success for 14 source files.
- Browser checked the Home and About navigation, blank form, all four examples, and website-or-description validation. At a 375px viewport, the page had no horizontal overflow; at desktop width it also had no horizontal overflow. The validation message appeared and focus moved to the invalid website field.
- `git diff --check`: passed. No commit or deployment was made.

### Blocked / unverified

- The local frontend browser session could not reach the backend at `127.0.0.1:8000` (`ERR_CONNECTION_REFUSED` on health/saved-run requests). Live API error responses, saved-result availability, and a live Qloo/LLM run were not verified; failure guidance is covered by component tests.

### Next

- When authorized and the backend is running with configured credentials, verify the live analysis flow and saved-result links against actual service responses.

## Verdict honesty and final validation — October 22, 2026

### Done

- Narrowed the partial-result logic so the warning appears only when a real check failed or was skipped; completed runs show a green completion line instead of a partial warning.
- Updated the verdict copy to plain-language reasons, a collapsed technical-detail section, a confidence line based on run data, and a “What would change my mind” line tied to the actual critic findings.
- Reworked abstention messaging to distinguish Qloo no results, unrecognized business, Qloo failure/rate limit, and all candidates rejected by the devil’s advocate without pretending there was a safe recommendation.
- Fixed the JSX structure in the analysis results view so the top-three debates and evidence sections render correctly and the remaining debates remain hidden behind “See evidence.”

### Verified

- Frontend `npm run lint`, `npm run typecheck`, and `npm test -- --run --testTimeout 20000`: passed; Vitest reports 6 files and 50 tests passed.
- Frontend `npm run build`: succeeded with a production Next.js build.
- Backend `python -m pytest -q`: 67 passed in 49.21s.
- Backend `python -m ruff check backend tests --config backend\pyproject.toml`: all checks passed.
- Backend `python -m mypy --config-file backend\pyproject.toml backend\app`: success, 14 source files.
- No commit or deployment was made.

### Blocked / unverified

- Direct browser verification at 375px and desktop against a live backend was not possible in this session because the local server and browser run were not available in the same environment. The relevant UI behavior is covered by automated tests, but live backend/browser confirmation remains pending on a running local app instance.

### Next

- Bring up the local backend/frontend together and complete a browser pass at 375px and desktop width against a live run and a saved-result view.

## Task 3 evidence follow-up — October 22, 2026

### Findings and changes

- Domino's Pizza / Mumbai: the reported HTTP 200 responses rule out a Qloo transport failure. The code searches the submitted `brief.business_name`, then queries Insights using the resolved Qloo entity and selected map location; event requirements such as “Coffee service” are not sent to Qloo. A successful Insights response with no usable entities becomes an empty discovery result; candidates returned without positive numeric affinity are instead counted in an explicit exclusion limitation. The raw response body and a saved Domino run are not available, so the evidence cannot distinguish an empty `results.entities` list from candidates filtered for missing/non-positive affinity or prove whether Qloo covers the brand. “Timing not returned” concerns trace duration metadata, not whether the Qloo response succeeded or contained candidate evidence.
- Found and fixed a real failure-to-empty presentation gap: missing Qloo configuration and Qloo authentication failures could fall through to “No candidates to compare” or a green completion line. The result UI now classifies both these cases as unavailable Qloo checks, and tests cover them.
- The previous yellow box used `discovery.status === "partial"`; all five private saved demo runs had that status, so it appeared for 5/5 even when all individual checks completed. The verdict now derives the warning from failed or skipped checks: 3/5 saved runs show it (two with incomplete AI interpretation, one with partner discovery skipped); the other 2/5 show the green completion line.
- The saved Qvxxqz Blorpblorp / Boise result triggers: “Partial result: Partner discovery was skipped because no matching business listing was verified.” The saved Blue Bottle Coffee / San Francisco run displays: “All checks completed: 5 partners checked, 3 rejected by the devil's advocate.”
- Abstention copy now gives spelling and market steps when map identity was not verified. If no resolvable critic finding exists, the mind-changing line states that none was returned rather than fabricating evidence.

### Verified

- `npm test`: 6 files passed, 56 tests passed, using the default timeout.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- `python -m pytest -q`: 67 passed; Ruff passed; mypy passed for 14 source files. No backend files changed in this follow-up.
- Ran the local backend with `VYUHA_SAVED_RUNS_DIR` pointing at `.vyuha-private/demo-runs` and the production frontend together. The health endpoint, a saved-run endpoint, and the frontend returned HTTP 200.
- Browser-checked saved recommended and abstention results at 375px and 1440px. Both were visibly marked “Saved result, not live”; no horizontal overflow was present. The recommended saved result showed the green completion line and collapsed Technical detail; the abstention refused to guess, gave spelling/market next steps, and hid Review possible partners.
- Browser-checked Back on `/about`, `/demos`, `/analyze`, `/result`, `/result/evidence`, `/result/partners`, and a partner-detail route; Back was absent on `/` and present on each other route.
- No commit or deployment was made.

### Blocked / unverified

- The exact Domino Qloo response body/result list is unavailable, so empty Insights entities cannot be distinguished conclusively from results filtered for missing/non-positive affinity; brand coverage is not established by HTTP 200 alone. No live Domino rerun was made.

## Task 5 reliability — October 22, 2026

### Done

- Start the `/health` ping in the background on first load. If it is still pending after three seconds, Demos and Try-your-own show: “Waking up the AI engine, this can take up to 40 seconds.”
- After 60 seconds, a live run shows a friendly long-running state and a Browse saved results action.
- On live-run failure, immediately show an already-loaded saved result only for the same demo, with its capture date and “Saved result, not live” label. For custom briefs, offer the saved gallery rather than substituting another business's result. If a same-demo run is not cached, look it up in the background while the failure and saved-results action are already visible.
- Demo cards now distinguish HTTP 404 (no configured saved file) from a backend/network/read error; failed checks no longer look like missing saved results.
- Updated the deployment guide with the Render Secret Files setup and the current cold-start and long-run behavior.

### Verified

- Frontend `npm run lint`, `npm run typecheck`, plain `npm test` (6 files, 59 tests, default timeout), and `npm run build`: passed.
- Backend `python -m pytest -q`: 67 passed; Ruff passed; mypy passed for 14 source files.
- Local browser check with the backend pointed at `.vyuha-private/demo-runs`: all five saved demo cards appeared with dated labels. Opened a saved verdict and confirmed its not-live label and capture date. At 375px and 1440px there was no horizontal overflow.
- Delayed the local `/health` response in the browser: the exact wake-up message appeared on both `/demos` and `/analyze` (Try your own business) after three seconds. The form remained blank.
- `git diff --check`: passed. No commit or deployment was made.

### Blocked / unverified

- The live Render service's Environment settings and Secret Files were not inspected, so the hosted deployment's current saved-file contents cannot be confirmed. The local directory contains all five expected private files, and the local backend/frontend loaded them successfully.

### Next

- In Render, confirm `VYUHA_SAVED_RUNS_DIR=/etc/secrets`, add the five `<demo-id>.json` files listed in `docs/deploy.md` under **Environment > Secret Files**, and redeploy. Verify each `/saved-run/<demo-id>` endpoint returns HTTP 200 and the Vercel gallery shows dated saved-result actions.

## Task 7 identity matching — October 23, 2026

### Done

- Identity matching now normalizes curly/straight apostrophes and quotes, diacritics, case, ampersands, whitespace, and missing apostrophes. OSM and Qloo brand matching share this normalization.
- Qloo candidate exclusion now checks the selected Qloo entity ID and normalized brand names with the location suffix after `|` removed. Independent, similarly named businesses remain eligible.
- Nominatim search continues to submit `<business name>, <full market>`. Exact locality checks now also recognize OSM `city_district` and `district` address fields used by non-US places.
- If Nominatim returns no exact local identity, or its lookup fails, a Qloo brand match still proceeds to Qloo Insights. Such a result is marked “Qloo only, not map-verified”; without a unique map location, Insights is not filtered to a specific branch and candidate places still undergo map checks.
- Added an “Any location (use the brand)” picker option alongside individual locations. That choice queries Insights without arbitrarily selecting a branch.
- Abstention UI now identifies rejected candidates, uses a neutral completed-check message, and makes “What would change my mind” reflect the actual missing evidence or critic finding.
- Added `backend/scripts/qloo_probe.py`, a diagnostic-only script that prints identity and Insights counts, never credentials or raw responses.

### Verified

- Frontend `npm run lint`, `npm run typecheck`, plain `npm test` (7 files, 64 tests), and `npm run build`: passed.
- Backend `python -m pytest -q`: 87 passed; Ruff passed; mypy passed for 15 source files, including the probe.
- The live probe was run for all three requested business/city pairs; results are reported in the task response. OSM returned multiple local matches for two pairs and no local match for one. The probe did not choose an arbitrary branch; when no unique map location was available, Qloo Insights was queried without a location filter.
- No commit or deployment was made.

### Blocked / unverified

- The live Qloo counts are observations from this probe run, not guarantees or city-specific audience claims. OSM matching remains based on exact normalized locality labels in returned address fields, not a geospatial city boundary.

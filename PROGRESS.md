# Vyuha progress — deployment readiness

Updated: October 21, 2026

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

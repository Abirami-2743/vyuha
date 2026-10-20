# Vyuha progress — deployment readiness

Updated: October 18, 2026

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

- Added five input-only demo briefs to the landing-page gallery, per-demo allowlisted saved-run reads, explicit identity selection, per-demo live-failure fallback, private capture and evaluation scripts, and Render secret-file instructions. Updated the example and Render LLM configuration to Groq primary and Mistral fallback.
- Captured five real runs from the local `.env` pipeline into the gitignored `.vyuha-private/demo-runs/`; each file validates against the API schema and includes its capture timestamp and deterministic identity-selection metadata. Captured outputs are not tracked.
- Evaluation counts from those five snapshots: 5 runs, 2 abstentions, 15 candidate downgrades, and 0 evidence claims without a source reference. These are counts only, not significance or performance claims; limitations are in `docs/evaluation.md`.
- Browser verified all five live buttons (including explicit identity pickers for Blue Bottle, The Ordinary, and Starbucks; the invented business returned the live empty state), all five saved-run views and their “not live” banners, a missing-file 404/hidden button, and 375px layout without horizontal overflow.
- Final checks: `python -m pytest tests -q` (64 passed), Ruff (all checks passed after removing two unused imports), mypy (13 source files), npm lint/typecheck, frontend tests (13 passed), and production build all passed. Ruff and frontend tests were rerun after their initial targeted failures were corrected.
- No commit or deployment was made. Hosted Render/Vercel secret-file and live-provider verification remains next.

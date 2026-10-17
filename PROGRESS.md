# Vyuha progress — Task 7 of 7

Updated: October 17, 2026

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

- Qloo Search/Place Insights, Nominatim same-city category checks, and the 100-mile-radius caveat were verified. Earlier task notes describe tracked artifacts in `docs/live-samples/` as sanitized; their compliance with the no-public-Qloo-response rule still needs review before release.
- Blue Bottle Coffee / San Francisco sample completed in the browser after explicitly selecting the Ferry Building location. Live Qloo Search and Insights returned HTTP 200; the page displayed the response-derived candidate count, critic cuts, recommendation/rating and next step.
- Browser fallback check: with the backend stopped and the page reloaded, the real sample request failed and the app loaded the private saved analysis with its capture date and “not live” banner. Identity selection remained user-controlled.
- Backend CORS, daily/per-IP limiter unit test, and request validation are covered. The local saved-run file was confirmed ignored by Git.
- Backend final checks: `python -m pytest tests -q` (56 passed), `python -m ruff check backend tests --config backend\pyproject.toml` (all checks passed), and `python -m mypy --config-file backend\pyproject.toml backend\app` (success, 13 source files).
- Frontend final checks: `npm run lint`, `npm run typecheck`, `npm run test` (8 passed), and `npm run build` (optimized build succeeded; `/api/saved-run` is dynamic).
- Judge review and before/after self-assessment are in `docs/judge-review.md`; scores are self-assessment, not measurement.
- `npm audit` reported 14 advisories (2 critical, 8 high, 4 moderate). Runtime: `next` (moderate) and `postcss` (high). Dev-only: `@next/eslint-plugin-next`, `@vitest/mocker`, `braces`, `chokidar`, `eslint-config-next`, `fast-glob`, `micromatch`, `postcss-nested`, `postcss-selector-parser`, `tailwindcss`, `tinypool`, and `vitest`. No force-fix was run.

## Blocked

- No local implementation blocker. The saved fallback needs a private file available to the frontend runtime; Vercel and Render do not share a filesystem, so deployment must provide the file to the frontend service or use an approved private storage arrangement.
- Existing tracked JSON artifacts in `docs/live-samples/` were not audited or changed in this task. Verify they contain no prohibited Qloo response data before making the repository public.
- The dependency advisories above remain unmodified.

## Next

- Final task: README section explaining what makes Vyuha Qloo-powered; audit repository contents, add/publish the public repo and license; deploy frontend on Vercel and backend on Render; complete the Devpost write-up and verify the hosted demo end to end.

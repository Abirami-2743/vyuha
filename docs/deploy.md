# Vyuha deployment guide

This guide deploys the frontend to Vercel and the API to Render's free web-service tier. The hackathon listing requires a public source repository. Keep credentials and saved Qloo-backed runs private; do not commit them.

## 1. Deploy the backend to Render

1. Sign in to [Render](https://dashboard.render.com/) using the GitHub account that can access the Vyuha repository.
2. Choose **New > Blueprint**, connect GitHub if prompted, select the public `Abirami-2743/vyuha` repository, and approve access to that repository. Render detects the root [`render.yaml`](../render.yaml) and creates the `vyuha-backend` web service.
3. Review the Blueprint. It uses the repository root, installs `backend/requirements.txt`, pins Python `3.12.11`, starts `backend.app.main:app` on Render's `$PORT`, enables proxy-header handling, and checks `/health`.
4. In the service's **Environment** settings, set the secret environment variables:
   - `QLOO_API_KEY`: your Qloo hackathon API key.
   - `LLM_API_KEY`: your Groq API key for the primary model.
   - `LLM_FALLBACK_API_KEY`: your Groq API key for the second model.
   - `LLM_MODEL`: the primary Groq model ID supported by your account.
   - `LLM_FALLBACK_MODEL`: a different supported Groq model ID.
   - `LLM_BASE_URL` and `LLM_FALLBACK_BASE_URL`: `https://api.groq.com/openai/v1`.
   - `CORS_ORIGINS`: exact Vercel production origin(s), comma-separated.
   The Blueprint marks these as unsynchronized so values must be entered privately in Render. Never put them in GitHub, Vercel, or browser-visible variables.
5. Save and deploy. The first free-tier start may take time. When the deploy is live, open `https://<render-service>.onrender.com/health`; expect HTTP 200 and `{"status":"ok","service":"vyuha"}`.

## 2. Deploy the frontend to Vercel

1. Sign in to [Vercel](https://vercel.com/dashboard), choose **Add New > Project**, connect GitHub if prompted, and select the same public repository.
2. Set **Root Directory** to `frontend`. Use the detected Next.js framework and default build command (`npm run build`), and keep the project on Vercel's free Hobby tier.
3. Before the first deploy, add `NEXT_PUBLIC_API_URL` in the project's Environment Variables. Set it to the Render origin, for example `https://vyuha-backend.onrender.com` (no trailing slash). This `NEXT_PUBLIC_` value is intentionally public and is embedded at build time. Do not add Qloo/LLM keys or `VYUHA_SAVED_RUN_PATH` to Vercel.
4. Deploy. Open the assigned Vercel URL and confirm the page loads.

## 3. Capture demo runs locally

From the repository root, configure `.env` with `QLOO_API_KEY` and both Groq model
configurations. Use `https://api.groq.com/openai/v1` for `LLM_BASE_URL` and
`LLM_FALLBACK_BASE_URL`, and supply distinct, supported model IDs through `LLM_MODEL` and
`LLM_FALLBACK_MODEL`. Keep both API keys private in `.env`.

Run the actual pipeline for all five input-only briefs:

```powershell
python -m backend.scripts.capture_demo_runs
```

The script reads the briefs from [`frontend/lib/demo-definitions.json`](../frontend/lib/demo-definitions.json)
and writes timestamped, schema-valid outputs to `.vyuha-private/demo-runs/<demo-id>.json`. The
directory is gitignored; keep the files private and do not add captured outputs to the repository.
When the pipeline requests an identity choice, the script selects the lexicographically first
returned option by case-folded display name and then stable provider identifier, independently for
each seed choice. The rule and any selections are recorded in the file metadata. No raw HTTP bodies
or credentials are written.

To refresh the aggregate counts in [`evaluation.md`](./evaluation.md) from those five real files:

```powershell
python -m backend.scripts.report_demo_evaluation
```

The report contains counts and limitations only, not captured Qloo outputs.

## 4. Allow the Vercel origin and upload saved runs

1. Copy the canonical Vercel production origin, such as `https://vyuha.vercel.app` (no path or trailing slash).
2. In Render **Environment**, update `CORS_ORIGINS` to a comma-separated list containing both local origins and the exact Vercel origin, for example `http://localhost:3000,http://127.0.0.1:3000,https://vyuha.vercel.app`. Do not use `*`. Save and redeploy the Render service.
3. In Render **Environment > Secret Files**, add one secret file for each available demo. The
   expected, case-sensitive filenames are:
   - `blue-bottle-san-francisco.json`
   - `the-ordinary-new-york.json`
   - `starbucks-chennai.json`
   - `nike-portland.json`
   - `qvxxqz-blorpblorp-boise.json`

   For each file, paste the matching private JSON output from
   `.vyuha-private/demo-runs/<filename>`. Render mounts these at
   `/etc/secrets/<filename>` for non-Docker services
   ([Render documentation](https://render.com/docs/configure-environment-variables#secret-files)).
   The backend must have `VYUHA_SAVED_RUNS_DIR=/etc/secrets`; this value is already in
   `render.yaml`. Do not upload these files to GitHub or Vercel. Each gallery card shows
   **View saved result, not live** only if its matching file is available to the backend.
4. The legacy `GET /saved-run` endpoint can still read a single file at
   `VYUHA_SAVED_RUN_PATH=/etc/secrets/saved-run.json`; upload that optional file separately only
   when a legacy client needs it. Render secret files are read-only, so
   `VYUHA_SAVED_RUN_OUTPUT_PATH` is deliberately unset in the hosted Blueprint.
5. Save changes and wait for Render to redeploy. The app reads files only on the backend; Vercel
   never needs access to them. To confirm each upload, open
   `https://<render-service>.onrender.com/saved-run/<demo-id>` for each ID:
   `blue-bottle-san-francisco`, `the-ordinary-new-york`, `starbucks-chennai`,
   `nike-portland`, and `qvxxqz-blorpblorp-boise`. Each configured run should return HTTP 200
   with its saved-run JSON; an HTTP 404 means the matching secret file is absent, invalidly named,
   or the backend directory setting is wrong. Then reload the Vercel `/demos` page and confirm
   each available card has **View saved result, not live** and a capture date after opening it.
   If the Vercel URL or secret files change, save the environment update and redeploy Render. If
   changing `NEXT_PUBLIC_API_URL`, rebuild/redeploy Vercel so the public build-time value is
   refreshed.

## 5. Verify the hosted flow

1. Check the Render `/health` URL again after the CORS update.
2. Open the Vercel URL in a private/incognito window and on a phone using cellular data (not the same Wi-Fi as your development machine). This checks that the app uses hosted services rather than local files or local network access.
3. Confirm the backend status becomes connected, run a gallery brief or type your own, resolve any identity choices, and verify that the result shows evidence and limitations returned by the live services.
4. Confirm each **View saved result, not live** action appears only when its per-demo file exists. Open one and verify it says **Saved result, not live** with its capture date. It must not be mistaken for a live analysis.
5. To verify the rate-limit fallback, make requests until a configured limit is reached. The response should explain the limit and direct the user to a saved run when one is configured. Defaults are 100 requests per client IP per UTC day and 1,000 per process per UTC day; set `ANALYSIS_PER_IP_DAILY_LIMIT` and `ANALYSIS_DAILY_LIMIT` in Render to change them. These in-memory counters reset when the instance restarts and are not shared across multiple instances.

## Environment variables

The Render Blueprint declares the runtime variables and defaults. Secrets are marked **Secret** here and must only be set in Render. Render supplies `PORT`; do not define it yourself.

| Variable | Secret? | Purpose / default |
|---|---|---|
| `PYTHON_VERSION` | No | Python runtime pin: `3.12.11` |
| `FORWARDED_ALLOW_IPS` | No | Uvicorn proxy trust; `*` on Render because requests arrive through Render's managed proxy. Do not expose the app through an untrusted direct proxy path. |
| `QLOO_API_KEY` | **Yes** | Qloo hackathon API credential |
| `QLOO_BASE_URL` | No | `https://hackathon.api.qloo.com` |
| `QLOO_TIMEOUT_SECONDS` | No | Qloo request timeout; `30` |
| `QLOO_MAX_RETRIES` | No | Qloo retry bound; `2` |
| `QLOO_RETRY_BACKOFF_SECONDS` | No | Qloo retry delay; `0.5` |
| `LLM_BASE_URL` | No | Groq (primary) endpoint using the OpenAI-compatible API format; `https://api.groq.com/openai/v1` |
| `LLM_API_KEY` | **Yes** | Groq primary LLM credential |
| `LLM_MODEL` | No | Required primary Groq model ID; set in Render Environment |
| `LLM_FALLBACK_BASE_URL` | No | Groq second-model endpoint; `https://api.groq.com/openai/v1` |
| `LLM_FALLBACK_API_KEY` | **Yes** | Groq credential for the fallback model |
| `LLM_FALLBACK_MODEL` | No | Required second Groq model ID; set in Render Environment |
| `LLM_TIMEOUT_SECONDS` | No | LLM timeout; `45` |
| `LLM_MAX_RETRIES` | No | Retry bound for transient non-429 provider errors; `1` |
| `LLM_RETRY_BACKOFF_SECONDS` | No | Transient-error delay and maximum short fallback 429 delay; `0.5` |
| `LLM_MIN_REQUEST_INTERVAL_SECONDS` | No | Minimum spacing between LLM requests; `1` |
| `LLM_HTTP_REFERER` | No | Optional client attribution header |
| `LLM_APP_TITLE` | No | App title; `Vyuha` |
| `CORS_ORIGINS` | No | Comma-separated exact origins; start with localhost and add the deployed Vercel origin |
| `MAX_REQUEST_BYTES` | No | Maximum request body; `1048576` |
| `ANALYSIS_PER_IP_DAILY_LIMIT` | No | Per-client-IP daily limit; `100` |
| `ANALYSIS_DAILY_LIMIT` | No | Per-process daily limit; `1000` |
| `VYUHA_SAVED_RUNS_DIR` | No | Directory containing per-demo secret files; `/etc/secrets` |
| `VYUHA_SAVED_RUN_PATH` | No | Optional legacy single saved-run file; `/etc/secrets/saved-run.json` |
| `VYUHA_SAVED_RUN_OUTPUT_PATH` | No | Optional writable location for locally persisting completed analyses; leave unset on Render |
| `LOG_LEVEL` | No | `INFO` |
| `NEXT_PUBLIC_API_URL` | No (public) | Vercel build-time backend origin; browser-visible by design; never place credentials here |

## Common failures and fixes

- **Render build uses the wrong Python or import fails:** confirm the Blueprint is at the repository root and `PYTHON_VERSION` is `3.12.11`. Keep the Render root directory at the repository root; the import path is `backend.app.main:app`.
- **Render deploy is healthy but API calls fail in the browser:** make sure `NEXT_PUBLIC_API_URL` is the full Render origin and rebuild Vercel after changing it. Add the exact Vercel origin to `CORS_ORIGINS` on Render, then redeploy Render.
- **A demo's saved-run button is absent:** `/saved-run/<demo-id>` returns 404 if its allowlisted
  file is missing. Upload the matching `<demo-id>.json` in Render **Environment > Secret Files**,
  keep `VYUHA_SAVED_RUNS_DIR=/etc/secrets`, and redeploy. The five valid IDs are listed above.
- **Legacy `/saved-run` is unavailable:** upload the optional `saved-run.json` secret file and set
  `VYUHA_SAVED_RUN_PATH=/etc/secrets/saved-run.json`.
- **Saved run returns an unavailable error:** verify the secret file is valid Vyuha saved-run JSON with `captured_at` and a schema-valid `analysis`. The API rejects malformed or oversized files rather than presenting broken data.
- **Cold start appears slow:** Render's free service may sleep while idle. Vyuha pings `/health` in the background on first load; if that check is still pending after three seconds, the Demos and Try-your-own pages say the AI engine may take up to 40 seconds to wake. A live analysis taking over a minute offers a link to saved results. If a live run fails, Vyuha immediately uses an already-loaded saved result for that same demo, or lets the user browse available dated saved results; it never substitutes an unrelated business's saved run.
- **Groq returns 429 during analysis:** the primary request immediately switches to the second configured Groq model. If that model also returns 429, Vyuha retries it once after a short delay and shows the busy message; when a saved run exists, Vyuha offers it as a clearly dated, non-live result.
- **429 response during judging:** the message includes a UTC reset interval and points to the saved run if available. Adjust the two analysis limit variables in Render before the judging session; an instance restart resets the in-memory counters.
- **LLM or Qloo service returns a rate limit/configuration error:** confirm the three secret values are set in Render and that the configured model/endpoints remain available. Vyuha reports integration failures and does not replace them with fabricated live evidence.

The backend's per-IP and daily limits are in-memory and per process. They are suitable for the single free-tier service configured here, not a distributed multi-instance quota.

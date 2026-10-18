# Vyuha deployment guide

This guide deploys the frontend to Vercel and the API to Render's free web-service tier. Keep the GitHub repository private; neither deployment requires publishing it.

## 1. Deploy the backend to Render

1. Sign in to [Render](https://dashboard.render.com/) using the GitHub account that can access the private Vyuha repository.
2. Choose **New > Blueprint**, connect GitHub if prompted, select the private `Abirami-2743/vyuha` repository, and approve access to that repository. Render detects the root [`render.yaml`](../render.yaml) and creates the `vyuha-backend` web service.
3. Review the Blueprint. It uses the repository root, installs `backend/requirements.txt`, pins Python `3.12.11`, starts `backend.app.main:app` on Render's `$PORT`, enables proxy-header handling, and checks `/health`.
4. In the service's **Environment** settings, set the three secret environment variables:
   - `QLOO_API_KEY`: your Qloo hackathon API key.
   - `LLM_API_KEY`: your Mistral API key.
   - `LLM_FALLBACK_API_KEY`: your OpenRouter API key.
   The Blueprint marks these as unsynchronized so values must be entered privately in Render. Never put them in GitHub, Vercel, or browser-visible variables.
5. Save and deploy. The first free-tier start may take time. When the deploy is live, open `https://<render-service>.onrender.com/health`; expect HTTP 200 and `{"status":"ok","service":"vyuha"}`.

## 2. Deploy the frontend to Vercel

1. Sign in to [Vercel](https://vercel.com/dashboard), choose **Add New > Project**, connect GitHub if prompted, select the same private repository, and grant Vercel access to it.
2. Set **Root Directory** to `frontend`. Use the detected Next.js framework and default build command (`npm run build`), and keep the project on Vercel's free Hobby tier.
3. Before the first deploy, add `NEXT_PUBLIC_API_URL` in the project's Environment Variables. Set it to the Render origin, for example `https://vyuha-backend.onrender.com` (no trailing slash). This `NEXT_PUBLIC_` value is intentionally public and is embedded at build time. Do not add Qloo/LLM keys or `VYUHA_SAVED_RUN_PATH` to Vercel.
4. Deploy. Open the assigned Vercel URL and confirm the page loads.

## 3. Allow the Vercel origin and upload the saved run

1. Copy the canonical Vercel production origin, such as `https://vyuha.vercel.app` (no path or trailing slash).
2. In Render **Environment**, update `CORS_ORIGINS` to a comma-separated list containing both local origins and the exact Vercel origin, for example `http://localhost:3000,http://127.0.0.1:3000,https://vyuha.vercel.app`. Do not use `*`. Save and redeploy the Render service.
3. In Render **Environment > Secret Files**, choose **Add Secret File**. Set **Filename** to `saved-run.json` and paste the contents of a valid, previously captured Vyuha run. Render mounts secret files at `/etc/secrets/<filename>` for non-Docker services ([Render documentation](https://render.com/docs/configure-environment-variables#secret-files)); the Blueprint points `VYUHA_SAVED_RUN_PATH` at `/etc/secrets/saved-run.json`. This file is a non-live fallback, not generated live evidence.
4. Save changes and wait for Render to redeploy. The app reads the file from the backend; Vercel never needs access to it. Render secret files are read-only, so `VYUHA_SAVED_RUN_OUTPUT_PATH` is deliberately unset in the hosted Blueprint.
5. If the Vercel URL or secret file changes, save the environment update and redeploy Render. If changing `NEXT_PUBLIC_API_URL`, rebuild/redeploy Vercel so the public build-time value is refreshed.

## 4. Verify the hosted flow

1. Check the Render `/health` URL again after the CORS update.
2. Open the Vercel URL in a private/incognito window and on a phone using cellular data (not the same Wi-Fi as your development machine). This checks that the app uses hosted services rather than local files or local network access.
3. Confirm the backend status becomes connected, run the sample brief or enter your own, resolve any identity choices, and verify that the result shows evidence and limitations returned by the live services.
4. Confirm **View a saved run** appears only when the backend has a saved file. Open it and verify the banner says **Saved run from `<date>`, not live**. It must not be mistaken for a live analysis.
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
| `LLM_BASE_URL` | No | Primary OpenAI-compatible endpoint; Mistral |
| `LLM_API_KEY` | **Yes** | Primary LLM credential |
| `LLM_MODEL` | No | `mistral-small-latest` |
| `LLM_FALLBACK_BASE_URL` | No | OpenRouter endpoint |
| `LLM_FALLBACK_API_KEY` | **Yes** | Fallback LLM credential |
| `LLM_FALLBACK_MODEL` | No | `openrouter/free` |
| `LLM_TIMEOUT_SECONDS` | No | LLM timeout; `45` |
| `LLM_MAX_RETRIES` | No | LLM retry bound; `1` |
| `LLM_RETRY_BACKOFF_SECONDS` | No | LLM retry delay; `0.5` |
| `LLM_MIN_REQUEST_INTERVAL_SECONDS` | No | Minimum spacing between LLM requests; `1` |
| `LLM_INVALID_OUTPUT_RETRIES` | No | Retry bound for invalid LLM output; `1` |
| `LLM_HTTP_REFERER` | No | Optional OpenRouter app attribution; set to the deployed Vercel origin if desired |
| `LLM_APP_TITLE` | No | OpenRouter app title; `Vyuha` |
| `CORS_ORIGINS` | No | Comma-separated exact origins; start with localhost and add the deployed Vercel origin |
| `MAX_REQUEST_BYTES` | No | Maximum request body; `1048576` |
| `ANALYSIS_PER_IP_DAILY_LIMIT` | No | Per-client-IP daily limit; `100` |
| `ANALYSIS_DAILY_LIMIT` | No | Per-process daily limit; `1000` |
| `VYUHA_SAVED_RUN_PATH` | No | Read-only saved-run file; `/etc/secrets/saved-run.json` |
| `VYUHA_SAVED_RUN_OUTPUT_PATH` | No | Optional writable location for locally persisting completed analyses; leave unset on Render |
| `LOG_LEVEL` | No | `INFO` |
| `NEXT_PUBLIC_API_URL` | No (public) | Vercel build-time backend origin; browser-visible by design; never place credentials here |

## Common failures and fixes

- **Render build uses the wrong Python or import fails:** confirm the Blueprint is at the repository root and `PYTHON_VERSION` is `3.12.11`. Keep the Render root directory at the repository root; the import path is `backend.app.main:app`.
- **Render deploy is healthy but API calls fail in the browser:** make sure `NEXT_PUBLIC_API_URL` is the full Render origin and rebuild Vercel after changing it. Add the exact Vercel origin to `CORS_ORIGINS` on Render, then redeploy Render.
- **Saved-run button is absent:** `/saved-run` returns 404 if `VYUHA_SAVED_RUN_PATH` is unset or the configured file is missing. Upload `saved-run.json` in Render **Environment > Secret Files**, use that exact path in the setting, and redeploy.
- **Saved run returns an unavailable error:** verify the secret file is valid Vyuha saved-run JSON with `captured_at` and a schema-valid `analysis`. The API rejects malformed or oversized files rather than presenting broken data.
- **Cold start appears slow:** Render's free service may sleep while idle. Wait for the request; Vyuha only labels the server as waking after five seconds without progress and can show the separately dated saved run if live analysis fails.
- **429 response during judging:** the message includes a UTC reset interval and points to the saved run if available. Adjust the two analysis limit variables in Render before the judging session; an instance restart resets the in-memory counters.
- **LLM or Qloo service returns a rate limit/configuration error:** confirm the three secret values are set in Render and that the configured model/endpoints remain available. Vyuha reports integration failures and does not replace them with fabricated live evidence.

The backend's per-IP and daily limits are in-memory and per process. They are suitable for the single free-tier service configured here, not a distributed multi-instance quota.

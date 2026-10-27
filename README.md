# Vyuha

**The unexpected partner finder that argues against itself.**

Vyuha helps a small business choose a non-obvious collaboration partner (a pop-up host, a shared-space neighbour, a cross-category brand) and then tries to talk you out of it before you spend a dollar. It uses [Qloo](https://www.qloo.com/) taste data to surface partners a keyword search would never suggest, checks that they are real and local, runs a devil's-advocate review of every candidate, and ends with a plain-English verdict: the best reason to try it, the biggest risk, and the cheapest first test.

When the evidence is not good enough, Vyuha says so. "No safe partner found" is a real answer, with a reason and next steps.

Built for the **Qloo Agentic Hackathon**.

- **Backend health check:** https://vyuha-2ku3.onrender.com/health
- **Source:** https://github.com/Abirami-2743/vyuha
- **Live app:** https://vyuha-rust.vercel.app/

---

## The problem

A small cafe wonders about a bakery. A skincare brand wonders about a gym. Most of the time the answer is a guess, and a bad guess costs real money: booth fees, inventory, a day of staff time. Recommendation tools usually answer with confidence. Vyuha answers with evidence, doubts, and a small experiment.

## What you see

1. **Describe your business** and what you want to try (for example, a one-day pop-up).
2. **Vyuha asks Qloo** which businesses in other categories share your customers' tastes.
3. **Vyuha checks the map** to confirm the candidates are real, local places.
4. **A devil's advocate** looks for reasons each candidate could fail.
5. **You get a verdict**, one of:
   - *"Vyuha recommends testing [partner]"* with the best reason, the biggest risk, and a cheap first test, or
   - *"Vyuha says no safe partner found"* with the specific reason and what to try next.

Every claim on the page is tagged with where it came from: **Qloo**, **map data**, **AI interpretation**, a **rule-based decision**, or **unknown**.

## Two real results

These come from saved runs captured on October 18, 2026, and are shown in the app with the label **"Saved result, not live"**.

**Blue Bottle Coffee, San Francisco, looking for a one-day pop-up partner.**
Vyuha checked 5 candidate partners, and the devil's advocate rejected 3 of them. It recommended testing **Galleria Park Hotel** as a shared-space host, and stated its own biggest risk: the taste signal comes from Qloo and is not corroborated by an independent audience source. The first suggested step is cheap: verify the hotel's identity and ask about availability, fees, and the event requirements before spending anything.

**"Qvxxqz Blorpblorp", Boise (a business that does not exist).**
Vyuha found no verified business listing, did not invent a partner, and answered *no candidate supported*. It states the reason and suggests what to try next. This is the behaviour the project is built around: refusing to guess.

## Why it is different

| Most recommenders | Vyuha |
|---|---|
| Always return an answer | Can refuse to guess, and says why |
| One confident pick | Rates each candidate, then challenges its own pick |
| Opaque reasoning | Every claim is source-tagged; step trace on the "How Vyuha decided" page |
| Mixes facts and AI guesses | AI interpretation is labelled and kept separate from Qloo and map evidence |
| Silent on limits | States what it never claims (see below) |

## What Vyuha will never claim

- Qloo taste affinity is **not** proof of shared customers or purchase intent.
- A map listing does **not** confirm ownership, availability, or willingness to partner.
- No partner is guaranteed to succeed. The output is a suggestion to test, not a promise.

## How Qloo is used

Qloo is the discovery engine, not decoration.

- **Qloo Search** resolves your business to a Qloo entity.
- **Qloo Insights** returns cross-category entities whose taste signals relate to your business. These are the candidate partners.
- Candidates without a positive, numeric Qloo affinity are excluded.
- Other branches of your own brand are excluded, so Vyuha never recommends that you partner with yourself.

Without Qloo, Vyuha would only find the obvious competitor next door.

## Architecture

```
Browser (Next.js, Vercel)
   |  streaming analysis + health checks
   v
FastAPI backend (Render)
   |
   +-- A  Identity       OpenStreetMap/Nominatim match, with name normalisation
   +-- B  Discovery      Qloo Search -> Qloo Insights
   +-- C  Verification   map checks on each candidate
   +-- D  Compare + critic   one batched AI interpretation call, one critic call
   +-- Rule-based decision, experiment plan, outreach draft (no AI calls)
```

- **LangGraph** pipeline with separate stages and a streamed step trace.
- **Groq** is the primary LLM; a **second Groq model** is the automatic fallback. On a rate limit (429) or timeout from the primary, the same call fails over to the fallback immediately. Every response is validated against a schema before it is used; invalid output gets one retry on the other model, then fails clearly.
- A full run with candidates makes **two** logical AI generations (candidate interpretation and the critic), both batched. Stages A to C, the decision, the experiment plan, and the outreach draft are deterministic code.
- **Saved results:** each demo has a dated saved run that is offered only when a live run is unavailable, always labelled **"Saved result, not live"** with its capture date.
- Per-IP and daily rate limits protect the live service.

## Reliability and honesty

- Failed calls are never shown as empty results; failures and "nothing found" are different messages.
- The yellow "partial result" notice appears only when a real check failed or was skipped, and it names what failed.
- The repository was audited for hardcoded or mock data, and no fabricated results are shipped. Demo businesses are input-only definitions.
- The app shows a wake-up message when the free-tier backend is starting, and offers the saved result if a live run fails or takes too long.
- At the time of writing, the backend test suite has 88 passing tests and the frontend has 64, with lint, type checks, and the production build all passing.

## Try it

1. Open https://vyuha-rust.vercel.app/ and choose **Try a demo**.
2. Pick **Blue Bottle Coffee (San Francisco)** for a recommendation, or **Qvxxqz Blorpblorp (Boise)** to watch Vyuha refuse to guess.
3. Or choose **Try your own business**, fill in the form (or tap an example chip), and run it live.
4. Open **How Vyuha decided** to see each pipeline step and where every claim came from.

## Run it locally

Requirements: Python 3.12, Node.js, a Qloo API key, and a Groq API key.

```bash
# Backend (from the project root)
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cp .env.example .env        # then fill in the values
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Frontend (second terminal)
cd frontend
npm install
# Windows PowerShell: $env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8000'
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

### Environment variables

Names only; see `.env.example` for the full list. Values are never committed.

| Variable | Purpose |
|---|---|
| `QLOO_API_KEY`, `QLOO_BASE_URL` | Qloo access |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Primary Groq model |
| `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_API_KEY`, `LLM_FALLBACK_MODEL` | Fallback: a second Groq model |
| `CORS_ORIGINS` | Allowed frontend origins |
| `VYUHA_SAVED_RUNS_DIR` | Folder of per-demo saved runs (optional) |
| `NEXT_PUBLIC_API_URL` | Backend URL used by the frontend |

Model IDs always come from the environment; none are hard-coded.

### Tests and checks

```bash
python -m pytest -q
python -m ruff check backend tests --config backend/pyproject.toml
python -m mypy --config-file backend/pyproject.toml backend/app

cd frontend
npm run lint && npm run typecheck && npm test && npm run build
```

## Who it is for, and how it could make money

Independent cafes, shops, and small brands planning collaborations or pop-ups, who have no research team and cannot afford a wasted partnership. Possible models: a monthly subscription for small businesses, and per-report pricing for agencies and shopping-district associations that plan collaborations for many members.

## Limits, stated plainly

- Results depend on how much Qloo data exists for a brand and city. Coverage is thinner in some markets, and Vyuha reports "no safe partner" when it cannot find one.
- Map verification relies on OpenStreetMap; a missing or differently named listing can stop a candidate from being verified.
- Taste affinity from Qloo is a relative signal inside one search, not a probability and not comparable across searches.
- The free-tier backend sleeps when idle, so the first request can be slow.
- Vyuha has not been validated against real partnership outcomes. It is a decision aid that recommends small, cheap tests, not a predictor of success.

## What's next

- Let owners record how a test went, so rankings can improve over time.
- Backtest against well-known real collaborations and publish the hits and the misses.
- Clearer coverage messages per city and category.
- A one-click shareable one-page plan.

## Built with

Qloo API, Groq, LangGraph, FastAPI, Next.js, OpenStreetMap / Nominatim, Render, Vercel.

## License

MIT
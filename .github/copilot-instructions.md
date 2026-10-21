# VYUHA: Core Brief
Qloo Agentic Hackathon 2026. Submission deadline: Oct 30, 2026, 11:45pm EDT.

## Role
Act as a principal architect, senior full-stack engineer, AI agent engineer, product designer, security engineer, QA engineer, and highly critical hackathon judge. Build Vyuha as a working application, not a convincing prototype. Make routine architectural decisions yourself. If a credential or dependency is missing, finish everything independent of it and report the exact blocker.

## Identity
Project: Vyuha. Tagline: "The unexpected partner finder that argues against itself."
AI-powered partnership discovery and decision-support agent for independent brand and local business owners planning pop-ups, events, and collaborations on small budgets.
Core concept: Vyuha discovers unexpected cross-industry partners using Qloo's real taste intelligence, compares them with conventional alternatives, challenges its own recommendation, and proposes low-cost experiments before the user spends money.
Use the name Vyuha everywhere. Never use PartnerLens.

## Vision
A skincare brand wants a pop-up partner. A popular fashion brand looks obvious, but popularity doesn't prove audience compatibility. Vyuha finds candidates outside the obvious industry, investigates cross-category taste affinity via Qloo, compares against a conventional alternative, and actively tries to disprove its own pick. Poorly supported unexpected candidate: reject it. Conventional candidate stronger: recommend it. Neither has enough evidence: abstain.
The defining feature is that Vyuha tries to disprove its own recommendations before the user commits money.

## Non-negotiable principles
1. Real functionality only. Never hardcode: candidate lists, brand taste affinities, Qloo responses or entity IDs, audience-overlap numbers, demographics or market stats, scores presented as measured facts, fake search results, revenue/attendance predictions, pretend API results. Recommendations come dynamically from real evidence. Hardcoding is allowed only for structure, config defaults, validation rules, UI components, evaluation criteria, and isolated test fixtures. Fixtures never enter the production pipeline or appear as live results. If an API fails, show an honest failure or partial-results state, never fabricated output.
2. Verify before assuming. Read the real, current Qloo docs before choosing endpoints. Use only documented, accessible capabilities; never invent endpoints, fields, relationships, or demographic insights. If Qloo can't support something, redesign it using verified capabilities and legitimate complementary sources, labeled as such.
3. Traceable evidence. Every important claim is tagged: qloo | external | ai_interpretation | unknown. Taste affinity is never proof of shared customers, identical demographics, purchase intent, attendance, or commercial success.
4. Never claim an integration, test, lint, or build passed unless you actually ran it and saw the output. Mark things "unverified" until proven.

## Architecture
Clean separation: frontend, backend API, Qloo client and integrations, agent orchestration, discovery, evidence provenance, evaluation, adversarial critic, decision logic, tests/eval. Typed schemas and explicit contracts. Secure env config, input and output validation, structured logging with secrets removed, timeouts, bounded retries for transient failures, rate-limit handling, classified external errors, client-safe messages, graceful partial failure, resource limits, reproducible dependencies. Qloo calls stay server-side. Treat user text and retrieved content as untrusted (prompt injection). If fetching user URLs, validate and block SSRF. Never swallow exceptions silently. No unnecessary databases, auth, microservices, or frameworks. Caching only where permitted and useful.

## Fixed stack (don't change without telling me)
- Backend: Python, FastAPI, LangGraph, Pydantic
- Frontend: Next.js + TypeScript + Tailwind
- Hosting: Vercel (frontend) + Render (backend), free tiers only
- LLM: ONE swappable OpenAI-compatible API client via env vars LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, plus LLM_FALLBACK_BASE_URL, LLM_FALLBACK_API_KEY, LLM_FALLBACK_MODEL. Use Groq (primary) with Mistral (fallback). No other code imports a provider SDK. Handle rate limits with backoff and automatic fallback.
- Secrets only in .env (gitignored) with a .env.example of placeholders. Qloo env var: QLOO_API_KEY. Never put secrets in source, frontend config, docs, logs, or commits. Never print secret values in terminal output.

## Working rules
- Maintain PROGRESS.md at the repo root: done / in progress / blocked / next / verified capabilities. Update it at the end of every task.
- You may run terminal commands (probes, tests, lint, builds) and must report their real output. If a key in .env is missing, say exactly which and continue with independent work.
- Do one task per chat. Do not start the next task. Finish the current one fully, not a scaffold.
- Cut order if time is short (last first): benchmark depth > caching > animations > extra edge-case tests. Never cut: real Qloo integration, critic, abstention, provenance labels.
- End each task with: what you did, commands you ran and real results, what's blocked, what's next.

## Final principle
No static mockup called an agent. No beautiful UI over fake data. Multiple LLM calls are not agentic behavior by themselves. Don't manipulate comparisons so surprising picks win. Don't fabricate evidence when data is missing. A skeptical judge should conclude: this team understood the problem, used Qloo for a real reason, built something complete, and proved what works.
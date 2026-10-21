# Vyuha architecture (Task 1 — documentation-verified capabilities)

This is an architecture proposal, not an implementation claim. The Qloo routes and parameters below are limited to capabilities checked against the official Qloo docs on October 14, 2026. Live access and response coverage are verified only by the probe output recorded in [PROGRESS.md](../PROGRESS.md).

## Product goal

Help independent brands and local businesses investigate a potential pop-up or collaboration partner before spending money:

1. Resolve a user-supplied seed entity.
2. Find candidates from a different Qloo entity category and a same-category alternative.
3. Challenge the apparent recommendation using only retrieved evidence.
4. Recommend an option only when evidence supports it; otherwise abstain.
5. Offer a low-cost experiment and outreach draft as clearly labeled AI interpretation.

Qloo affinity means a taste relationship, not shared customers, demographics, purchase intent, attendance, or commercial success. Tag claims as `qloo`, `external`, `ai_interpretation`, or `unknown`.

## Runtime boundaries

```text
Next.js frontend (Vercel)
    | user brief; no API keys
    v
FastAPI backend (Render)
    |-- Qloo client: documented hackathon API calls
    |-- Nominatim client: optional user-triggered place lookup
    |-- one OpenAI-compatible API client: Groq (primary model) with a second Groq model as fallback
    `-- LangGraph orchestration: bounded, typed nodes
```

Keep Qloo and LLM keys server-side. Validate inputs and structured LLM output, use request timeouts, redact headers, and expose classified client-safe errors. Retrieved content and user text are untrusted. No database, scraping, or unattended web fetching is required for v1.

## Qloo capabilities this design relies on

| Need | Documented request | Constraint |
| --- | --- | --- |
| Resolve a user-provided name | `GET /search?query=...&types=urn:entity:brand` | Search type values are endpoint-specific URNs. Use the ID returned by Qloo; never invent one. [Search reference](https://docs.qloo.com/reference/get-search) |
| Discover a cross-category candidate | `GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<resolved-id>` | This is a brand-to-place example; Qloo documents cross-category Insights and the hackathon guide documents GET/query parameters. [Cross-category overview](https://docs.qloo.com/docs/cross-category-insights), [hackathon guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Retrieve a same-category alternative | Make a separate Insights request with a documented output `filter.type` matching the seed type | This produces a separate result set. Never compare raw affinity values across separate queries as if they shared a scale. [Insights API](https://docs.qloo.com/reference/insights-api), [FAQ on affinity](https://docs.qloo.com/docs/faqs) |

The pipeline uses `/search`, `/v2/insights`, `filter.type`, `signal.interests.entities`, and the documented Place Insights `filter.location` WKT point plus `filter.location.radius`. The location filter was live-tested for the markets recorded in [PROGRESS.md](../PROGRESS.md); a 100-mile radius is not a city boundary. Do not rely on `/entities`, tags, demographics, explainability, or direct pairwise-candidate filters until separately checked against current docs and the hackathon host.

In the tested Insights response, `type` was the generic `urn:entity`, while `subtype` held the requested category (`urn:entity:place`). Preserve both response fields; do not treat the generic `type` value as the candidate category. This shape was observed on one live query, not guaranteed for every response.

## Pipeline and provenance

| Stage | Behavior | Evidence label |
| --- | --- | --- |
| Brief parsing | Extract requested seed, event context, location, and budget into a validated schema. Ask for clarification when required details are absent. | `ai_interpretation` |
| Entity search | Search only the requested name/type. If no unambiguous entity ID is returned, show an unresolved state and stop Qloo discovery. | `qloo` / `unknown` |
| Cross-category discovery | Feed the resolved ID to Insights, requesting a different documented `filter.type`; preserve the API's returned names and scores without synthesizing candidates. | `qloo` |
| Same-category alternatives | Run a separate Insights request using the seed category as output. Show this as a different result set, not a score directly comparable to the cross-category query. | `qloo` |
| Adversarial critique | Ask the LLM for potential failure hypotheses, each tied to supplied evidence or explicitly labeled unknown. The critic may veto or require abstention, but cannot introduce candidate facts. | `ai_interpretation` |
| Decision | Use an explicit policy. If a decision requires comparing affinity values across independent query contexts, treat them as incomparable and abstain rather than forcing a winner. | `qloo` + product policy |
| Experiment and outreach | Draft a small, budget-bounded test and optional message. Do not make revenue or attendance predictions or invent contacts. | `ai_interpretation` |

Empty results, unsupported entity types, and timeouts must remain visible as partial failure or abstention; never backfill with LLM-invented entities. Affinity score scales and ranks are query-context dependent; do not imply they are customer-overlap percentages.

## Implemented discovery stages A–D

`POST /discover` accepts the validated `BusinessBrief` plus optional explicit OSM/Qloo identity selections. The backend runs a LangGraph with these bounded stages:

1. **A — business identity:** query public Nominatim for the exact business name and requested city/market. Require one exact-name local listing, or return the matching OSM options for an explicit user choice. Then search Qloo for a brand entity using the business name only (never append the city). Prefer exact normalized name matches; if multiple exact matches exist, return those options. When no exact match exists, return up to five results whose response types include the requested brand type, label every option `not an exact match`, and require explicit user selection. Exclude results whose returned types establish that they are not brands; missing type metadata does not establish an exclusion. An explicit selection allows later discovery but does not verify that the Qloo entity is the supplied business, so identity is marked partially verified. A supplied website is not fetched. OSM and Qloo do not share an identifier, so cross-source entity linkage remains unverified.
2. **B — unexpected discovery:** use only the live-checked `urn:entity:brand` seed to `urn:entity:place` Insights query. Exclude the seed itself; retain only returned entities with positive numeric affinity, and cap independent checks at five. Use the selected business OSM coordinates for the documented WKT point/radius filter. The radius is not a city boundary; use returned Qloo city metadata only as Qloo evidence and check candidate locality independently. Missing/non-positive affinity and empty results remain visible as partial/empty states.
3. **C — independent verification and baseline search:** search Nominatim by each returned Qloo name and market, accepting a local match only when name and city exactly match. Keep candidates with no exact local OSM match, mark them unverified, preserve their Qloo evidence, and list missing evidence. Separately make one user-triggered category search for the stated industry in the requested market. Include up to three results only when returned OSM `category` or `type` exactly matches that industry and the address matches the requested city. These OSM-derived candidates are identity/location verified as OSM places; this does not establish current operation, availability, or willingness to collaborate.
4. **D — conventional baseline and comparison:** pass every Qloo candidate and each OSM category baseline through the comparison and critic rules. The OSM-only baseline is clearly labeled as having no Qloo taste query, so it is not like-for-like; it remains `SKIP` unless existing rules are met, and the absence of taste evidence is not relaxed. If category search finds no matching local result, or lookup fails, report the limitation. If that standard does not produce a candidate, say no defensible baseline was found while still returning the unexpected candidates. Never rank cross-query affinity values; in this implementation the unexpected and conventional classifications come from the same brand-to-place Insights response.

The comparison matrix records evidence relevance, query-relative taste signal, tentative AI-interpreted complementarity and goal alignment, possible category overlap, location/logistical suitability, budget compatibility, and uncertainty. Unavailable prices, operating status, event capacity, contacts, and willingness are unknown. The LLM receives only the brief and retrieved candidate evidence as untrusted data, returns structured hypotheses with evidence references, and cannot add candidates or verification claims. Calls are serialized and spaced. A primary 429 or timeout switches immediately to the fallback; one fallback 429 is retried after a short delay.

### LLM calls per full analysis

- Stages A–C make no LLM calls.
- Stage D makes at most one candidate-interpretation call, batched across all Qloo-backed candidates; it skips that call when there are none.
- The critic makes one call for the combined findings.
- Decision, experiment, and outreach use deterministic code and make no LLM calls.

A full run with candidates therefore uses two logical LLM generations, not one call per candidate. That batching already existed, so this change does not reduce the normal call count without reducing review coverage. On a primary 429 or timeout, the same generation switches directly to the fallback model. A fallback 429 gets one short retry; every provider's JSON is schema-validated before it can be used.

Nominatim requests are fixed to its official search host, user-triggered, limited to five results, and paced to at most one request per second in a single backend process. A returned exact-name/locality record supports only that OSM lists such a place. The public service is best-effort, may change, and is not a business registry or operating-status service. A multi-process deployment must enforce the per-application rate limit across workers before using the public endpoint.

## Task 4 — adversarial critic and deterministic decision

`POST /analyze` runs discovery then streams server-sent JSON progress events for identity,
candidate retrieval, verification, comparison, critic, decision, experiment, and outreach. Only
completed nodes are marked complete. The analysis graph has separate critic, decision,
experiment, and outreach nodes. The final event includes a compact trace with elapsed durations,
result counts, and observed upstream HTTP statuses for Qloo Search/Insights and map verification;
it contains no credentials or provider response bodies. These values are per-call/run metadata,
not measures of recommendation quality. Qloo and map records do not currently provide a reliable
chain-affiliation signal, so the interface labels chain status unknown rather than inferring it.

The critic receives rule-generated evidence facts, not candidate names or retrieved free text. It
can restate only allowlisted findings, with exact evidence references; invented references,
unsupported audience/demographic claims, and wording that introduces ungrounded terms are
rejected. If the LLM is unavailable or rejected, deterministic criticism and decisions still run
and the critic stage is marked degraded.

Provisional and final ratings come from deterministic rules, not an LLM. The provisional rating
requires positive Qloo evidence and a same-market signal; critic severity applies explicit
deductions. `STRONG FIT` requires verified local entity linkage and supported budget, logistics,
and goal evidence. If every candidate is `SKIP`, the overall result is `no candidate supported`.
A stronger conventional baseline wins over a lower-rated unexpected candidate; ties conservatively
favor the baseline without claiming commercial superiority. Full rules and deductions are in
[decision-logic.md](./decision-logic.md).

Experiments and outreach are generated only for `WORTH TESTING` or `STRONG FIT`. Suggested
success criteria are labeled, costs are items to verify, and outreach is a draft that discloses
uncertainty; no message is sent.

## Free complementary source: public OSM Nominatim

Use the free-at-point-of-use public [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/) only for user-triggered checks of returned candidates and one bounded same-industry category search. Its public usage policy is capacity-limited and may change, so this is not an SLA or a basis for high-volume/commercial reliance. The project must remain able to disable or switch this source.

For a single lookup, use `/search` with `q`, `format=jsonv2`, and a small `limit`; `addressdetails=1` and `extratags=1` are optional documented response fields. A match supports only the claim “OSM lists a matching place.” It does not prove that the business is currently operating, that the candidate owns the listing, or that it has an audience fit.

Follow the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/):

- Maximum one request per second per application; send an identifying User-Agent or Referer.
- Display OSM attribution and follow ODbL obligations.
- Do not implement autocomplete, systematic area searches, bulk POI downloads, or automated detail-page scraping.
- Cache repeated user queries, use a proxy where possible, and be ready to switch service.
- No match means `unknown`, not “business does not exist.”

## LLM and decision safeguards

Use Groq (primary model) with a second Groq model as fallback through the configured OpenAI-compatible API format. Model IDs come from environment variables. Request JSON output and validate it against a Pydantic schema. The LLM can parse briefs and draft evidence-bounded critique/experiments; it cannot create Qloo IDs, results, affinities, or external verification.

The decision layer abstains if:

- the seed entity cannot be resolved;
- no usable Insights results are returned;
- the critic finds a blocking evidence gap; or
- the preferred option depends on comparing incomparable cross-query scores.

Fixtures are isolated to tests and never enter the production recommendation path.

## Verified versus unverified

- **Verified by current docs:** hackathon API host/header, `GET /search`, `GET /v2/insights`, Search URN values, Insights `filter.type`, entity-interest signals, cross-category affinity, and affinity-score limitations. See the audit in [qloo-capabilities.md](./qloo-capabilities.md).
- **Verified for the complementary lookup:** Nominatim search parameters and public-instance policy, from the linked official docs.
- **Verified live for one query:** Qloo key authentication, name resolution, Search `entity_id`, and a non-empty brand-to-place response. The configured Groq primary and second-model fallback behavior still requires a fresh live verification.
- **Still requires live validation:** coverage for other queries/categories/locations, no-result handling, exact affinity fields/scales, and primary-provider JSON-mode/rate-limit behavior. See [PROGRESS.md](../PROGRESS.md).

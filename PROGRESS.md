# Vyuha progress — Task 3 of 7

Updated: October 15, 2026

## Done

- Task 1: audited the official Qloo and hackathon documentation; checked environment configuration; added Qloo/LLM probes and recorded live verified/unverified capabilities.
- Task 2: added Pydantic schemas, Qloo and OpenAI-compatible LLM clients, FastAPI health/configuration, safe structured logging, CORS/request limits, and isolated client tests.
- Task 3, stages A–D: added validated business briefs, explicit OSM/Qloo identity choices, LangGraph discovery, Qloo brand-to-place Insights, Nominatim verification, evidence-bounded interpretation, and a same-response conventional-baseline comparison.
- Qloo requests use the observed/documented `GET /search` and `GET /v2/insights` contracts. Search receives the business name only plus `types=urn:entity:brand`; it does not append city text. Insights uses the checked `filter.type=urn:entity:place` and `signal.interests.entities` parameters, with no location/tag filters.
- Qloo Search exact names are preferred. If none are returned, up to five results whose response `types` include the requested brand type are offered with `identity_match_label="not an exact match"` and the pipeline waits for an explicit Qloo entity selection. Results explicitly typed as a different entity kind are excluded. Brand type does not establish that a near-match is the intended business; explicit selection marks the identity only partially verified.
- Stage C retains candidates without an exact local OSM result as `unverified: no matching OSM listing found`, preserves their Qloo evidence, and records missing evidence. Ambiguous or unavailable checks also remain visible.
- Stage D passes all candidate checks through evidence-bounded interpretation/comparison. With an industry supplied, unverified candidates remain visible as unexpected results and can never become the conventional baseline. A missing baseline is explicit; verified exact OSM category/type matching remains the baseline rule.
- Added isolated synthetic tests for explicit near-match selection, entity-type filtering, Search query parameters without city augmentation, retained unverified candidates, baseline limitation, and Qloo Search type parsing. Fixtures are not live evidence.
- Updated [docs/architecture.md](docs/architecture.md) to match the current selection, verification, and comparison behavior.
- No `.env` values were printed. All seven required `.env` keys were present at run time.

## Live results — current `/discover` reruns

### Qloo Search discrepancy: The Ordinary

- Task 2 probe request: `GET https://hackathon.api.qloo.com/search?query=The+Ordinary&types=urn%3Aentity%3Abrand`.
- Pipeline request after selecting `node/5709446984` (26 Prince Street): the same `GET /search` with `query=The Ordinary` and `types=urn:entity:brand`. No city or market is appended.
- Replaying that exact request now returned HTTP 200 with `AOMG`, entity ID `E64B297C-3BFC-4247-B0BB-504A3548D50A`, types `["urn:entity:brand"]`. The current Task 2 probe and pipeline request parameters match. The prior Task 2 result is recorded as resolving the correct entity, but its raw response body was not retained; the historical result cannot be compared byte-for-byte. The observed difference is in Qloo's returned catalog result, not request construction.
- Current `POST /discover` returned HTTP 200, `status=needs_user_choice`: the Prince Street OSM record was selected/verified, and AOMG was returned only as an explicitly labeled `not an exact match` Qloo option. Its returned type is a brand, so the type filter alone cannot exclude it; the pipeline did not claim it was The Ordinary and did not run Insights or produce candidates/comparisons. An explicit Qloo entity choice is still required.

### Nike — clothes, Portland, Oregon

- `POST /discover` returned HTTP 200, `status=partial`. Selected OSM seed: Nike, `node/6508564691`, 638 Southwest 5th Avenue, Portland. Qloo Search resolved Nike, entity ID `C70CE2B8-0AD1-4150-BF18-5A6347F2E860`.
- Live Insights returned these five positive-affinity place entities; each retained its Qloo evidence reference `/v2/insights?filter.type=urn:entity:place&signal.interests.entities=C70CE2B8-0AD1-4150-BF18-5A6347F2E860`:
  - `ZT The Golden Hotel Barcelona` — `0.9423525470173761` — unverified, no matching Portland OSM listing.
  - `Mercedes Heritage Apartments Barcelona` — `0.9389725440634531` — unverified, no matching Portland OSM listing.
  - `Meliá Paris La Défense` — `0.9387765010871101` — unverified, no matching Portland OSM listing.
  - `Seven Hotel` — `0.9362683100709767` — unverified, no matching Portland OSM listing.
  - `Hotel SB Glow` — `0.9350479947320841` — unverified, no matching Portland OSM listing.
- All five candidates flowed into comparisons with verification uncertainty; no conventional baseline was available because no candidate had a verified OSM category/type matching `clothes`. Affinity is a Qloo relative signal for this query, not customer overlap.

### Nike — clothes, Barcelona, Spain

- An initial `POST /discover` returned HTTP 200, `status=needs_user_choice`, with two exact-name OSM Nike locations. For this additional example, the explicit location selection was `node/704065010`, Passeig de Gràcia 17, Barcelona.
- The selected run returned HTTP 200, `status=partial`, and resolved Nike to the same Qloo seed ID above. Insights returned the same five Qloo entities and query-relative affinities.
- `ZT The Golden Hotel Barcelona`, `Mercedes Heritage Apartments Barcelona`, `Meliá Paris La Défense`, and `Seven Hotel` remained `unverified: no matching OSM listing found` in the requested market.
- `Hotel SB Glow` had an exact-name OSM listing: `way/430222965`, Carrer de Badajoz, Barcelona, category `tourism`, type `hotel`. It is shown as a candidate with Qloo evidence and the independent OSM listing, not as proof that the two sources refer to the same entity or that the hotel is operating/available.
- All five candidates flowed into comparison. No conventional baseline was selected because no verified candidate's OSM category/type exactly matched the stated `clothes` industry. The response remained partial because four checks were unverified and operational/logistical evidence is missing.

Full captured JSON for all four endpoint responses (The Ordinary, Nike/Portland, Nike/Barcelona before location choice, and Nike/Barcelona after the explicit choice), plus the sanitized current Qloo Search replay, is retained in the current session artifact `live-discover-results.json`. It contains no credentials.

## Validation

- `python -m pytest tests -q` — **38 passed**.
- `python -m ruff check backend\app backend\scripts tests` — **All checks passed**.
- `python -m ruff format --check backend\app backend\scripts tests` — **21 files already formatted**.
- `python -m mypy --config-file backend\pyproject.toml backend tests` — **Success: no issues found in 22 source files**.
- Tests use synthetic fixtures and are not proof of live integration.

## Verified vs. unverified capabilities

### Verified with real calls

- Qloo authentication, Search for Nike and The Ordinary, and the checked brand-to-place Insights route.
- Qloo Search can return a brand-typed non-exact result (`AOMG`) for a The Ordinary query; current exact request construction is covered by a pipeline regression test.
- Nominatim returned exact local records for The Ordinary / New York, Nike / Portland, and Hotel SB Glow / Barcelona.
- `/discover` now returns the required near-match choice state and retains unverified candidates in candidate checks and comparisons. The live Nike/Barcelona case included one exact-name local OSM match.

### Still unverified

- The Qloo identity represented by `AOMG` is not verified as The Ordinary. The Ordinary discovery cannot continue until a user explicitly selects one of the offered Qloo results; this option remains a non-exact brand match.
- Cross-source Qloo/OSM identity linkage, current operations, ownership, event availability, price, contacts, willingness to collaborate, and commercial outcomes.
- Qloo affinity scale and cross-query comparability; affinity is not a shared-customer metric.
- OSM coverage beyond the tested places; a missing listing is not proof the business does not exist.
- Successful primary LLM structured output; previous Task 2 live checks observed primary rate limits and successful fallback.

## Next

- Finish the current live-result review; do not start Task 4 until requested.

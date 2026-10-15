# Vyuha progress — Task 3 of 7

Updated: October 15, 2026

## Done

- Task 1: audited official Qloo and hackathon documentation; created probes and recorded verified/unverified capabilities.
- Task 2: added the typed backend foundation, Qloo and LLM clients, FastAPI health/configuration, and isolated tests.
- Task 3, stages A–D: added validated discovery request/result contracts, optional business-industry input, exact-match OSM business resolution with user selection for ambiguity, Qloo seed resolution, LangGraph stages for cross-category discovery and verification, and a same-evidence comparison with a conventional baseline only when independently verified evidence exactly matches the user's stated industry.
- Added the FastAPI `POST /discover` endpoint.
- Qloo discovery is limited to the live-checked brand-to-place Insights request. It excludes the seed, non-positive affinity, and results with no numeric affinity; it does not invent a cutoff, compare scores across queries, use location/tag Insights filters, or fabricate candidates.
- Added Nominatim verification with fixed official host, bounded search results, an identifying User-Agent, 1 request/second pacing in one backend process, exact-name/locality matching, and explicit limits on what an OSM record verifies.
- Added one structured LLM interpretation call for verified candidates. Its claims are labeled `ai_interpretation`, cite only supplied Qloo/OSM evidence references, and do not prove feasibility or commercial fit. LLM requests are serialized and spaced; a `Retry-After` longer than the bounded wait leads to provider fallback rather than an early retry.
- Added synthetic test-only discovery fixtures and tests for identity ambiguity/selection, filtering, competition, baseline choice, provenance, different briefs, partial dependency failure, empty Qloo results, and LLM retry-after behavior.
- Updated [docs/architecture.md](docs/architecture.md), [docs/qloo-capabilities.md](docs/qloo-capabilities.md), `.env.example`, and this progress record.
- Completed two live `POST /discover` endpoint runs after Task 3. The first stopped honestly at Qloo seed identity; the second resolved a Nike seed but could not verify any of the returned high-affinity place entities in Portland, so it returned a partial result without recommendations or a baseline.
- Fixed one issue found during the live run: non-exact Qloo Search results were previously exposed as selectable business identities. The pipeline now only surfaces exact normalized name matches; a result such as Qloo's `AOMG` response for a `The Ordinary` query is rejected as an identity. Added a regression test.

## Live run outcomes

### The Ordinary — selected Prince Street, New York

- `POST /discover` returned HTTP 200 with `status=partial`; Nominatim verified the explicitly selected OSM record `node/5709446984`, 26 Prince Street, New York.
- Qloo Search returned HTTP 200 with one result, `AOMG` (`E64B297C-3BFC-4247-B0BB-504A3548D50A`), which did not exactly match `The Ordinary`. Name variants also returned unrelated beauty brands or the same unrelated result. The pipeline did not present these as selectable identities and did not run Insights, candidate verification, LLM interpretation, or baseline comparison.
- Qloo entity identity, candidates, and a defensible baseline are therefore **unverified/unavailable** for this brief; the partial response explains the unresolved seed.

### Nike — clothes industry, Portland, Oregon

- `POST /discover` returned HTTP 200 with `status=partial`; Nominatim returned the exact-name Nike record `node/6508564691` at 638 Southwest 5th Avenue, Portland.
- Qloo Search returned HTTP 200 and resolved the exact-name `Nike` brand. Brand-to-place Insights returned HTTP 200 with candidates. The five highest positive numeric-affinity results checked were `ZT The Golden Hotel Barcelona` (0.9423525470), `Mercedes Heritage Apartments Barcelona` (0.9389725441), `Meliá Paris La Défense` (0.9387765011), `Seven Hotel` (0.9362683101), and `Hotel SB Glow` (0.9350479947). Each carried Qloo evidence tied to the live Insights request.
- Nominatim returned HTTP 200 for each candidate lookup, but none had an exact-name listing in Portland. The five candidates are marked `not_found`; this only means no exact local OSM listing was returned for that request, not that the entity does not exist.
- No candidates passed independent local verification, so LLM interpretation and comparison were not run. The unexpected candidate list is empty, the conventional baseline is `null`, and the response explicitly states why no comparison is defensible. The Qloo affinity values are relative to this one query and are not a customer-overlap measure.

No `.env` values were printed.

## Live verification

### Qloo checks (October 15, 2026)

- `Nike`, Search type `urn:entity:brand`: HTTP 200, 5 results; top exact-name result `Nike`.
- `LEGO`, Search type `urn:entity:brand`: HTTP 200, 2 results; top result was `The Lego Group`, not an exact-name match, so selection/confirmation is required.
- `Tattly`, Search type `urn:entity:brand`: HTTP 200, empty results. This is a query-specific catalog gap, not proof the independent brand does not exist.
- Nike-to-place and The-Lego-Group-to-place Insights: HTTP 200, 20 place entities each.
- No Insights location or tag filter is planned or relied on; local-market checks use Nominatim.

### Nominatim and real brief

- Live Nominatim search for `The Ordinary, New York, NY`: HTTP 200, 2 exact-name listings in New York (Prince Street and West Broadway).
- The initial unselected `POST /discover` request returned `status=needs_user_choice`, `osm_status=ambiguous`, and both listing options. After selecting Prince Street, the final endpoint run continued to Qloo Search and stopped because no exact Qloo brand identity was returned.

## Validation (October 15, 2026)

- `python -m pytest tests -q` — **36 passed**.
- `python -m ruff check backend\app backend\scripts tests` — **All checks passed**.
- `python -m ruff format --check backend\app backend\scripts tests` — **21 files already formatted**.
- `python -m mypy --config-file backend\pyproject.toml backend tests` — **Success: no issues found in 22 source files**.
- Tests use synthetic fixtures and are not live-integration proof.

## Verified vs. unverified capabilities

### Verified with real calls

- Qloo authentication and Search/Insights for the tested brands and categories above, including the live Nike response used in the second `/discover` run.
- Qloo returns an empty Search result for the tested Tattly query without an HTTP error.
- Nominatim returns exact-name local OSM listings for the tested The Ordinary / New York and Nike / Portland queries.
- `/discover` safely stops on the non-exact Qloo `AOMG` result for The Ordinary; exact-name-only seed resolution is now regression-tested.
- `/discover` resolved Nike and called brand-to-place Insights, then returned partial with five Qloo results failing exact local OSM verification and no unsupported candidate/baseline claims.
- Earlier Task 2 LLM check: primary received HTTP 429 twice; configured fallback returned HTTP 200 and schema-valid JSON.

### Still unverified

- A successful full live B–D result with at least one independently identity- and location-verified Qloo candidate.
- Whether matching Qloo and OSM names refer to the same legal business/entity; the sources expose no shared identifier.
- Nominatim coverage outside this one New York query, current business operation, ownership, event availability, prices, contacts, or willingness to collaborate.
- Qloo catalog coverage outside the tested brand queries and brand-to-place Insights requests; Insights location/tag filters are intentionally unused.
- Qloo affinity score scale and cross-query comparability.
- Successful primary LLM structured output; previous live primary requests were rate limited.

## Next

- The Ordinary remains blocked by Qloo returning no exact-name seed match; do not substitute a related entity without independent identity evidence.
- Do not start Task 4 until requested.

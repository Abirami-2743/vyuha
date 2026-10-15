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

## Blocked / user choice required

- The real final brief stopped safely at Stage A. Nominatim returned two exact-name `The Ordinary` listings in New York. The API returned both options and did not call Qloo Insights or the LLM until the intended business location is selected. No location was silently chosen.
- The live checks used the configured Qloo key. No `.env` values were printed.

## Live verification

### Qloo checks (October 15, 2026)

- `Nike`, Search type `urn:entity:brand`: HTTP 200, 5 results; top exact-name result `Nike`.
- `LEGO`, Search type `urn:entity:brand`: HTTP 200, 2 results; top result was `The Lego Group`, not an exact-name match, so selection/confirmation is required.
- `Tattly`, Search type `urn:entity:brand`: HTTP 200, empty results. This is a query-specific catalog gap, not proof the independent brand does not exist.
- Nike-to-place and The-Lego-Group-to-place Insights: HTTP 200, 20 place entities each.
- No Insights location or tag filter is planned or relied on; local-market checks use Nominatim.

### Nominatim and real brief

- Live Nominatim search for `The Ordinary, New York, NY`: HTTP 200, 2 exact-name listings in New York (Prince Street and West Broadway).
- `POST /discover` pipeline run with a real The Ordinary / New York brief returned `status=needs_user_choice`, `osm_status=ambiguous`, and both listing options. Qloo seed search, discovery, and LLM interpretation did not run because user confirmation is required first.

## Validation (October 15, 2026)

- `python -m pytest tests -q` — **35 passed**.
- `python -m ruff check backend\app backend\scripts tests` — **All checks passed**.
- `python -m ruff format --check backend\app backend\scripts tests` — **21 files already formatted**.
- `python -m mypy --config-file backend\pyproject.toml backend tests` — **Success: no issues found in 22 source files**.
- Tests use synthetic fixtures and are not live-integration proof.

## Verified vs. unverified capabilities

### Verified with real calls

- Qloo authentication and Search/Insights for the tested brands and categories above.
- Qloo returns an empty Search result for the tested Tattly query without an HTTP error.
- Nominatim returns exact-name local OSM listings for the tested The Ordinary / New York query.
- The real brief reaches the implemented ambiguity guard and returns options rather than choosing an identity.
- Earlier Task 2 LLM check: primary received HTTP 429 twice; configured fallback returned HTTP 200 and schema-valid JSON.

### Still unverified

- Full live stages B–D after the user selects one of the two real business locations.
- Whether matching Qloo and OSM names refer to the same legal business/entity; the sources expose no shared identifier.
- Nominatim coverage outside this one New York query, current business operation, ownership, event availability, prices, contacts, or willingness to collaborate.
- Qloo catalog coverage outside the tested brand queries and brand-to-place Insights requests; Insights location/tag filters are intentionally unused.
- Qloo affinity score scale and cross-query comparability.
- Successful primary LLM structured output; previous live primary requests were rate limited.

## Next

- Await the user's selection of the intended The Ordinary location if they want to resume this exact live brief.
- Do not start Task 4 until requested.

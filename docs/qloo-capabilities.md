# Qloo API capabilities (docs review)

**Status:** docs were checked against current official references, and live calls were executed on October 14, 2026. One entity-search request and one brand-to-place Insights request both returned HTTP 200 with usable results. This verifies only the tested query and key, not general catalog coverage.

**Sources fetched (official):**

| Topic | URL |
| --- | --- |
| Knowledge center | https://docs.qloo.com/ |
| Hackathon developer guide | https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide |
| API onboarding / auth | https://docs.qloo.com/reference/api-onboarding |
| API overview | https://docs.qloo.com/docs/api-overview |
| Insights API (product) | https://docs.qloo.com/reference/insights-api |
| Insights API Deep Dive | https://docs.qloo.com/reference/insights-api-deep-dive |
| Parameter overview | https://docs.qloo.com/docs/parameter-overview (companion pages: Parameter Reference, Entity Type Parameter Guide in docs-public) |
| Parameter reference (public repo) | https://github.com/qloo/docs-public/blob/main/reference/parameters.md |
| Entity type parameter guide | https://github.com/qloo/docs-public/blob/main/reference/available-parameters-by-entity-type.md |
| Search entities | https://docs.qloo.com/reference/get-search |
| Entity search by ID (public repo) | https://github.com/qloo/docs-public/blob/main/reference/get-entities.md |
| Tags search (public repo) | https://github.com/qloo/docs-public/blob/main/reference/get-tags.md |
| Analysis compare (public repo) | https://github.com/qloo/docs-public/blob/main/reference/analysis-compare.md |
| Demographic insights (public repo) | https://github.com/qloo/docs-public/blob/main/reference/demographics-use-case.md |
| Cross-category insights | https://docs.qloo.com/docs/cross-category-insights |
| Entities | https://docs.qloo.com/docs/entities |
| Affinity | https://docs.qloo.com/docs/affinity-score |
| Interpreting affinity | https://docs.qloo.com/docs/interpreting-affinity-scores |
| FAQs | https://docs.qloo.com/docs/faqs |
| Location insights | https://docs.qloo.com/docs/insights-with-location |
| Public docs + OpenAPI note | https://github.com/qloo/docs-public |
| Terms of Use | https://www.qloo.com/legal/terms-of-use |
| Hackathon kit | https://github.com/qloo/qloo-hackathon-kit |
| Hackathon listing | https://qloo.devpost.com/ |

The file `openapi-schema.json` in `qloo/docs-public` is the **OpenAPI 3.1 meta-schema**, not Qloo’s path inventory. Do not treat it as Qloo endpoint documentation.

### October 14, 2026 verification spot-checks

These checks re-fetched the current official hackathon guide, `/search` API reference, Insights API page, cross-category overview, and hackathon listing. Documentation confirms the described contract, not general catalog coverage.

| Claim checked | Verified result | Source |
| --- | --- | --- |
| Hackathon key host and authentication header | The guide specifies `https://hackathon.api.qloo.com` and the `X-Api-Key` header | [Hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Insights method and parameters | The guide specifies `GET /v2/insights`, query-string parameters, and `filter.type` | [Hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Entity search route and inputs | API reference specifies `GET /search`, with `query` and `types` query parameters | [Search Entities reference](https://docs.qloo.com/reference/get-search) |
| Cross-category results | Qloo describes Insights affinities across entity categories, such as brand-to-restaurant and artist-to-destination | [Cross-Category Insights](https://docs.qloo.com/docs/cross-category-insights) |
| Insights output | The product page describes affinity scores from 0 to +1 and popularity scores as relative ranking within a category | [Insights API](https://docs.qloo.com/reference/insights-api) |
| Legacy recommendation routes | The hackathon guide says not to use `/recommendations` or `/recs`; it directs recommendation requests to `/v2/insights` | [Hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Private caching | The guide permits private server-side caching and prohibits placing Qloo response data in a public repository | [Hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Live response structures for the tested query | Search returned a `results` array with `entity_id`, `name`, `types`, and `properties`. Insights returned `results.entities`; result entries used generic `type: urn:entity`, category `subtype: urn:entity:place`, and numeric `query.affinity` | [Search Entities reference](https://docs.qloo.com/reference/get-search); [Insights API Deep Dive](https://docs.qloo.com/reference/insights-api-deep-dive); one live probe, not a guarantee for all results |

Correction made during this audit: the Search type values below are URNs (for example, `urn:entity:brand`), not the bare names previously listed as Insights-aligned Search enums. The live Search OpenAPI also defines `take` as an integer with an exclusive upper bound of 200; older public Markdown material differs, so the probe uses only the documented default and does not set `take`.

---

## 1. Authentication and required headers

**Hackathon keys (this project):**

- Request a key via the form linked from the hackathon developer guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key
- Keys are valid **only** against `https://hackathon.api.qloo.com`
- Hackathon keys **do not** work against `https://staging.api.qloo.com` or `https://api.qloo.com` (401 even if the key is valid)
- Pass the key in the `X-Api-Key` request header
- Do **not** pass it as a query parameter or as `Authorization: Bearer …` (401 “No API key found in request”)
- Python example from the guide: `headers = {"X-Api-Key": "YOUR_API_KEY"}` then `requests.get(...)`

**General docs (production/staging examples):**

- https://docs.qloo.com/reference/api-onboarding documents `X-Api-Key` (examples also show `x-api-key`)
- Search OpenAPI security scheme: `type: apiKey`, `in: header`, `name: X-Api-Key` (https://docs.qloo.com/reference/get-search)
- Terms: Access Keys are confidential; accounts/keys must not be shared (https://www.qloo.com/legal/terms-of-use §1)

**Vyuha rule:** keep `QLOO_API_KEY` server-side only.

---

## 2. Available endpoints and entity types

### Hackathon-supported surface

From https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide :

- **All documented Qloo endpoints are available** during the hackathon
- Primary recommendations/insights: **GET** `/v2/insights`
- Entity lookup: **GET** `/search`
- Tag IDs: **GET** `/v2/tags`
- Do **not** use `/recommendations` or `/recs` (legacy, not supported)
- `/search` and `/v2/insights` are separate; `/v2/insights/search` is **not** a valid path
- `/v2/insights` is **GET**; parameters go in the query string. POST JSON body to `/v2/insights` is documented as incorrect in the hackathon guide (will fail). The Parameter Reference still describes some fields as POST-only JSON; treat POST Insights as **unverified for hackathon keys** until a live probe proves otherwise
- Base URL alone is not an endpoint (404)

### Lookup / analysis / trends (documented; live access unverified)

From https://docs.qloo.com/docs/api-overview and https://github.com/qloo/docs-public README:

| Function | Documented route (production host in docs) |
| --- | --- |
| Insights / recommendations | `GET /v2/insights` |
| Search entities | `GET /search` |
| Search entities by ID / external IDs | `GET /entities` |
| Tags search | `GET /v2/tags` |
| Tag types | Tag Types API |
| Audiences | `GET` Find Audiences / Audience Types |
| Analysis compare | `GET /v2/analysis/compare` |
| Trending | trending / week-over-week routes |

### Insights `filter.type` values (hackathon guide)

- `urn:entity:artist`
- `urn:entity:book`
- `urn:entity:brand`
- `urn:entity:destination`
- `urn:entity:movie`
- `urn:entity:person`
- `urn:entity:place`
- `urn:entity:podcast`
- `urn:entity:tv_show`
- `urn:entity:video_game`

Deep Dive also lists `urn:heatmap` and `urn:entity:videogame` (no underscore). Use the **hackathon list** first; if a type 403s, it is unsupported for that key.

**Not supported (guide):** `urn:entity:music` (use artist); `urn:entity:food_and_drink` (use `place` or `brand`).

**Deprecated Insights types:** Actor, Author, Director → use `urn:entity:person` (entity type parameter guide).

### Search `types` (not identical to Insights)

From https://docs.qloo.com/reference/get-search :

The Search OpenAPI `types` enum uses URNs: `urn:entity:artist`, `urn:entity:book`, `urn:entity:brand`, `urn:entity:locality`, `urn:entity:movie`, `urn:entity:person`, `urn:entity:place`, `urn:entity:podcast`, `urn:entity:tv_show`, `urn:entity:videogame`, `urn:heatmap`, and `urn:entity:audience`. The Search reference marks `urn:entity:locality` as partially supported with Insights and `urn:entity:audience` as deprecated. Use the exact values documented for the endpoint; do not convert them to bare names.

Legacy Search types accepted by `/search` but not supported as Insights output categories include `urn:entity:actor`, `urn:entity:album`, `urn:entity:author`, and `urn:entity:director`. `urn:entity:locality` is partially supported with Insights only when used as entities in `signal.interests.entities`.

Catalog size: “over 250 million individual entities” (https://docs.qloo.com/docs/entities). Hackathon Devpost copy: “250M+ entities across music, film, dining, fashion, and more.”

---

## 3. Taste affinity and cross-category discovery

**What affinity is (and is not):**

- Affinity measures **how strongly two things are connected** (inputs such as entities, location, or preferences vs outputs). https://docs.qloo.com/docs/affinity-score
- FAQs: the score is **not** a survey percentage or sample share. https://docs.qloo.com/docs/faqs
- Interpreting guide (dashboard-oriented): scores **0–100**, expressed as a percentage; 0 = no correlation, 100 = perfect match. Ranges: >80 very high, 60–80 high, 50 medium, <50 low. Small gaps (91 vs 92) usually do **not** mean a meaningful difference. Scores are **normalized per query**; compare **rank/index**, not raw score across different queries. https://docs.qloo.com/docs/interpreting-affinity-scores
- Insights API product page: affinity scores **ranging from 0 to +1**. https://docs.qloo.com/reference/insights-api

**Scale discrepancy (0–1 vs 0–100):** both appear in official pages. **Live response field scale is unverified.** Map whatever the JSON actually returns; do not invent a conversion.

**Cross-category:**

- Qloo trains categories into a **shared embedding space** so Insights can connect e.g. brand↔restaurant or artist↔destination. https://docs.qloo.com/docs/cross-category-insights
- Mechanism in the API: same Insights endpoint; change `filter.type` (output category) vs `signal.interests.entities` / tags (input category)
- Qloo explicitly documents using affinity to help choose **brand partners**; still: high affinity ≠ shared customers, purchase intent, or event success. https://docs.qloo.com/docs/faqs and interpreting guide “Applying Scores to Brand and Campaign Decisions”

**Taste analysis:** tag-level breakdown of a taste vector via Insights (https://docs.qloo.com/docs/api-overview). Hackathon FAQ: Taste Analysis is a *way of using* Insights, not a separate product endpoint.

**Explainability (optional Insights param):** `feature.explainability=true` adds per-result and aggregate influence of input entities (normalized 0–1; entities scoring ≥0.1 always included). If it cannot be computed, a warning is returned and results still come back. Deep Dive. **Live availability on hackathon keys: unverified.**

**Demographics:** `filter.type=urn:demographics` with `signal.interests.entities` and/or tags returns age/gender affinity **distributions** (positive = stronger-than-average alignment, negative = lower). https://github.com/qloo/docs-public/blob/main/reference/demographics-use-case.md  
This is **not** proof of the user’s actual customers. Label as Qloo evidence / model inference.

---

## 4. Supported query parameters and filters

**Always required for Insights:** `filter.type`. https://docs.qloo.com/reference/insights-api-deep-dive and hackathon guide.

**Invalid parameters are silently ignored** (empty 200 with no error). Check the Entity Type Parameter Guide if results are empty. https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide

**Signals vs filters** (parameter reference):

- **Filters** shape *what* is returned (`filter.type`, tags, location, popularity, …)
- **Signals** shape *ranking* (`signal.interests.entities`, `signal.interests.tags`, demographics, `signal.location`)
- **Output:** `take`, `page` / `offset`

**Hackathon pitfalls:**

- Tags and audiences must be **Qloo IDs/URNs**, not free-text. Use `/v2/tags` and audience lookup. Error: “at least one valid signal or filter is required”
- Empty `entities` with HTTP 200: invalid params for that `filter.type`, **or** no data in the hackathon environment for that entity/region

**Parameters most relevant to Vyuha (documented):**

| Parameter | Role |
| --- | --- |
| `signal.interests.entities` | Input entity IDs (GET: comma-separated) |
| `signal.interests.tags` | Input tag URNs |
| `filter.tags` / `operator.filter.tags` | Constrain output tags (`union` / `intersection`) |
| `filter.exclude.entities` / `filter.exclude.tags` | Remove known entities/tags |
| `filter.results.entities` | Listed in the entity-type parameter guide. Its candidate-scoring semantics were not independently verified in this pass; do not rely on it in the architecture yet |
| `filter.popularity.min` / `.max` | Popularity percentile 0–1 |
| `filter.location` / `filter.location.query` / `filter.location.radius` | Place/destination geo filter (WKT lon-lat, locality ID, or locality name). Missing locality → 400 |
| `signal.location` / `signal.location.query` | Geo as a *signal* |
| `filter.geocode.*` | Exact geocode fields for place/destination |
| `filter.references_brand` | Places that reference a brand ID |
| `filter.properties.business_rating.min/max` | Place business rating |
| `sort_by` | `affinity` or `distance` (distance requires `filter.location`) |
| `take` | Insights: default 20, max **50** |
| `page` | Recommended pagination |
| `offset` | Alternative skip |
| `feature.explainability` | Optional contribution metadata |

**Brand vs place (critical):** the Entity Type Parameter Guide lists **no** `filter.location*` for `urn:entity:brand`. Location filters apply to **place** and **destination**. Local businesses as *venues* should use `urn:entity:place`. National/consumer brands use `urn:entity:brand`. Do not assume a brand query can be geo-fenced the same way as a place query.

---

## 5. Entity identification and resolution

- Each entity has a **stable Qloo GUID** (`entity_id`) used across the API. https://docs.qloo.com/docs/entities
- **Search:** `GET /search?query=…&types=…` resolves names → IDs. Optional geo: `filter.location` (lat,lon **or** WKT **or** UUID), `filter.radius` in **miles** (default 10, max 100)
- **By ID / external IDs:** `GET /entities` accepts `entity_ids` and many `external.*.ids` (Facebook, Instagram, Wikidata, Spotify, IMDB, …). https://github.com/qloo/docs-public/blob/main/reference/get-entities.md
- Insights can resolve some names via `filter.results.entities.query` / exclude-by-query (Parameter Reference; some **POST-only**). Hackathon guide insists Insights is GET — **unverified** whether name-resolution query params work on GET
- Enterprise “entity reconciliation service” (client IDs → Qloo IDs) is documented as an **advanced enterprise** offering, not a self-serve hackathon endpoint
- Entities must meet interaction/metadata thresholds; small local brands may simply not exist in the catalog

**Vyuha resolution path (docs-backed):** user text → `/search` (brand and/or place, optional locality) → take `entity_id` → `/v2/insights`. Never invent IDs.

---

## 6. Response schemas

**Insights (onboarding example):**

```json
{
  "success": true,
  "results": {
    "entities": [
      {
        "name": "…",
        "entity_id": "UUID",
        "type": "urn:entity",
        "subtype": "urn:entity:movie",
        "properties": { "description": "…", "image": { "url": "…" }, "…": "…" },
        "popularity": 0.99,
        "tags": [{ "id": "urn:tag:…", "name": "…", "type": "urn:tag:…" }]
      }
    ]
  },
  "duration": 22
}
```

https://docs.qloo.com/reference/api-onboarding

**Search (OpenAPI):** `{ "success": boolean, "duration": number, "results": [ entity, … ] }`  
Note: search `results` is an **array**, Insights `results.entities` is nested. Do not assume one shape.

**Search empty:** documented **404 No results** (not necessarily 200 + empty).

**Fields:** hackathon FAQ — you **cannot** filter returned fields; extract client-side. `akas` can be verbose.

**Affinity field name/scale on entities:** the tested live response exposed a numeric value at `entity.query.affinity`; this field path is only verified for that response shape. Its scale remains unverified because official pages describe both 0–1 and 0–100 conventions.

---

## 7. Geographic and local-business capabilities

Documented (https://docs.qloo.com/docs/insights-with-location , parameter reference, place entity type):

- Location by name (`filter.location.query` / `signal.location.query`), WKT POINT/POLYGON/MULTIPOLYGON (longitude first), locality entity ID, geohash
- Place filters: address, hours, price_level 1–4, hotel class, business rating, Tripadvisor/Resy where present, `filter.references_brand`
- Search radius around a point in **miles**; Insights `filter.location.radius` in **meters**
- Default locality queries slightly expand official boundaries; `filter.location.radius=0` disables that
- Qloo FAQs: OSM data is a **supplementary source** for Qloo itself (ODbL)

**Limits for a local pop-up planner:**

- Hackathon environment “may not have data for every entity or region”
- Brand Insights cannot use the place location filter set
- Qloo does not document a “currently operating / contact email / booking calendar” API
- Place popularity/rating are **not** foot-traffic or revenue

---

## 8. Rate limits, pagination, and errors

| Topic | Documented fact | Source |
| --- | --- | --- |
| Hackathon quota | Rate and monthly limits “high enough for typical hackathon projects”; raise via Discord `#api-help`; keys active through judging, then deactivated | Hackathon developer guide |
| Numeric RPS | **Not published** | same |
| Insights `take` | 1–50, default 20; use `page` | Deep Dive |
| Search `page` | 1–100, default 1 | get-search |
| Search `take` | Current Search OpenAPI schema: integer with exclusive maximum 200. Older public Markdown material differs; this project's probe does not set `take` | get-search |
| Tags `take` | max 50 | get-tags.md |
| Insights HTTP | 200, 400, 500 on Deep Dive | Deep Dive |
| Search HTTP | 200, 404 no results, 429 rate limit | get-search |
| Hackathon HTTP | 401 wrong host/header; 403 unsupported entity type; 200 empty entities | Hackathon guide |
| Silent ignore | Unsupported Insights params ignored | Hackathon guide |

Retry **429** with backoff. Do not retry 401/403 as transient.

---

## 9. Storage and reuse restrictions

**Hackathon developer guide (explicit for this event):**

- Private **server-side caching is allowed** with **no documented time limit**
- Do **not** store Qloo response data in a **public repository**

**Terms of Use** (https://www.qloo.com/legal/terms-of-use , last updated December 19, 2024):

- Cover Site, APIs, SaaS, Apps, and **data obtained from the APIs**
- Access keys confidential; no sharing seats
- **Site Data** (website copy) may not be stored/copied into a product
- No selling/reselling/redistributing/sublicensing the Services
- Qloo owns Qloo Output / Data / IP
- Input signals granted to Qloo for model improvement
- Additional API terms may be sent with bespoke documentation
- Must not pass illegal, deceptive, or rights-violating input signals

**Vyuha policy until legal/product says otherwise:** cache privately on the server for a session/run; never commit payloads; never expose raw Qloo dumps in the public repo; do not sell Qloo data.

---

## 10. Docs-verified vs still unverified

### Verified-by-docs (safe to design against)

- `X-Api-Key` header; hackathon host `https://hackathon.api.qloo.com`
- GET `/search` and GET `/v2/insights`; no legacy `/recs`
- Insights entity types listed in the hackathon guide
- Cross-category via `filter.type` ≠ input entity category
- Resolve names with `/search`, pass IDs as `signal.interests.entities`
- Affinity is cultural/taste correlation, **not** shared-customer proof
- Pagination `take`/`page`; Insights `take` ≤ 50
- Private server-side cache OK; no public-repo storage of responses
- 401/403/404/429/400/500 behaviors as documented above

### Verified by live probe on October 14, 2026

- `GET /search?query=The%20Ordinary&types=urn:entity:brand` returned HTTP 200 and a result containing `entity_id`.
- `GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<resolved-id>` returned HTTP 200 and a non-empty `results.entities` list.
- On that response, result category appeared in `subtype` (`urn:entity:place`), while `type` was the generic `urn:entity`; numeric affinity was at `query.affinity`.
- Probe output: `PASS entity_search status=200 resolved one brand entity`; `PASS cross_category_insights status=200 returned place entities`.

### Additional live checks on October 15, 2026

- Nike and LEGO Search returned HTTP 200, and both brand-to-place Insights calls returned HTTP 200 with 20 place entities. LEGO's top Search result was `The Lego Group`, not an exact string match to `LEGO`.
- Tattly Search returned HTTP 200 and an empty result list. This demonstrates that an independent brand name may have no Qloo entity in this environment, not that the business is nonexistent.
- No location/tag Insights filter was tried; none is relied on by the discovery pipeline.

These are one real query's results, not a claim that other entities, categories, or locations are covered.

### October 15, 2026 live checks for discovery stages A–D

The checks used the existing `QlooClient` with the configured hackathon key; no key value was printed. They used only `GET /search` and `GET /v2/insights`:

| Query | Result |
| --- | --- |
| Search `Nike`, `urn:entity:brand` | HTTP 200; 5 results; top exact-name result was `Nike` |
| Search `LEGO`, `urn:entity:brand` | HTTP 200; 2 results; top result was `The Lego Group`, so a user must select/confirm it rather than treating the name as exact |
| Search `Tattly`, `urn:entity:brand` | HTTP 200; 0 results. This confirms an empty Search response for this query only; it does not prove the independent brand does not exist |
| Nike to `urn:entity:place` Insights | HTTP 200; 20 place entities returned |
| LEGO result `The Lego Group` to `urn:entity:place` Insights | HTTP 200; 20 place entities returned |

No Insights location or tag filters were tested or are used by the Task 3 pipeline. Geography is checked separately with the documented, free-at-point-of-use OSM Nominatim search service and its limitations described in [architecture.md](./architecture.md).

### Still unverified

- Catalog coverage for small local brands and the user’s city
- Whether every Insights result uses the observed affinity field path, and whether the response scale is 0–1 or 0–100
- Search behavior for no-result queries; `take` maximum on the hackathon `/search`
- Whether GET Insights supports name-query resolution params
- `feature.explainability`, `/entities`, `/v2/tags`, `/v2/analysis/compare`, `urn:demographics` on the hackathon key
- Numeric rate limits and 429 headers
- POST Insights despite the hackathon GET-only warning

The key authenticated for the two successful calls above; broader key availability/quotas remain unknown. Location-filter details cited earlier in this document were not part of this pass's live-probed architecture and are not relied on by [architecture.md](./architecture.md).

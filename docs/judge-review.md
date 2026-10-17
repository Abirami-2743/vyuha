# Vyuha judge review

**Date:** October 17, 2026  
**Scores:** self-assessment, not a measurement. The before scores are based on a first-time browser run of the local app with the Blue Bottle Coffee / San Francisco brief; after scores will be reassessed after this task.

## Phase 1: requirements and Qloo evidence

- **Theme:** The electrician lighting question is not a required theme. The Devpost page introduces it as one of three “Don't be afraid to think laterally” examples. The requirement is a working Qloo-integrated application that uses cultural intelligence as a differentiator.
- **Submission requirements:** (1) link to a functional, end-to-end demo; (2) public source repository with run instructions; (3) written feature/workflow description explaining what makes it Qloo-powered; (4) externally hosted and fully published demo (local-only/private access does not qualify); (5) open-source license visible in the repository About section. Demo videos are not required.
- **Qloo data reuse:** The hackathon developer guide permits private server-side caching, but explicitly prohibits storing Qloo response data in a public repository. Qloo's Terms also prohibit selling/reselling/redistributing/sublicensing Services. A saved fallback must therefore be private and not committed; use a server-side file path supplied through an environment variable, and label its capture date and non-live status.
- **Earlier winners search:** One Google search for Qloo hackathon winners returned no reliable winner/project information. No winners are asserted here.

### Qloo capability inventory beyond (or broader than) the live-tested path

“Live-tested” means the capability itself was exercised for the recorded queries, not merely documented. The current app's live-tested Qloo path is entity Search and cross-category Insights (brand-to-place); spot checks do not establish general catalog coverage.

| Capability | Status |
| --- | --- |
| Search-resolved entity details (`/entities`), returned properties/descriptions/images, and returned entity tags | Documented-only beyond the Search results used for identity resolution |
| Tag lookup (`/v2/tags`), tag types, tag-interest signals, and tag filters | Documented-only |
| Additional Insights signals and filters: location signals, location/popularity/tag/exclusion filters, distance sorting and pagination | Documented-only; the live spot checks tested entity-interest input and place output |
| Audience lookup / audience types | Documented-only |
| Demographic Insights (age/gender affinity distributions; not a user's actual customers) | Documented-only |
| Insights explainability (`feature.explainability=true`) | Documented-only; hackathon-key availability is unverified |
| Other Insights entity types: artist, book, brand, destination, movie, person, podcast, TV show and video game | Documented-only beyond brand input/place output in the recorded live calls |
| Cross-category Insights, Search entity resolution and returned numeric affinity for tested brand/place queries | Live-tested; the returned affinity scale remains unverified and affinity is not customer overlap or purchase intent |

Sources: current Devpost listing, the official Qloo hackathon developer guide and official reference pages summarized in [qloo-capabilities.md](./qloo-capabilities.md). Direct web fetches of the Devpost page returned 403; the listing itself was read in the browser.

## First-time visitor assessment

**Scenario:** Opened the local app and submitted a Blue Bottle Coffee / San Francisco brief. The app surfaced several same-name business locations and waited for an explicit identity choice; I selected the Ferry Building listing. It then returned actual live analysis, including a partial-results warning, a Qloo-supported unexpected candidate rated “WORTH TESTING,” and a conventional alternative. No fabricated result or outcome was observed.

- **Estimated time to understand (self-assessment):** The heading and four-step flow explain the product in about 15 seconds, but the visitor is not told plainly who the product is for, what decision it helps with, or what Qloo contributes.
- **Confusing/friction point:** The path requires “Start,” several manual fields, and then identity resolution before the visitor sees any result. The identity picker is appropriately explicit, but the form makes a judge work to reach the distinctive behavior.
- **Result experience:** The decision and candidate are present near the top of the response, with provenance and warnings; however, there is no single scan-friendly verdict that combines candidate count, critic cuts, recommendation/rating and next step. The full response is long. Eleven disclosure panels were collapsed in this run, but experiment plans remain lengthy.
- **Broken / misleading:** Opening `127.0.0.1:3000` produced a browser CORS error against the local API; using `localhost:3000` worked. The live response honestly disclosed partial results and a 100-mile radius caveat. No claims looked invented in the inspected run. The local host mismatch is a development configuration issue, not evidence about hosted deployment.

## Before self-assessment

| Criterion | Score / 10 | Short justification |
| --- | ---: | --- |
| Technological implementation | 7 | Real Search + cross-category Insights, orchestration, critique, deterministic ratings, abstention and provenance are visible; the user-facing Qloo rationale and a robust demo/offline path need strengthening. |
| Design | 6 | The visual language and end-to-end flow are coherent and disclosure panels reduce clutter, but the first action is manual and the result lacks a compact verdict. |
| Potential impact | 6 | The budget-conscious independent-business use case is credible, but the landing page does not yet make that specific problem vivid or immediate. |
| Quality of the idea | 8 | Cross-industry discovery plus a critic that tries to disprove its own pick is distinctive and appropriately avoids equating taste affinity with customer overlap. |

## Top 10 weaknesses, ranked by expected score gain per effort

| Rank | Weakness / improvement | Expected score gain per effort |
| ---: | --- | --- |
| 1 | Add a one-click Blue Bottle / San Francisco sample brief that runs the real pipeline without silently choosing an identity | Very high |
| 2 | Put a data-derived verdict at the top: candidates found, critic cuts, recommendation/rating and actionable next step | Very high |
| 3 | Explain the independent-business partner-choice problem, critic stages and Qloo's specific contribution on the landing page | High |
| 4 | Make backend cold start, retryable rate limiting and saved-run status understandable rather than leaving a visitor guessing | High |
| 5 | Provide an honest dated saved-run fallback for backend failures, explicitly marked not live and kept out of the public repo | High |
| 6 | Give the backend bounded per-IP and daily usage limits so an open demo is less likely to exhaust free-tier capacity | Medium-high |
| 7 | Keep detailed evidence and critic material collapsed while making the decision and rationale scannable | Medium; existing disclosure panels are collapsed, but the result remains long |
| 8 | Make Qloo evidence distinguishable from external verification, AI interpretation, unknowns and rule-based decisions on every important claim | Medium; much of this exists and must remain accurate |
| 9 | Fix the local `localhost` versus `127.0.0.1` CORS mismatch encountered on the default frontend URL | Medium |
| 10 | Publish the demo, public repository, license, run instructions and Qloo-powered explanation needed for eligibility | Essential for submission, but outside this local product build |

## After self-assessment

| Criterion | Score / 10 | Short justification |
| --- | ---: | --- |
| Technological implementation | 8 | Live Qloo-backed cross-category results now have a query-grounded explanation; the flow shows a data-derived verdict, applies request caps, and can load a private dated fallback. Public hosting is still unverified. |
| Design | 8 | The landing page states the customer problem and Qloo's bounded role, a sample starts the real flow, identity still requires an explicit choice, and results lead with the verdict. Long experiment details remain a scanability opportunity. |
| Potential impact | 7 | The independent-business / low-budget use case and cautious next step are clearer, while the UI avoids commercial forecasts. No deployment or user study has been completed. |
| Quality of the idea | 8 | The self-challenging, abstaining cross-industry concept remains distinctive; this build makes the reasoning and product value easier to see without changing the concept. |

The browser sample completed through live Search and Insights calls. Its displayed counts, recommendation, rating and next step came from that response; after stopping the backend and reloading, the app showed the private saved analysis with its capture date and “not live” label. The Qloo-derived saved file is outside the public repository.

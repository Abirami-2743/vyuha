# Vyuha critic and decision rules (Task 4)

This document describes deterministic policy, not a statistical model. Ratings are not
probabilities, market forecasts, or predictions of commercial success.

## Evidence presented to the critic

Every criticism is based on structured facts already in the discovery response. Its
`supporting_evidence_references` must match the rule's allowlisted references exactly.
References can point to returned Qloo/OSM evidence or a named field in the validated brief,
candidate, verification record, comparison, or location query. Unknown references reject the
LLM-authored wording; the deterministic finding remains available.

The rule critic checks:

- Qloo is the only taste source and affinity is not a measure of audience overlap or outcomes.
- Independent map verification is missing, ambiguous, or unavailable; a matching OSM name does
  not prove linkage to a Qloo entity.
- Discovery used user-supplied seed brands rather than a Qloo entity for the user's own business.
- A Qloo radius is not a city boundary.
- Candidate costs, availability, capacity, permissions, and willingness to collaborate are not
  established.
- The brief's constraints have not been checked against candidate evidence.
- Whether a conventional baseline exists and, where supported, whether it has stronger evidence.
- Whether the candidate is explicitly out of market or has no positive Qloo signal.
- An OSM-only conventional baseline has no Qloo taste query, so it is explicitly not a
  like-for-like affinity comparison. Its verified same-city OSM category evidence does not
  substitute for taste evidence.

The LLM receives only deterministic finding templates and their citations, not candidate names
or retrieved free text. It may restate those findings, but cannot add findings or change severity.
Every returned citation must be identical to the rule's allowlist. Output that cites an unknown
reference, adds terms outside the rule wording, or makes claims about customers, audience overlap,
demographics, attendance, purchase intent, or outcomes is rejected. Rule-based wording is used
instead, and the response reports that fallback.

## Provisional rating

For each candidate, start with a provisional rating using these rules in order:

1. `SKIP` if the candidate is out of market, lacks a positive numeric Qloo affinity (including
   per-seed affinities), lacks Qloo evidence, or has neither same-market OSM evidence nor a Qloo
   same-city label.
2. `STRONG FIT` only if the candidate has verified same-city OSM evidence, verified Qloo-to-OSM
   entity linkage, a business-brand (not user-supplied-seed) basis, and supported budget,
   logistical-suitability, and goal-alignment criteria.
3. Otherwise, `WORTH TESTING` when the candidate has positive Qloo evidence and a same-market
   signal. This is a cautious test rating, not an endorsement.

## Critic adjustment

Apply severity-based deductions after the provisional rating:

- Each high-severity finding deducts one rating level.
- Three or more medium-severity findings cap `STRONG FIT` at `WORTH TESTING`.
- Medium-severity findings alone do not turn `WORTH TESTING` into `SKIP`; unresolved high-severity
  issues are required to veto a test at that level.
- Low-severity findings do not deduct a level.
- Ratings cannot fall below `SKIP`; deductions never raise a rating.

The ordered levels are `STRONG FIT` → `WORTH TESTING` → `SKIP`. The final response records the
provisional rating, final rating, and the specific finding codes responsible for deductions.
Critic severity and final ratings are policy outputs, not measured scores.

## Overall result and baseline

If every candidate's final rating is `SKIP`, the overall result is `no candidate supported`
(abstention). Otherwise select the highest final rating. If the conventional baseline ties for
the highest rating, choose it as a conservative tie-break; this does not establish commercial
superiority. A baseline with a higher final rating wins over a lower-rated unexpected candidate.
Affinity values from separate seed queries are never combined or ranked against each other.

In addition to verified same-industry Qloo candidates, discovery performs one user-triggered
Nominatim category search and includes up to three results only when their returned OSM
`category` or `type` exactly matches the brief's industry and their OSM address matches the
requested city. These OSM-only candidates receive the same downstream comparison and critic
rules, but have no Qloo affinity and therefore receive `SKIP` under rule 1. They cannot win or
tie-break on absent taste evidence; this is an intentionally non-like-for-like reference point.
If the search finds no matching local records, or the lookup fails, the limitation is explicit.

## Experiments and outreach

Create an experiment and draft outreach only for `WORTH TESTING` or `STRONG FIT`. Experiments
describe costs to verify rather than inventing prices, and success criteria are explicitly labeled
as suggested targets. They must not introduce attendance, conversion, or revenue forecasts.

Outreach drafts use the candidate name as a lead label, the user's stated goal, and the recorded
Qloo rationale. They disclose that identity, Qloo/OSM linkage, current operation, availability,
costs, and willingness have not necessarily been verified. No message is sent.

## Progress stream

`POST /analyze` streams server-sent JSON events. Discovery identity, candidate retrieval,
verification, comparison, critic, decision, experiment, and outreach each have progress statuses.
A stage is reported complete only after its node returns. If structured LLM critique fails or is
rejected, critic rules still run and the event is marked degraded; the deterministic decision
continues.

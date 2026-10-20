# Demo run evaluation

Generated from the five private captured runs on 2026-10-18.

| Measure | Observed count |
|---|---:|
| Runs | 5 |
| Abstentions | 2 |
| Candidates downgraded by the critic | 15 |
| Claims without a source reference | 0 |

These are counts from this fixed set of saved analyses, not estimates or significance tests. The runs are dated snapshots, not live results. Candidate counts depend on API coverage, brief inputs, provider behavior, and capture time. A downgrade is counted only when a candidate's final rating is lower than its provisional rating. A claim without a source reference is a non-empty `claim` field with no non-empty `source_reference` in the validated analysis evidence; this does not assess whether a cited source proves the claim. No conclusions about general performance, audience overlap, demand, or commercial outcomes should be inferred.

Captured Qloo-backed analyses are kept out of Git; rerun `python -m backend.scripts.report_demo_evaluation` after capturing runs to refresh these counts.

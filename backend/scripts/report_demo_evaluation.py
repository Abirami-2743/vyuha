"""Summarize measured counts from the five private saved demo runs."""

from __future__ import annotations

import json
from typing import Any

from backend.app.analysis_models import AnalysisResult
from backend.app.settings import REPOSITORY_ROOT

DEMO_DEFINITIONS_PATH = REPOSITORY_ROOT / "frontend" / "lib" / "demo-definitions.json"
RUNS_DIRECTORY = REPOSITORY_ROOT / ".vyuha-private" / "demo-runs"
EVALUATION_PATH = REPOSITORY_ROOT / "docs" / "evaluation.md"
DEMO_IDS = frozenset(
    {
        "blue-bottle-san-francisco",
        "the-ordinary-new-york",
        "starbucks-chennai",
        "nike-portland",
        "qvxxqz-blorpblorp-boise",
    }
)
RATING_VALUE = {"SKIP": 0, "WORTH TESTING": 1, "STRONG FIT": 2}


def _claims_without_source_reference(value: Any) -> int:
    if isinstance(value, dict):
        missing = int(
            isinstance(value.get("claim"), str)
            and bool(value["claim"].strip())
            and not (
                isinstance(value.get("source_reference"), str)
                and value["source_reference"].strip()
            )
        )
        return missing + sum(_claims_without_source_reference(item) for item in value.values())
    if isinstance(value, list):
        return sum(_claims_without_source_reference(item) for item in value)
    return 0


def main() -> None:
    definitions = json.loads(DEMO_DEFINITIONS_PATH.read_text(encoding="utf-8"))
    if (
        not isinstance(definitions, list)
        or any(not isinstance(item, dict) for item in definitions)
        or {item.get("id") for item in definitions} != DEMO_IDS
    ):
        raise ValueError("The frontend demo definitions must contain the five allowlisted IDs.")
    runs: list[tuple[str, AnalysisResult]] = []
    for definition in definitions:
        path = RUNS_DIRECTORY / f"{definition['id']}.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        result = AnalysisResult.model_validate(payload["analysis"])
        runs.append((definition["id"], result))

    abstentions = sum(
        result.overall_decision.result == "no candidate supported" for _, result in runs
    )
    downgraded = sum(
        RATING_VALUE[decision.final_rating] < RATING_VALUE[decision.provisional_rating]
        for _, result in runs
        for decision in result.candidate_decisions
    )
    claims_without_source = sum(
        _claims_without_source_reference(result.model_dump(mode="json")) for _, result in runs
    )
    counts = {
        "Runs": len(runs),
        "Abstentions": abstentions,
        "Candidates downgraded by the critic": downgraded,
        "Claims without a source reference": claims_without_source,
    }
    captured_dates = [
        json.loads((RUNS_DIRECTORY / f"{demo_id}.json").read_text(encoding="utf-8"))["captured_at"]
        for demo_id, _ in runs
    ]
    lines = [
        "# Demo run evaluation",
        "",
        f"Generated from the five private captured runs on {max(captured_dates)[:10]}.",
        "",
        "| Measure | Observed count |",
        "|---|---:|",
        *(f"| {label} | {count} |" for label, count in counts.items()),
        "",
        "These are counts from this fixed set of saved analyses, not estimates or significance "
        "tests. The runs are dated snapshots, not live results. Candidate counts depend on API "
        "coverage, brief inputs, provider behavior, and capture time. A downgrade is counted only "
        "when a candidate's final rating is lower than its provisional rating. A claim without a "
        "source reference is a non-empty `claim` field with no non-empty `source_reference` in "
        "the validated analysis evidence; this does not assess whether a cited source proves the "
        "claim. No conclusions about general performance, audience overlap, demand, or commercial "
        "outcomes should be inferred.",
        "",
        "Captured Qloo-backed analyses are kept out of Git; rerun "
        "`python -m backend.scripts.report_demo_evaluation` after capturing runs to refresh these "
        "counts.",
        "",
    ]
    EVALUATION_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()

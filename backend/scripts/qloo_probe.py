"""Probe the documented hackathon entity-search and cross-category Insights APIs."""

import argparse
import os
import sys
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

OFFICIAL_BASE_URL = "https://hackathon.api.qloo.com"
SEARCH_TYPE = "urn:entity:brand"
OUTPUT_TYPE = "urn:entity:place"


def report(name: str, passed: bool, status: str, detail: str) -> None:
    outcome = "PASS" if passed else "FAIL"
    print(f"{outcome} {name} status={status} {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--query",
        required=True,
        help="A real brand name to resolve through Qloo Search (not an entity ID).",
    )
    args = parser.parse_args()

    load_dotenv()
    api_key = os.getenv("QLOO_API_KEY", "").strip()
    base_url = os.getenv("QLOO_BASE_URL", OFFICIAL_BASE_URL).rstrip("/")
    parsed_url = urlparse(base_url)
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "hackathon.api.qloo.com"
        or parsed_url.path
        or parsed_url.query
        or parsed_url.fragment
    ):
        report(
            "entity_search", False, "not_run", "QLOO_BASE_URL must be the documented hackathon host"
        )
        report("cross_category_insights", False, "not_run", "invalid QLOO_BASE_URL")
        return 1
    if not api_key:
        report("entity_search", False, "not_run", "QLOO_API_KEY is missing")
        report("cross_category_insights", False, "not_run", "QLOO_API_KEY is missing")
        return 1

    try:
        timeout = float(os.getenv("QLOO_TIMEOUT_SECONDS", "30"))
        if timeout <= 0:
            raise ValueError("timeout must be positive")
    except ValueError:
        report("entity_search", False, "not_run", "QLOO_TIMEOUT_SECONDS must be a positive number")
        report("cross_category_insights", False, "not_run", "invalid timeout configuration")
        return 1

    headers = {"X-Api-Key": api_key}
    entity_id: str | None = None
    search_url = f"{base_url}/search"
    try:
        response = httpx.get(
            search_url,
            headers=headers,
            params={"query": args.query, "types": SEARCH_TYPE},
            timeout=timeout,
        )
    except httpx.TimeoutException:
        report("entity_search", False, "no_response", "request timed out")
        report("cross_category_insights", False, "not_run", "entity search did not return an ID")
        return 1
    except httpx.RequestError as exc:
        report("entity_search", False, "no_response", f"request error ({type(exc).__name__})")
        report("cross_category_insights", False, "not_run", "entity search did not return an ID")
        return 1

    if response.status_code != 200:
        report("entity_search", False, str(response.status_code), "Qloo did not return HTTP 200")
        report("cross_category_insights", False, "not_run", "entity search did not return an ID")
        return 1

    try:
        search_payload = response.json()
    except ValueError:
        report("entity_search", False, str(response.status_code), "response was not JSON")
        report("cross_category_insights", False, "not_run", "entity search did not return an ID")
        return 1

    results = search_payload.get("results") if isinstance(search_payload, dict) else None
    first_result = results[0] if isinstance(results, list) and results else None
    if isinstance(first_result, dict):
        result_id = first_result.get("entity_id")
        if isinstance(result_id, str) and result_id.strip():
            entity_id = result_id

    if entity_id is None:
        report("entity_search", False, str(response.status_code), "no entity_id in Search results")
        report("cross_category_insights", False, "not_run", "entity search did not return an ID")
        return 1

    report("entity_search", True, str(response.status_code), "resolved one brand entity")

    try:
        insights_response = httpx.get(
            f"{base_url}/v2/insights",
            headers=headers,
            params={
                "filter.type": OUTPUT_TYPE,
                "signal.interests.entities": entity_id,
            },
            timeout=timeout,
        )
    except httpx.TimeoutException:
        report("cross_category_insights", False, "no_response", "request timed out")
        return 1
    except httpx.RequestError as exc:
        report(
            "cross_category_insights", False, "no_response", f"request error ({type(exc).__name__})"
        )
        return 1

    if insights_response.status_code != 200:
        report(
            "cross_category_insights",
            False,
            str(insights_response.status_code),
            "Qloo did not return HTTP 200",
        )
        return 1

    try:
        insights_payload = insights_response.json()
    except ValueError:
        report(
            "cross_category_insights",
            False,
            str(insights_response.status_code),
            "response was not JSON",
        )
        return 1

    insight_results = (
        insights_payload.get("results") if isinstance(insights_payload, dict) else None
    )
    entities = insight_results.get("entities") if isinstance(insight_results, dict) else None
    if not isinstance(entities, list) or not entities:
        report(
            "cross_category_insights",
            False,
            str(insights_response.status_code),
            "no cross-category entities returned",
        )
        return 1

    report(
        "cross_category_insights",
        True,
        str(insights_response.status_code),
        "returned place entities",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Probe Groq (primary) and Mistral (fallback) chat-completions APIs."""

import json
import os
import sys
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

TIMEOUT_SECONDS = 30.0
REQUEST_BODY = {
    "messages": [
        {
            "role": "user",
            "content": 'Return exactly this JSON object and no other text: {"probe": true}',
        }
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0,
}


def report(name: str, passed: bool, status: str, detail: str) -> None:
    outcome = "PASS" if passed else "FAIL"
    print(f"{outcome} {name} status={status} {detail}")


def probe_provider(name: str, prefix: str) -> bool:
    base_url = os.getenv(f"{prefix}_BASE_URL", "").strip().rstrip("/")
    api_key = os.getenv(f"{prefix}_API_KEY", "").strip()
    model = os.getenv(f"{prefix}_MODEL", "").strip()
    missing = [
        f"{prefix}_BASE_URL" if not base_url else "",
        f"{prefix}_API_KEY" if not api_key else "",
        f"{prefix}_MODEL" if not model else "",
    ]
    missing = [item for item in missing if item]
    if missing:
        report(name, False, "not_run", f"missing configuration: {', '.join(missing)}")
        return False

    parsed_url = urlparse(base_url)
    if (
        parsed_url.scheme not in {"http", "https"}
        or not parsed_url.hostname
        or parsed_url.username
        or parsed_url.password
        or parsed_url.query
        or parsed_url.fragment
    ):
        report(
            name, False, "not_run", "base URL must be HTTP(S) without embedded credentials or query"
        )
        return False

    body = dict(REQUEST_BODY)
    body["model"] = model
    try:
        response = httpx.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        report(name, False, "no_response", "request timed out")
        return False
    except httpx.RequestError as exc:
        report(name, False, "no_response", f"request error ({type(exc).__name__})")
        return False

    if response.status_code < 200 or response.status_code >= 300:
        report(
            name, False, str(response.status_code), "provider did not return a successful response"
        )
        return False

    try:
        payload = response.json()
    except ValueError:
        report(name, False, str(response.status_code), "response was not JSON")
        return False

    choices = payload.get("choices") if isinstance(payload, dict) else None
    first_choice = choices[0] if isinstance(choices, list) and choices else None
    message = first_choice.get("message") if isinstance(first_choice, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        report(name, False, str(response.status_code), "response did not contain a JSON message")
        return False

    try:
        structured_content = json.loads(content)
    except ValueError:
        report(name, False, str(response.status_code), "message content was not valid JSON")
        return False

    if not isinstance(structured_content, dict) or structured_content.get("probe") is not True:
        report(name, False, str(response.status_code), "JSON did not match the requested object")
        return False

    report(name, True, str(response.status_code), "structured JSON validated")
    return True


def main() -> int:
    load_dotenv()
    primary_ok = probe_provider("primary_llm", "LLM")
    fallback_ok = probe_provider("fallback_llm", "LLM_FALLBACK")
    return 0 if primary_ok and fallback_ok else 1


if __name__ == "__main__":
    sys.exit(main())

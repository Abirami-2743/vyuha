"""Request-local metadata for external calls used by the analysis trace."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(frozen=True)
class ExternalCall:
    operation: str
    duration_ms: float
    status_code: int | None
    result_count: int | None


_external_calls: ContextVar[list[ExternalCall] | None] = ContextVar(
    "vyuha_external_calls",
    default=None,
)


def start_external_call_collection(
) -> tuple[list[ExternalCall], Token[list[ExternalCall] | None]]:
    calls: list[ExternalCall] = []
    return calls, _external_calls.set(calls)


def stop_external_call_collection(token: Token[list[ExternalCall] | None]) -> None:
    _external_calls.reset(token)


def record_external_call(
    operation: str,
    duration_ms: float,
    status_code: int | None,
    result_count: int | None,
) -> None:
    calls = _external_calls.get()
    if calls is not None:
        calls.append(
            ExternalCall(
                operation=operation,
                duration_ms=round(duration_ms, 3),
                status_code=status_code,
                result_count=result_count,
            )
        )

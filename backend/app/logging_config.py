"""JSON logging that suppresses credentials and sensitive field values."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

_SENSITIVE_FIELD = re.compile(r"(?:api.?key|authorization|access.?token|secret|password)", re.I)
_SECRET_TEXT = re.compile(
    r"(?i)\b(bearer|x-api-key|api[_-]?key|access[_-]?token|secret|password)"
    r"(\s*[:=]\s*|\s+)([^\s,;\"']+)"
)


def _redact(value: Any, key: str = "") -> Any:
    if _SENSITIVE_FIELD.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {name: _redact(item, str(name)) for name, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    if isinstance(value, str):
        return _SECRET_TEXT.sub(r"\1\2[REDACTED]", value)
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        fields = {
            key: value
            for key, value in record.__dict__.items()
            if key not in logging.LogRecord("", 0, "", 0, "", (), None).__dict__
            and not key.startswith("_")
        }
        document = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "event": getattr(record, "event", record.getMessage()),
            "fields": _redact(fields),
        }
        return json.dumps(document, default=str, separators=(",", ":"))


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    app_logger = logging.getLogger("vyuha")
    if not any(isinstance(existing.formatter, JsonFormatter) for existing in app_logger.handlers):
        app_logger.addHandler(handler)
    app_logger.setLevel(level)
    app_logger.propagate = False
    logging.getLogger("httpx").setLevel(max(logging.WARNING, app_logger.level))
    logging.getLogger("httpcore").setLevel(max(logging.WARNING, app_logger.level))

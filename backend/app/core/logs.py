"""JSON logging, one line per event. Nothing personal is logged: no client addresses, no request bodies, no headers, no connection strings."""
from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime

FIELDS = ("request_id", "method", "path", "status", "duration_ms", "event")


class JsonFormatter(logging.Formatter):
    """One JSON object per log line."""
    def format(self, record: logging.LogRecord) -> str:
        out = {"ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"), "level": record.levelname,
               "logger": record.name, "msg": record.getMessage()}
        out.update({k: getattr(record, k) for k in FIELDS if hasattr(record, k)})
        if record.exc_info:  # the traceback goes to the log, never to the client
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False)


class StdoutHandler(logging.StreamHandler):
    """Writes to the current sys.stdout (resolved at emit time, so redirection and test capture work)."""

    def __init__(self) -> None:
        super().__init__(sys.stdout)

    @property
    def stream(self):
        return sys.stdout

    @stream.setter
    def stream(self, _value) -> None:
        pass


def setup_logging(level: str = "INFO") -> None:
    """Send the service's logs to stdout as JSON."""
    handler = StdoutHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger("gdziezamieszkac")
    root.handlers[:] = [handler]
    root.setLevel(level)
    root.propagate = False

"""Resident feedback in a local SQLite file. No address, no account, no free text in any public answer.

Every report is stored `unverified`. Nothing here is published and nothing changes a score, until identity checks exist (Gov ID, later).
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('rent_paid', 'data_problem')),
    district TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'rejected')),
    rent_pln INTEGER,
    size_band TEXT,
    month TEXT,
    metric_key TEXT,
    message TEXT
)
"""


class FeedbackStore:
    def __init__(self, path: str):
        self.path = path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._memory = sqlite3.connect(":memory:", check_same_thread=False) if path == ":memory:" else None
        conn = self._connect()
        try:
            with conn:
                conn.execute(SCHEMA)
        finally:
            if self._memory is None:
                conn.close()

    def _connect(self) -> sqlite3.Connection:
        return self._memory or sqlite3.connect(self.path, timeout=5)

    def add(self, kind: str, district: str, **fields: object) -> str:
        """Store one report as `unverified`; returns its random id (it says nothing about who sent it)."""
        rid = uuid.uuid4().hex
        cols = ["id", "created_at", "kind", "district", *fields]
        vals = [rid, datetime.now(UTC).isoformat(timespec="seconds"), kind, district, *fields.values()]
        sql = f"INSERT INTO feedback ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})"  # noqa: S608 (column names are fixed in code)
        conn = self._connect()
        try:
            with conn:
                conn.execute(sql, vals)
        finally:
            if self._memory is None:
                conn.close()
        return rid

    def count(self) -> int:
        conn = self._connect()
        try:
            return conn.execute("SELECT COUNT(*) FROM feedback").fetchone()[0]
        finally:
            if self._memory is None:
                conn.close()

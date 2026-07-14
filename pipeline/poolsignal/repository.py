from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .models import IntelligenceCase


SCHEMA = """
CREATE TABLE IF NOT EXISTS intelligence_case (
  case_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  stage TEXT NOT NULL,
  review_priority INTEGER NOT NULL,
  public_list_match TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


class CaseRepository:
    def __init__(self, path: str | Path):
        self.path = str(path)
        with self.connect() as connection:
            connection.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def save(self, case: IntelligenceCase) -> None:
        payload = json.dumps(case.to_dict(), sort_keys=True)
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO intelligence_case(case_id, source_id, brand, stage, review_priority, public_list_match, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(case_id) DO UPDATE SET
                  stage = excluded.stage,
                  review_priority = excluded.review_priority,
                  public_list_match = excluded.public_list_match,
                  payload_json = excluded.payload_json,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (
                    case.case_id,
                    case.signal.source_id,
                    case.signal.brand,
                    case.stage,
                    case.review_priority,
                    case.public_list_match,
                    payload,
                ),
            )
            for event in case.audit_log:
                connection.execute(
                    "INSERT INTO audit_event(case_id, event_json) VALUES (?, ?)",
                    (case.case_id, json.dumps(event, sort_keys=True)),
                )

    def load(self, case_id: str) -> dict[str, object] | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT payload_json FROM intelligence_case WHERE case_id = ?", (case_id,)
            ).fetchone()
        return json.loads(row[0]) if row else None

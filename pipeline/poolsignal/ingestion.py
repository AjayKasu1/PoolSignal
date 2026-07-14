from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .models import Evidence, ProductSignal


REQUIRED_FIELDS = {
    "source_id",
    "brand",
    "product_name",
    "part_number",
    "product_type",
    "power_profile",
    "load_power",
    "certification_date",
    "source_url",
}


class SourceContractError(ValueError):
    """Raised when a source record violates the documented data contract."""


def canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def checksum(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def parse_signal(payload: dict[str, Any]) -> tuple[ProductSignal, list[Evidence]]:
    missing = sorted(REQUIRED_FIELDS - payload.keys())
    if missing:
        raise SourceContractError(f"missing required fields: {', '.join(missing)}")
    if payload["product_type"] not in {"PTx", "PRx"}:
        raise SourceContractError("product_type must be PTx or PRx")
    if float(payload["load_power"]) < 0:
        raise SourceContractError("load_power must be non-negative")
    datetime.fromisoformat(payload["certification_date"])

    signal = ProductSignal(
        source_id=str(payload["source_id"]),
        brand=str(payload["brand"]).strip(),
        product_name=str(payload["product_name"]).strip(),
        part_number=str(payload["part_number"]).strip(),
        product_type=str(payload["product_type"]),
        power_profile=str(payload["power_profile"]).strip(),
        load_power=float(payload["load_power"]),
        certification_date=str(payload["certification_date"]),
        source_url=str(payload["source_url"]),
        may_be_sold_to_consumers=payload.get("may_be_sold_to_consumers"),
        automotive_inline=payload.get("automotive_inline"),
        subsystem=payload.get("subsystem"),
    )

    observed_at = datetime.now(timezone.utc).isoformat()
    digest = checksum(payload)
    evidence = [
        Evidence(
            evidence_id=f"{signal.source_id}:{field}",
            source_url=signal.source_url,
            source_type="wpc-certified-product",
            observed_at=observed_at,
            field=field,
            value=value if isinstance(value, (str, float, int, bool)) else str(value),
            source_checksum=digest,
        )
        for field, value in payload.items()
        if field not in {"source_url"} and value is not None
    ]
    return signal, evidence


@dataclass
class SnapshotStore:
    root: Path

    def save(self, source_name: str, records: Iterable[dict[str, Any]]) -> Path:
        """Persist an immutable, checksummed JSON snapshot for an authorized source extract."""
        captured = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        target = self.root / source_name / f"{captured}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        document = {"captured_at": captured, "records": list(records)}
        target.write_text(json.dumps(document, indent=2, sort_keys=True), encoding="utf-8")
        return target

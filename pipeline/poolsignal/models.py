from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any


class CaseStage(StrEnum):
    DETECTED = "detected"
    EVIDENCE_GATHERED = "evidence_gathered"
    MATCH_PROPOSED = "match_proposed"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    MONITOR = "monitor"
    RETURNED = "returned"


class FindingStatus(StrEnum):
    COMPLETE = "complete"
    ABSTAINED = "abstained"
    WAITING = "waiting"


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    source_url: str
    source_type: str
    observed_at: str
    field: str
    value: str | float | int | bool
    source_checksum: str


@dataclass(frozen=True)
class ProductSignal:
    source_id: str
    brand: str
    product_name: str
    part_number: str
    product_type: str
    power_profile: str
    load_power: float
    certification_date: str
    source_url: str
    may_be_sold_to_consumers: bool | None = None
    automotive_inline: bool | None = None
    subsystem: bool | None = None


@dataclass(frozen=True)
class EntityCandidate:
    canonical_name: str
    confidence: float
    method: str
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class AgentFinding:
    agent: str
    status: FindingStatus
    confidence: float
    summary: str
    evidence_ids: tuple[str, ...] = ()
    abstention_reason: str | None = None
    features: dict[str, float] = field(default_factory=dict)


@dataclass
class IntelligenceCase:
    case_id: str
    signal: ProductSignal
    stage: CaseStage = CaseStage.DETECTED
    evidence: list[Evidence] = field(default_factory=list)
    findings: list[AgentFinding] = field(default_factory=list)
    entity_candidates: list[EntityCandidate] = field(default_factory=list)
    public_list_match: str = "unknown"
    review_priority: int = 0
    analyst_brief: str = ""
    policy_notes: list[str] = field(default_factory=list)
    audit_log: list[dict[str, Any]] = field(default_factory=list)

    def record(self, event: str, **payload: Any) -> None:
        self.audit_log.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "event": event,
                **payload,
            }
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

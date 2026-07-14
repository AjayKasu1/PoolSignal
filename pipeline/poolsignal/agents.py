from __future__ import annotations

from datetime import date
from difflib import SequenceMatcher
from typing import Protocol

from .models import (
    AgentFinding,
    EntityCandidate,
    FindingStatus,
    IntelligenceCase,
)
from .policy import validate_language


class Agent(Protocol):
    name: str

    def run(self, case: IntelligenceCase) -> AgentFinding: ...


def normalize_entity(value: str) -> str:
    normalized = value.casefold().replace("&", " and ")
    for suffix in (" corporation", " incorporated", " limited", " ltd", " llc", " gmbh", " inc", " co"):
        normalized = normalized.removesuffix(suffix)
    return " ".join("".join(char if char.isalnum() else " " for char in normalized).split())


class ScoutAgent:
    name = "scout"

    def run(self, case: IntelligenceCase) -> AgentFinding:
        evidence = tuple(item.evidence_id for item in case.evidence if item.field in {"certification_date", "power_profile", "product_type"})
        summary = f"Detected {case.signal.product_type} certification {case.signal.source_id} with {case.signal.load_power:g}W load power."
        validate_language(summary)
        return AgentFinding(self.name, FindingStatus.COMPLETE, 0.99, summary, evidence)


class EntityResolverAgent:
    name = "resolver"

    def __init__(self, legal_entities: list[str], aliases: dict[str, str] | None = None):
        self.legal_entities = legal_entities
        self.aliases = aliases or {}

    def run(self, case: IntelligenceCase) -> AgentFinding:
        brand = normalize_entity(case.signal.brand)
        candidates: list[EntityCandidate] = []
        if brand in self.aliases:
            candidates.append(EntityCandidate(self.aliases[brand], 0.98, "approved_alias", (f"{case.signal.source_id}:brand",)))
        for entity in self.legal_entities:
            score = SequenceMatcher(None, brand, normalize_entity(entity)).ratio()
            if score >= 0.45:
                candidates.append(EntityCandidate(entity, round(score, 4), "normalized_name", (f"{case.signal.source_id}:brand",)))
        candidates.sort(key=lambda candidate: candidate.confidence, reverse=True)
        case.entity_candidates = candidates[:3]
        best = candidates[0] if candidates else None
        if best is None or best.confidence < 0.85:
            reason = "No legal-entity candidate cleared the 0.85 approval threshold."
            return AgentFinding(self.name, FindingStatus.ABSTAINED, best.confidence if best else 0.0, "Entity resolution requires human research.", (f"{case.signal.source_id}:brand",), reason)
        return AgentFinding(self.name, FindingStatus.COMPLETE, best.confidence, f"Proposed entity link to {best.canonical_name}.", best.evidence_ids)


class CoverageAgent:
    name = "coverage"

    def __init__(self, public_licensees: list[str]):
        self.public_licensees = public_licensees

    def run(self, case: IntelligenceCase) -> AgentFinding:
        if not case.entity_candidates:
            case.public_list_match = "unknown"
            return AgentFinding(self.name, FindingStatus.ABSTAINED, 0.0, "Public-list comparison deferred until identity is resolved.", abstention_reason="No entity candidate available.")
        entity = normalize_entity(case.entity_candidates[0].canonical_name)
        scores = [(SequenceMatcher(None, entity, normalize_entity(name)).ratio(), name) for name in self.public_licensees]
        best_score, best_name = max(scores, default=(0.0, ""))
        if best_score >= 0.92:
            case.public_list_match = "public-list"
            summary = f"Found a high-confidence entity-name match to public snapshot record {best_name}."
        elif best_score >= 0.72:
            case.public_list_match = "possible"
            summary = "Found a possible public-snapshot entity match; affiliate confirmation is required."
        else:
            case.public_list_match = "none"
            summary = "No approved entity-name match was found in the dated public snapshot; no coverage conclusion was made."
        validate_language(summary)
        return AgentFinding(self.name, FindingStatus.COMPLETE, round(max(best_score, 0.9 if case.public_list_match == "none" else best_score), 4), summary)


class PriorityAgent:
    name = "prioritizer"

    def run(self, case: IntelligenceCase) -> AgentFinding:
        certification_year = date.fromisoformat(case.signal.certification_date).year
        features = {
            "recent_activity": 20.0 if certification_year >= 2026 else 4.0,
            "transmitter_relevance": 20.0 if case.signal.product_type == "PTx" else 8.0,
            "high_power_profile": 20.0 if case.signal.load_power > 5 else 4.0,
            "consumer_signal": 10.0 if case.signal.may_be_sold_to_consumers is not False else 2.0,
            "automotive_signal": 10.0 if case.signal.automotive_inline else 0.0,
            "identity_uncertainty": 15.0 if not case.entity_candidates or case.entity_candidates[0].confidence < 0.85 else 3.0,
            "data_completeness": 5.0,
        }
        case.review_priority = min(100, round(sum(features.values())))
        summary = f"Assigned transparent review priority {case.review_priority}/100."
        return AgentFinding(self.name, FindingStatus.COMPLETE, 0.94, summary, features=features)


class DataQualityAgent:
    name = "data_quality"

    def run(self, case: IntelligenceCase) -> AgentFinding:
        issues = []
        if case.signal.load_power > 100:
            issues.append("load_power_outlier")
        if not case.signal.source_url.startswith("https://"):
            issues.append("non_https_source")
        if not case.signal.brand.strip():
            issues.append("missing_brand")
        if issues:
            return AgentFinding(self.name, FindingStatus.WAITING, 0.9, f"Quarantined record for: {', '.join(issues)}.")
        return AgentFinding(self.name, FindingStatus.COMPLETE, 0.99, "Source contract and record-level quality checks passed.")


class BriefingAgent:
    name = "briefing"

    def run(self, case: IntelligenceCase) -> AgentFinding:
        entity_confidence = case.entity_candidates[0].confidence if case.entity_candidates else 0.0
        brief = (
            f"{case.signal.brand} has a monitored {case.signal.product_type} certification "
            f"({case.signal.source_id}) with {case.signal.load_power:g}W load power. "
            f"Entity resolution confidence is {entity_confidence:.0%}. "
            f"The dated public-list comparison state is {case.public_list_match}. "
            "These are research signals, not conclusions about product coverage or licensing status."
        )
        validate_language(brief)
        case.analyst_brief = brief
        evidence_ids = tuple(item.evidence_id for item in case.evidence)
        return AgentFinding(self.name, FindingStatus.COMPLETE, 0.96, brief, evidence_ids)

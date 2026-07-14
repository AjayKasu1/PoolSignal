from __future__ import annotations

from dataclasses import dataclass

from .models import CaseStage, IntelligenceCase


FORBIDDEN_ASSERTIONS = (
    " is unlicensed",
    " is infringing",
    " is noncompliant",
    " owes royalties",
)


class PolicyViolation(ValueError):
    pass


def validate_language(text: str) -> None:
    normalized = f" {text.lower()}"
    violations = [phrase.strip() for phrase in FORBIDDEN_ASSERTIONS if phrase in normalized]
    if violations:
        raise PolicyViolation(f"unsupported legal or coverage assertion: {', '.join(violations)}")


@dataclass(frozen=True)
class PolicyDecision:
    stage: CaseStage
    requires_human: bool
    reason: str
    permitted_actions: tuple[str, ...]


class PolicyGate:
    entity_auto_approval_threshold = 0.85

    def evaluate(self, case: IntelligenceCase) -> PolicyDecision:
        best_match = max((candidate.confidence for candidate in case.entity_candidates), default=0.0)
        if best_match < self.entity_auto_approval_threshold:
            return PolicyDecision(
                stage=CaseStage.REVIEW_REQUIRED,
                requires_human=True,
                reason="Entity confidence is below the approval threshold.",
                permitted_actions=("research", "monitor", "return_for_research"),
            )
        if case.public_list_match in {"none", "possible", "unknown"}:
            return PolicyDecision(
                stage=CaseStage.REVIEW_REQUIRED,
                requires_human=True,
                reason="Public-list comparison is not a product-coverage conclusion.",
                permitted_actions=("research", "approve_entity_link", "monitor"),
            )
        return PolicyDecision(
            stage=CaseStage.MONITOR,
            requires_human=False,
            reason="High-confidence entity and public-list matches support monitoring.",
            permitted_actions=("monitor",),
        )

    def transition(self, case: IntelligenceCase, action: str, actor: str) -> None:
        allowed = {
            "approve_entity_link": CaseStage.APPROVED,
            "monitor": CaseStage.MONITOR,
            "return_for_research": CaseStage.RETURNED,
        }
        if action not in allowed:
            raise PolicyViolation(f"unsupported human action: {action}")
        case.stage = allowed[action]
        case.record("human_decision", action=action, actor=actor)

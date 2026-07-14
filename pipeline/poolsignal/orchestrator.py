from __future__ import annotations

from dataclasses import dataclass

from .agents import (
    BriefingAgent,
    CoverageAgent,
    DataQualityAgent,
    EntityResolverAgent,
    PriorityAgent,
    ScoutAgent,
)
from .ingestion import parse_signal
from .models import CaseStage, IntelligenceCase
from .policy import PolicyGate


@dataclass
class IntelligenceOrchestrator:
    legal_entities: list[str]
    public_licensees: list[str]
    aliases: dict[str, str] | None = None

    def run(self, payload: dict[str, object]) -> IntelligenceCase:
        signal, evidence = parse_signal(payload)
        case = IntelligenceCase(case_id=f"case-{signal.source_id.lower()}", signal=signal, evidence=evidence)
        case.record("case_detected", source_id=signal.source_id)

        agents = [
            DataQualityAgent(),
            ScoutAgent(),
            EntityResolverAgent(self.legal_entities, self.aliases),
            CoverageAgent(self.public_licensees),
            PriorityAgent(),
            BriefingAgent(),
        ]
        for agent in agents:
            finding = agent.run(case)
            case.findings.append(finding)
            case.record(
                "agent_completed",
                agent=finding.agent,
                status=finding.status,
                confidence=finding.confidence,
            )
        case.stage = CaseStage.EVIDENCE_GATHERED
        decision = PolicyGate().evaluate(case)
        case.stage = decision.stage
        case.policy_notes.append(decision.reason)
        case.record(
            "policy_evaluated",
            requires_human=decision.requires_human,
            reason=decision.reason,
            permitted_actions=decision.permitted_actions,
        )
        return case

import tempfile
import unittest
from pathlib import Path

from poolsignal.models import CaseStage
from poolsignal.orchestrator import IntelligenceOrchestrator
from poolsignal.policy import PolicyViolation, validate_language
from poolsignal.repository import CaseRepository


BASE_SIGNAL = {
    "source_id": "QI-27167",
    "brand": "HX",
    "product_name": "Magnetic wireless charger",
    "part_number": "X208",
    "product_type": "PTx",
    "power_profile": "MPP25",
    "load_power": 25,
    "certification_date": "2026-06-19",
    "may_be_sold_to_consumers": True,
    "source_url": "https://jpsapi.wirelesspowerconsortium.com/products/qi/27167",
}


class OrchestratorTests(unittest.TestCase):
    def orchestrator(self):
        return IntelligenceOrchestrator(
            legal_entities=["ConvenientPower HK Limited", "Sony Group Corporation"],
            public_licensees=["ConvenientPower HK Limited", "Sony Group Corporation"],
        )

    def test_ambiguous_entity_forces_human_review(self):
        case = self.orchestrator().run(BASE_SIGNAL)
        self.assertEqual(case.stage, CaseStage.REVIEW_REQUIRED)
        self.assertTrue(any("threshold" in note for note in case.policy_notes))

    def test_priority_is_transparent_and_bounded(self):
        case = self.orchestrator().run(BASE_SIGNAL)
        finding = next(item for item in case.findings if item.agent == "prioritizer")
        self.assertEqual(case.review_priority, round(sum(finding.features.values())))
        self.assertLessEqual(case.review_priority, 100)

    def test_forbidden_assertions_are_rejected(self):
        with self.assertRaises(PolicyViolation):
            validate_language("Example Company is unlicensed.")

    def test_repository_round_trip(self):
        case = self.orchestrator().run(BASE_SIGNAL)
        with tempfile.TemporaryDirectory() as directory:
            repository = CaseRepository(Path(directory) / "test.db")
            repository.save(case)
            loaded = repository.load(case.case_id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["review_priority"], case.review_priority)


if __name__ == "__main__":
    unittest.main()

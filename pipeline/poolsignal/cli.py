from __future__ import annotations

import argparse
import json
from pathlib import Path

from .orchestrator import IntelligenceOrchestrator
from .repository import CaseRepository


DEFAULT_ENTITIES = [
    "ConvenientPower HK Limited",
    "Sony Group Corporation",
    "Tesla, Inc.",
    "Luxshare Precision Industry Co., Ltd.",
    "GEYOTO Technology Co., Ltd.",
]

DEFAULT_PUBLIC_LICENSEES = [
    "ConvenientPower HK Limited",
    "Sony Group Corporation",
    "LG Electronics Inc.",
    "Robert Bosch GmbH",
    "Apple Inc.",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an evidence-first PoolSignal case")
    parser.add_argument("input", type=Path, help="JSON product signal")
    parser.add_argument("--database", type=Path, default=Path("poolsignal.db"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    orchestrator = IntelligenceOrchestrator(
        legal_entities=DEFAULT_ENTITIES,
        public_licensees=DEFAULT_PUBLIC_LICENSEES,
        aliases={"tesla": "Tesla, Inc.", "convenientpower": "ConvenientPower HK Limited"},
    )
    case = orchestrator.run(payload)
    CaseRepository(args.database).save(case)
    result = json.dumps(case.to_dict(), indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(result, encoding="utf-8")
    else:
        print(result)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Normalize existing accidents.road_name values."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.backfill.road_names import normalize_existing_road_names


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Persist changes to the database")
    parser.add_argument("--sample-limit", type=int, default=20, help="Number of sample changes to print")
    args = parser.parse_args()

    result = normalize_existing_road_names(
        apply=args.apply,
        sample_limit=args.sample_limit,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

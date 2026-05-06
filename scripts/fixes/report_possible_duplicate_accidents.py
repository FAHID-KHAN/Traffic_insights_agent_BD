#!/usr/bin/env python3
"""Report possible duplicate accident rows from the existing SQLite database."""
from __future__ import annotations

from datetime import datetime

from app.database import get_db
from app.dedupe.similarity import score_accident_similarity


def main() -> None:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, article_id, accident_type, location_raw, district, division,
                      deaths, injuries, vehicles_involved, road_name, accident_date, summary
               FROM accidents
               WHERE accident_date IS NOT NULL
               ORDER BY accident_date ASC, id ASC"""
        ).fetchall()

    accidents = [dict(row) for row in rows]
    for index, accident in enumerate(accidents):
        accident_date = _parse_date(accident.get("accident_date"))
        if accident_date is None:
            continue
        for candidate in accidents[:index]:
            candidate_date = _parse_date(candidate.get("accident_date"))
            if candidate_date is None:
                continue
            days_apart = (accident_date - candidate_date).days
            if days_apart < 0 or days_apart > 3:
                continue
            result = score_accident_similarity(accident, candidate)
            if result.score >= 50:
                print(
                    f"score={result.score} accident_id={accident['id']} "
                    f"candidate_id={candidate['id']} signals={','.join(result.matched_signals)}"
                )


def _parse_date(value):
    if value is None:
        return None
    if hasattr(value, "year"):
        return value
    return datetime.strptime(str(value), "%Y-%m-%d").date()


if __name__ == "__main__":
    main()

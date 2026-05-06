"""Event-level accident duplicate handling."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.database import get_db, insert_accident
from app.dedupe.logging import write_ambiguity_log, write_update_log
from app.dedupe.similarity import has_update_wording, score_accident_similarity
from app.geo import DISTRICT_COORDINATES, district_to_division
from app.llm.llm_schema import AccidentEvent
from app.normalize import normalize_district
from app.normalize_roads import normalize_road_name

HIGH_CONFIDENCE_THRESHOLD = 75
AMBIGUOUS_THRESHOLD = 50
CANDIDATE_LOOKBACK_DAYS = 3
NON_DISTRICT_LOCATIONS = {
    "Tongi", "Savar", "Keraniganj", "Uttara", "Mirpur", "Mohammadpur",
    "Dhanmondi", "Gulshan", "Motijheel", "Jatrabari", "Demra", "Tejgaon",
    "Turag", "Gabtali", "Ashulia",
}
ALLOWED_DISTRICTS = set(DISTRICT_COORDINATES) - NON_DISTRICT_LOCATIONS


def upsert_accident_event(
    article_id: int,
    event: AccidentEvent,
    published_date: date | None,
    title: str | None = None,
    url: str | None = None,
) -> int:
    """Insert a new accident or update a high-confidence duplicate event."""
    new_event = _normalize_event(article_id, event, published_date)
    best = _find_best_candidate(new_event, title=title)

    if best and best["score"] >= HIGH_CONFIDENCE_THRESHOLD:
        return _update_existing_accident(best, new_event, article_id, title, url)

    accident_id = insert_accident(**new_event)

    if best and best["score"] >= AMBIGUOUS_THRESHOLD:
        write_ambiguity_log(
            {
                "reason": "ambiguous_possible_duplicate",
                "score": best["score"],
                "new_article_id": article_id,
                "inserted_accident_id": accident_id,
                "best_candidate_id": best["candidate"]["id"],
                "matched_signals": best["matched_signals"],
                "event_snapshot": _event_snapshot(new_event, title, url),
            }
        )

    return accident_id


def find_candidate_scores(
    event: AccidentEvent,
    published_date: date | None,
    title: str | None = None,
) -> list[dict[str, Any]]:
    """Return candidate scores for reporting without mutating the database."""
    new_event = _normalize_event(article_id=0, event=event, published_date=published_date)
    candidates = _candidate_accidents(new_event.get("accident_date"))
    scored = []
    for candidate in candidates:
        result = score_accident_similarity(new_event, candidate, title=title)
        scored.append(
            {
                "score": result.score,
                "matched_signals": result.matched_signals,
                "candidate": candidate,
            }
        )
    return sorted(scored, key=lambda item: item["score"], reverse=True)


def _normalize_event(article_id: int, event: AccidentEvent, published_date: date | None) -> dict[str, Any]:
    district = normalize_district(event.district)
    if district and district not in ALLOWED_DISTRICTS:
        district = None
    division = (event.division.strip() if event.division else None) or (
        district_to_division(district) if district else None
    )
    latitude, longitude = DISTRICT_COORDINATES.get(district, (None, None)) if district else (None, None)
    vehicles = ", ".join(event.vehicles_involved) if event.vehicles_involved else None

    return {
        "article_id": article_id,
        "accident_type": event.accident_type,
        "location_raw": event.location_raw,
        "district": district,
        "division": division,
        "latitude": latitude,
        "longitude": longitude,
        "deaths": event.deaths,
        "injuries": event.injuries,
        "vehicles_involved": vehicles,
        "road_name": normalize_road_name(event.road_name),
        "accident_date": published_date,
        "summary": event.summary,
    }


def _find_best_candidate(new_event: dict[str, Any], title: str | None) -> dict[str, Any] | None:
    candidates = _candidate_accidents(new_event.get("accident_date"))
    best: dict[str, Any] | None = None

    for candidate in candidates:
        result = score_accident_similarity(new_event, candidate, title=title)
        scored = {
            "score": result.score,
            "matched_signals": result.matched_signals,
            "candidate": candidate,
        }
        if best is None or scored["score"] > best["score"]:
            best = scored

    return best


def _candidate_accidents(accident_date: date | None) -> list[dict[str, Any]]:
    if accident_date is None:
        return []
    start_date = accident_date - timedelta(days=CANDIDATE_LOOKBACK_DAYS)
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, article_id, accident_type, location_raw, district, division,
                      latitude, longitude, deaths, injuries, vehicles_involved,
                      road_name, accident_date, summary
               FROM accidents
               WHERE accident_date BETWEEN ? AND ?
               ORDER BY accident_date DESC, id DESC""",
            (start_date, accident_date),
        ).fetchall()
        return [dict(row) for row in rows]


def _update_existing_accident(
    best: dict[str, Any],
    new_event: dict[str, Any],
    article_id: int,
    title: str | None,
    url: str | None,
) -> int:
    candidate = best["candidate"]
    existing_id = candidate["id"]
    before = {
        "deaths": int(candidate.get("deaths") or 0),
        "injuries": int(candidate.get("injuries") or 0),
    }
    after = {
        "deaths": max(before["deaths"], int(new_event.get("deaths") or 0)),
        "injuries": max(before["injuries"], int(new_event.get("injuries") or 0)),
    }
    summary = _choose_summary(candidate, new_event, after, title)

    with get_db() as conn:
        conn.execute(
            """UPDATE accidents
               SET deaths = ?, injuries = ?, summary = ?
               WHERE id = ?""",
            (after["deaths"], after["injuries"], summary, existing_id),
        )

    write_update_log(
        {
            "reason": "high_confidence_duplicate_update",
            "score": best["score"],
            "existing_accident_id": existing_id,
            "new_article_id": article_id,
            "kept_accident_date": candidate.get("accident_date"),
            "before": before,
            "after": after,
            "matched_signals": best["matched_signals"],
            "event_snapshot": _event_snapshot(new_event, title, url),
        }
    )
    return existing_id


def _choose_summary(
    candidate: dict[str, Any],
    new_event: dict[str, Any],
    after: dict[str, int],
    title: str | None,
) -> str | None:
    new_summary = new_event.get("summary")
    old_summary = candidate.get("summary")
    if not new_summary:
        return old_summary
    new_has_higher_casualties = after != {
        "deaths": int(candidate.get("deaths") or 0),
        "injuries": int(candidate.get("injuries") or 0),
    }
    if new_has_higher_casualties or has_update_wording(title, new_summary):
        return new_summary
    return old_summary


def _event_snapshot(new_event: dict[str, Any], title: str | None, url: str | None) -> dict[str, Any]:
    return {
        "title": title,
        "url": url,
        "accident_type": new_event.get("accident_type"),
        "location_raw": new_event.get("location_raw"),
        "district": new_event.get("district"),
        "division": new_event.get("division"),
        "deaths": new_event.get("deaths"),
        "injuries": new_event.get("injuries"),
        "vehicles_involved": new_event.get("vehicles_involved"),
        "road_name": new_event.get("road_name"),
        "accident_date": new_event.get("accident_date"),
        "summary": new_event.get("summary"),
    }

"""Event-level accident duplicate handling."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from app.database import get_db, insert_accident
from app.dedupe.logging import write_ambiguity_log, write_decision_log, write_update_log
from app.dedupe.similarity import has_update_wording, score_accident_similarity
from app.geo import DISTRICT_COORDINATES, district_to_division
from app.llm.llm_schema import AccidentEvent
from app.normalize import normalize_district
from app.normalize_roads import normalize_road_name
from app.time_utils import normalize_time_metadata, part_of_day_for_time

HIGH_CONFIDENCE_THRESHOLD = 75
AMBIGUOUS_THRESHOLD = 50
CANDIDATE_WINDOW_DAYS = 3
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
            _dedupe_payload(
                decision="inserted_ambiguous_possible_duplicate",
                score=best["score"],
                matched_signals=best["matched_signals"],
                current_article=_current_article_snapshot(article_id, new_event, title, url),
                current_event=_event_snapshot(new_event),
                existing_candidate=_candidate_snapshot(best["candidate"]),
                insert_result={"accident_id": accident_id},
            )
        )
    elif best:
        write_decision_log(
            _dedupe_payload(
                decision="inserted_low_confidence",
                score=best["score"],
                matched_signals=best["matched_signals"],
                current_article=_current_article_snapshot(article_id, new_event, title, url),
                current_event=_event_snapshot(new_event),
                existing_candidate=_candidate_snapshot(best["candidate"]),
                insert_result={"accident_id": accident_id},
            )
        )
    else:
        decision = "inserted_no_same_district_candidate"
        if not new_event.get("district"):
            decision = "inserted_dedupe_skipped_missing_district"
        write_decision_log(
            _dedupe_payload(
                decision=decision,
                score=None,
                matched_signals=[],
                current_article=_current_article_snapshot(article_id, new_event, title, url),
                current_event=_event_snapshot(new_event),
                existing_candidate=None,
                insert_result={"accident_id": accident_id},
            )
        )

    return accident_id


def find_candidate_scores(
    event: AccidentEvent,
    published_date: date | None,
    title: str | None = None,
) -> list[dict[str, Any]]:
    """Return candidate scores for reporting without mutating the database."""
    new_event = _normalize_event(article_id=0, event=event, published_date=published_date)
    candidates = _candidate_accidents(new_event.get("accident_date"), new_event.get("district"))
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
    accident_time, part_of_day = normalize_time_metadata(event.accident_time, event.part_of_day)

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
        "accident_time": accident_time,
        "part_of_day": part_of_day,
        "summary": event.summary,
    }


def _find_best_candidate(new_event: dict[str, Any], title: str | None) -> dict[str, Any] | None:
    candidates = _candidate_accidents(new_event.get("accident_date"), new_event.get("district"))
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


def _candidate_accidents(accident_date: date | None, district: str | None) -> list[dict[str, Any]]:
    if accident_date is None or not district:
        return []
    start_date = accident_date - timedelta(days=CANDIDATE_WINDOW_DAYS)
    end_date = accident_date + timedelta(days=CANDIDATE_WINDOW_DAYS)
    with get_db() as conn:
        rows = conn.execute(
            """SELECT a.id, a.article_id, a.accident_type, a.location_raw,
                      a.district, a.division, a.latitude, a.longitude,
                      a.deaths, a.injuries, a.vehicles_involved,
                      a.road_name, a.accident_date, a.accident_time,
                      a.part_of_day, a.summary,
                      ar.title AS article_title, ar.url AS article_url,
                      ar.published_date AS article_published_date
               FROM accidents a
               JOIN articles ar ON ar.id = a.article_id
               WHERE a.district = ?
                 AND a.accident_date BETWEEN ? AND ?
               ORDER BY a.accident_date DESC, a.id DESC""",
            (district, start_date, end_date),
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
    existing_date = _coerce_date(candidate.get("accident_date"))
    new_date = _coerce_date(new_event.get("accident_date"))
    final_date = _earliest_date(existing_date, new_date)
    before = {
        "deaths": int(candidate.get("deaths") or 0),
        "injuries": int(candidate.get("injuries") or 0),
        "accident_date": candidate.get("accident_date"),
        "accident_time": candidate.get("accident_time"),
        "part_of_day": candidate.get("part_of_day"),
        "summary": candidate.get("summary"),
    }
    accident_time, part_of_day = _merge_time_metadata(candidate, new_event)
    after = {
        "deaths": max(before["deaths"], int(new_event.get("deaths") or 0)),
        "injuries": max(before["injuries"], int(new_event.get("injuries") or 0)),
        "accident_date": final_date,
        "accident_time": accident_time,
        "part_of_day": part_of_day,
    }
    summary = _choose_summary(candidate, new_event, after, title)
    after["summary"] = summary

    with get_db() as conn:
        conn.execute(
            """UPDATE accidents
               SET deaths = ?, injuries = ?, accident_date = ?,
                   accident_time = ?, part_of_day = ?, summary = ?
               WHERE id = ?""",
            (
                after["deaths"],
                after["injuries"],
                final_date,
                accident_time,
                part_of_day,
                summary,
                existing_id,
            ),
        )

    write_update_log(
        _dedupe_payload(
            decision="updated_existing",
            score=best["score"],
            matched_signals=best["matched_signals"],
            current_article=_current_article_snapshot(article_id, new_event, title, url),
            current_event=_event_snapshot(new_event),
            existing_candidate=_candidate_snapshot(candidate),
            merge_result={
                "accident_id": existing_id,
                "before": before,
                "after": after,
                "summary_changed": summary != before["summary"],
            },
        )
    )
    return existing_id


def _choose_summary(
    candidate: dict[str, Any],
    new_event: dict[str, Any],
    after: dict[str, Any],
    title: str | None,
) -> str | None:
    new_summary = new_event.get("summary")
    old_summary = candidate.get("summary")
    if not new_summary:
        return old_summary
    new_casualties = {
        "deaths": int(new_event.get("deaths") or 0),
        "injuries": int(new_event.get("injuries") or 0),
    }
    old_casualties = {
        "deaths": int(candidate.get("deaths") or 0),
        "injuries": int(candidate.get("injuries") or 0),
    }
    new_has_higher_casualties = (
        new_casualties["deaths"] > old_casualties["deaths"]
        or new_casualties["injuries"] > old_casualties["injuries"]
    )
    new_has_same_casualties = new_casualties == old_casualties
    if new_has_higher_casualties or (new_has_same_casualties and has_update_wording(title, new_summary)):
        return new_summary
    return old_summary


def _merge_time_metadata(candidate: dict[str, Any], new_event: dict[str, Any]) -> tuple[str | None, str | None]:
    existing_time = candidate.get("accident_time")
    existing_part = candidate.get("part_of_day")
    new_time = new_event.get("accident_time")
    new_part = new_event.get("part_of_day")

    if existing_time:
        return existing_time, existing_part or part_of_day_for_time(existing_time) or new_part
    if new_time:
        return new_time, part_of_day_for_time(new_time) or new_part
    return None, existing_part or new_part


def _coerce_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _earliest_date(*values: date | None) -> date | None:
    dates = [value for value in values if value is not None]
    return min(dates) if dates else None


def _casualties_snapshot(event: dict[str, Any]) -> dict[str, int]:
    return {
        "deaths": int(event.get("deaths") or 0),
        "injuries": int(event.get("injuries") or 0),
    }


def _current_article_snapshot(
    article_id: int,
    new_event: dict[str, Any],
    title: str | None,
    url: str | None,
) -> dict[str, Any]:
    return {
        "article_id": article_id,
        "published_date": new_event.get("accident_date"),
        "title": title,
        "url": url,
    }


def _event_snapshot(new_event: dict[str, Any]) -> dict[str, Any]:
    return {
        "accident_type": new_event.get("accident_type"),
        "location_raw": new_event.get("location_raw"),
        "district": new_event.get("district"),
        "division": new_event.get("division"),
        "casualties": _casualties_snapshot(new_event),
        "vehicles_involved": new_event.get("vehicles_involved"),
        "road_name": new_event.get("road_name"),
        "accident_date": new_event.get("accident_date"),
        "accident_time": new_event.get("accident_time"),
        "part_of_day": new_event.get("part_of_day"),
        "summary": new_event.get("summary"),
    }


def _candidate_snapshot(candidate: dict[str, Any] | None) -> dict[str, Any] | None:
    if not candidate:
        return None
    return {
        "accident_id": candidate.get("id"),
        "article": {
            "article_id": candidate.get("article_id"),
            "published_date": candidate.get("article_published_date"),
            "title": candidate.get("article_title"),
            "url": candidate.get("article_url"),
        },
        "accident_type": candidate.get("accident_type"),
        "location_raw": candidate.get("location_raw"),
        "district": candidate.get("district"),
        "division": candidate.get("division"),
        "casualties": _casualties_snapshot(candidate),
        "vehicles_involved": candidate.get("vehicles_involved"),
        "road_name": candidate.get("road_name"),
        "accident_date": candidate.get("accident_date"),
        "accident_time": candidate.get("accident_time"),
        "part_of_day": candidate.get("part_of_day"),
        "summary": candidate.get("summary"),
    }


def _dedupe_payload(
    decision: str,
    score: int | None,
    matched_signals: list[str],
    current_article: dict[str, Any],
    current_event: dict[str, Any],
    existing_candidate: dict[str, Any] | None,
    merge_result: dict[str, Any] | None = None,
    insert_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "decision": decision,
        "score": score,
        "matched_signals": matched_signals,
        "current_article": current_article,
        "current_event": current_event,
        "existing_candidate": existing_candidate,
    }
    if merge_result is not None:
        payload["merge_result"] = merge_result
    if insert_result is not None:
        payload["insert_result"] = insert_result
    return payload

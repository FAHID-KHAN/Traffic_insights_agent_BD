import json
from datetime import date

from app import database as db
from app.dedupe import accident_dedupe
from app.dedupe.accident_dedupe import upsert_accident_event
from app.llm.llm_schema import AccidentEvent


def _article(url: str, title: str, published_date: date) -> int:
    return db.insert_article(url, title, "body", published_date)


def _accidents():
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, article_id, deaths, injuries, accident_date, summary,
                      district, road_name, vehicles_involved
               FROM accidents
               ORDER BY id ASC"""
        ).fetchall()
        return [dict(row) for row in rows]


def test_sylhet_followup_updates_existing_accident(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    first_article = _article("https://example.com/sylhet-1", "8 killed in Sylhet road crash", date(2026, 5, 3))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            division="Sylhet",
            deaths=8,
            injuries=7,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet-Tamabil Highway",
            summary="A bus and microbus collided in Jaintapur, killing 8 and injuring 7.",
        ),
        date(2026, 5, 3),
        title="8 killed in Sylhet road crash",
        url="https://example.com/sylhet-1",
    )

    followup_article = _article("https://example.com/sylhet-2", "Sylhet crash death toll rises to 9", date(2026, 5, 4))
    second_id = upsert_accident_event(
        followup_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            division="Sylhet",
            deaths=9,
            injuries=12,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet Tamabil Highway",
            summary="Death toll rises to 9 after the Jaintapur collision; 12 were injured.",
        ),
        date(2026, 5, 4),
        title="Sylhet crash death toll rises to 9",
        url="https://example.com/sylhet-2",
    )

    rows = _accidents()
    assert first_id == second_id
    assert len(rows) == 1
    assert rows[0]["deaths"] == 9
    assert rows[0]["injuries"] == 12
    assert rows[0]["accident_date"] == "2026-05-03"
    assert rows[0]["summary"].startswith("Death toll rises to 9")

    records = [json.loads(line) for line in update_log.read_text().splitlines()]
    assert records[0]["score"] >= 75
    assert records[0]["existing_accident_id"] == first_id
    assert records[0]["new_article_id"] == followup_article
    assert records[0]["kept_accident_date"] == "2026-05-03"


def test_mymensingh_ambiguous_case_inserts_and_logs(tmp_path, monkeypatch):
    ambiguity_log = tmp_path / "accident_dedupe_ambiguity.log"
    monkeypatch.setattr(accident_dedupe, "write_ambiguity_log", lambda payload: _write_log(ambiguity_log, payload))

    first_article = _article("https://example.com/mymensingh-1", "Crash in Trishal kills two", date(2026, 5, 3))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Trishal upazila of Mymensingh",
            district="Mymensingh",
            deaths=2,
            injuries=1,
            vehicles_involved=["bus"],
            summary="A bus collision in Trishal killed two.",
        ),
        date(2026, 5, 3),
    )

    second_article = _article("https://example.com/mymensingh-2", "Another Trishal road crash reported", date(2026, 5, 4))
    second_id = upsert_accident_event(
        second_article,
        AccidentEvent(
            accident_type="road crash",
            location_raw="Trishal area in Mymensingh",
            district="Mymensingh",
            deaths=2,
            injuries=1,
            vehicles_involved=["truck"],
            summary="A road crash in Trishal killed two people.",
        ),
        date(2026, 5, 4),
    )

    assert first_id != second_id
    assert len(_accidents()) == 2
    records = [json.loads(line) for line in ambiguity_log.read_text().splitlines()]
    assert len(records) == 1
    assert 50 <= records[0]["score"] < 75
    assert records[0]["inserted_accident_id"] == second_id
    assert records[0]["best_candidate_id"] == first_id


def test_same_district_same_day_different_accidents_remain_separate():
    article_id = _article("https://example.com/dhaka", "Two Dhaka crashes", date(2026, 5, 5))
    first_id = upsert_accident_event(
        article_id,
        AccidentEvent(
            accident_type="bus collision",
            location_raw="Mirpur 10 intersection",
            district="Dhaka",
            deaths=1,
            injuries=0,
            vehicles_involved=["bus"],
            summary="A bus collision killed one in Mirpur.",
        ),
        date(2026, 5, 5),
    )
    second_id = upsert_accident_event(
        article_id,
        AccidentEvent(
            accident_type="motorcycle hit by truck",
            location_raw="Jatrabari crossing",
            district="Dhaka",
            deaths=1,
            injuries=0,
            vehicles_involved=["truck", "motorcycle"],
            summary="A truck hit a motorcycle in Jatrabari, killing one.",
        ),
        date(2026, 5, 5),
    )

    assert first_id != second_id
    assert len(_accidents()) == 2


def _write_log(path, payload):
    path.write_text(json.dumps(payload, default=str) + "\n")

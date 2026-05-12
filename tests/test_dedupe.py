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
            """SELECT id, article_id, accident_type, location_raw, deaths,
                      injuries, accident_date, summary, district, road_name,
                      vehicles_involved, accident_time, part_of_day
               FROM accidents
               ORDER BY id ASC"""
        ).fetchall()
        return [dict(row) for row in rows]


def _log_records(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


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

    records = _log_records(update_log)
    assert records[0]["score"] >= 75
    assert records[0]["decision"] == "updated_existing"
    assert records[0]["current_article"]["article_id"] == followup_article
    assert records[0]["existing_candidate"]["accident_id"] == first_id
    assert records[0]["merge_result"]["after"]["accident_date"] == "2026-05-03"
    assert records[0]["merge_result"]["after"]["deaths"] == 9
    assert records[0]["merge_result"]["after"]["injuries"] == 12


def test_high_confidence_update_fills_missing_time_metadata(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    first_article = _article("https://example.com/time-1", "Crash in Sylhet", date(2026, 5, 3))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            deaths=2,
            injuries=1,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet-Tamabil Highway",
            summary="A bus and microbus collided in Jaintapur, killing 2.",
        ),
        date(2026, 5, 3),
    )

    followup_article = _article("https://example.com/time-2", "Crash happened at night", date(2026, 5, 3))
    second_id = upsert_accident_event(
        followup_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            deaths=2,
            injuries=1,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet Tamabil Highway",
            accident_time="20.15",
            summary="A bus and microbus collided at 8:15pm in Jaintapur.",
        ),
        date(2026, 5, 3),
    )

    rows = _accidents()
    assert first_id == second_id
    assert rows[0]["accident_time"] == "20:15"
    assert rows[0]["part_of_day"] == "night"
    records = _log_records(update_log)
    assert records[0]["merge_result"]["after"]["accident_time"] == "20:15"


def test_high_confidence_update_does_not_overwrite_existing_time(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    first_article = _article("https://example.com/time-conflict-1", "Crash in Sylhet", date(2026, 5, 3))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            deaths=2,
            injuries=1,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet-Tamabil Highway",
            accident_time="19:30",
            summary="A bus and microbus collided in Jaintapur.",
        ),
        date(2026, 5, 3),
    )

    followup_article = _article("https://example.com/time-conflict-2", "Crash update", date(2026, 5, 3))
    second_id = upsert_accident_event(
        followup_article,
        AccidentEvent(
            accident_type="collision",
            location_raw="Sylhet-Tamabil Highway in Jaintapur upazila",
            district="Sylhet",
            deaths=2,
            injuries=1,
            vehicles_involved=["bus", "microbus"],
            road_name="Sylhet Tamabil Highway",
            accident_time="20:15",
            summary="A bus and microbus collided in Jaintapur.",
        ),
        date(2026, 5, 3),
    )

    rows = _accidents()
    assert first_id == second_id
    assert rows[0]["accident_time"] == "19:30"
    assert rows[0]["part_of_day"] == "evening"


def test_latest_first_updates_merge_into_earliest_accident_date(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    latest_article = _article("https://example.com/sylhet-3", "Sylhet death toll rises to 10", date(2026, 5, 5))
    latest_id = upsert_accident_event(
        latest_article,
        AccidentEvent(
            accident_type="head-on collision",
            location_raw="Telibazar area, South Surma upazila, Sylhet",
            district="Sylhet",
            division="Sylhet",
            deaths=10,
            injuries=12,
            vehicles_involved=["truck", "pickup"],
            road_name="Dhaka-Sylhet Highway",
            summary="Death toll rises to 10 after the Telibazar collision; 12 were injured.",
        ),
        date(2026, 5, 5),
        title="Sylhet death toll rises to 10",
        url="https://example.com/sylhet-3",
    )

    middle_article = _article("https://example.com/sylhet-2", "Death toll in Sylhet road accident rises to nine", date(2026, 5, 4))
    middle_id = upsert_accident_event(
        middle_article,
        AccidentEvent(
            accident_type="head-on collision",
            location_raw="Telibazar area, South Surma upazila, Sylhet",
            district="Sylhet",
            division="Sylhet",
            deaths=9,
            injuries=10,
            vehicles_involved=["truck", "pickup"],
            road_name="Dhaka Sylhet Highway",
            summary="Death toll rises to 9 after the Telibazar crash.",
        ),
        date(2026, 5, 4),
        title="Death toll in Sylhet road accident rises to nine",
        url="https://example.com/sylhet-2",
    )

    original_article = _article("https://example.com/sylhet-1", "Eight workers killed as truck, pickup collide head-on", date(2026, 5, 3))
    original_id = upsert_accident_event(
        original_article,
        AccidentEvent(
            accident_type="head-on collision",
            location_raw="Telibazar area, Dakshin Surma police station, Sylhet Metropolitan Police",
            district="Sylhet",
            division="Sylhet",
            deaths=8,
            injuries=9,
            vehicles_involved=["truck", "pickup"],
            road_name="Dhaka-Sylhet Highway",
            summary="Truck and pickup collided head-on in Telibazar, killing 8 and injuring 9.",
        ),
        date(2026, 5, 3),
        title="Eight workers killed as truck, pickup collide head-on",
        url="https://example.com/sylhet-1",
    )

    rows = _accidents()
    assert latest_id == middle_id == original_id
    assert len(rows) == 1
    assert rows[0]["accident_date"] == "2026-05-03"
    assert rows[0]["deaths"] == 10
    assert rows[0]["injuries"] == 12
    assert rows[0]["summary"].startswith("Death toll rises to 10")

    records = _log_records(update_log)
    assert [record["current_article"]["published_date"] for record in records] == [
        "2026-05-04",
        "2026-05-03",
    ]
    assert records[-1]["merge_result"]["after"]["accident_date"] == "2026-05-03"


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
    records = _log_records(ambiguity_log)
    assert len(records) == 1
    assert 50 <= records[0]["score"] < 75
    assert records[0]["decision"] == "inserted_ambiguous_possible_duplicate"
    assert records[0]["insert_result"]["accident_id"] == second_id
    assert records[0]["existing_candidate"]["accident_id"] == first_id


def test_different_districts_do_not_score_against_each_other(tmp_path, monkeypatch):
    decision_log = tmp_path / "accident_dedupe_decisions.log"
    monkeypatch.setattr(accident_dedupe, "write_decision_log", lambda payload: _write_log(decision_log, payload))

    tangail_article = _article("https://example.com/tangail", "Two killed in Tangail road accident", date(2026, 5, 4))
    tangail_id = upsert_accident_event(
        tangail_article,
        AccidentEvent(
            accident_type="head-on collision",
            location_raw="Rabna Bypass area, on the Dhaka-Tangail Highway",
            district="Tangail",
            deaths=2,
            injuries=2,
            vehicles_involved=["truck", "pickup"],
            road_name="Dhaka-Tangail Highway",
            summary="A truck hit a pickup head-on at Rabna Bypass.",
        ),
        date(2026, 5, 4),
    )

    sylhet_article = _article("https://example.com/sylhet", "Death toll in Sylhet road accident rises to nine", date(2026, 5, 4))
    sylhet_id = upsert_accident_event(
        sylhet_article,
        AccidentEvent(
            accident_type="head-on collision",
            location_raw="Telibazar area, South Surma upazila, Sylhet",
            district="Sylhet",
            deaths=9,
            injuries=12,
            vehicles_involved=["truck", "pickup"],
            road_name="Dhaka-Sylhet Highway",
            summary="Death toll rises to 9 after the Sylhet crash.",
        ),
        date(2026, 5, 4),
        title="Death toll in Sylhet road accident rises to nine",
    )

    assert tangail_id != sylhet_id
    assert len(_accidents()) == 2
    records = _log_records(decision_log)
    assert records[-1]["decision"] == "inserted_no_same_district_candidate"
    assert records[-1]["existing_candidate"] is None


def test_missing_district_inserts_without_dedupe(tmp_path, monkeypatch):
    decision_log = tmp_path / "accident_dedupe_decisions.log"
    monkeypatch.setattr(accident_dedupe, "write_decision_log", lambda payload: _write_log(decision_log, payload))

    article_id = _article("https://example.com/no-district", "Road crash kills one", date(2026, 5, 5))
    accident_id = upsert_accident_event(
        article_id,
        AccidentEvent(
            accident_type="road crash",
            location_raw="Unknown area",
            district=None,
            deaths=1,
            injuries=0,
            vehicles_involved=["bus"],
            summary="A bus crash killed one person.",
        ),
        date(2026, 5, 5),
    )

    records = _log_records(decision_log)
    assert accident_id == _accidents()[0]["id"]
    assert records[0]["decision"] == "inserted_dedupe_skipped_missing_district"
    assert records[0]["insert_result"]["accident_id"] == accident_id


def test_same_district_same_day_different_accidents_remain_separate(tmp_path, monkeypatch):
    decision_log = tmp_path / "accident_dedupe_decisions.log"
    monkeypatch.setattr(accident_dedupe, "write_decision_log", lambda payload: _write_log(decision_log, payload))

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


def test_cumilla_rail_crossing_wording_variants_merge(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    first_article = _article("https://example.com/cumilla-rail-1", "Bus-train collision kills seven", date(2026, 5, 5))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="bus-train collision at level crossing",
            location_raw="Shashidal rail crossing in Brahmanpara upazila, Cumilla",
            district="Cumilla",
            deaths=7,
            injuries=3,
            vehicles_involved=["bus", "train"],
            summary="A bus-train collision at Shashidal level crossing killed seven and injured three.",
        ),
        date(2026, 5, 5),
        title="Bus-train collision kills seven",
    )

    second_article = _article("https://example.com/cumilla-rail-2", "Train hits bus at rail crossing", date(2026, 5, 6))
    second_id = upsert_accident_event(
        second_article,
        AccidentEvent(
            accident_type="train hits bus at rail crossing",
            location_raw="Shashidal rail crossing, Brahmanpara, Cumilla",
            district="Cumilla",
            deaths=7,
            injuries=5,
            vehicles_involved=["train", "bus"],
            summary="A train hit a bus at the Shashidal rail crossing in Brahmanpara, injuring five.",
        ),
        date(2026, 5, 6),
        title="Train hits bus at rail crossing",
    )

    rows = _accidents()
    assert first_id == second_id
    assert len(rows) == 1
    assert rows[0]["deaths"] == 7
    assert rows[0]["injuries"] == 5

    records = _log_records(update_log)
    assert records[0]["score"] >= 75
    assert "same_accident_family" in records[0]["matched_signals"]
    assert records[0]["merge_result"]["after"]["injuries"] == 5


def test_dhaka_tejgaon_road_divider_wording_variants_merge(tmp_path, monkeypatch):
    update_log = tmp_path / "accident_update_events.log"
    monkeypatch.setattr(accident_dedupe, "write_update_log", lambda payload: _write_log(update_log, payload))

    first_article = _article("https://example.com/tejgaon-1", "Auto-rickshaw crash kills one", date(2026, 5, 5))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="auto-rickshaw crash into road divider",
            location_raw="Tejgaon industrial area in Dhaka",
            district="Dhaka",
            deaths=1,
            injuries=2,
            vehicles_involved=["auto-rickshaw"],
            summary="An auto-rickshaw crash into a road divider in Tejgaon killed one and injured two.",
        ),
        date(2026, 5, 5),
    )

    second_article = _article("https://example.com/tejgaon-2", "Auto-rickshaw crashed into divider in Tejgaon", date(2026, 5, 5))
    second_id = upsert_accident_event(
        second_article,
        AccidentEvent(
            accident_type="auto-rickshaw crashed into road divider",
            location_raw="Tejgaon industrial area, Dhaka",
            district="Dhaka",
            deaths=1,
            injuries=2,
            vehicles_involved=["auto-rickshaw"],
            summary="An auto-rickshaw crashed into the road divider in the Tejgaon industrial area.",
        ),
        date(2026, 5, 5),
    )

    rows = _accidents()
    assert first_id == second_id
    assert len(rows) == 1

    records = _log_records(update_log)
    assert records[0]["score"] >= 75
    assert "same_accident_family" in records[0]["matched_signals"]
    assert "compatible_accident_type" in records[0]["matched_signals"]


def test_same_district_vehicle_and_deaths_but_different_locations_remain_separate(tmp_path, monkeypatch):
    ambiguity_log = tmp_path / "accident_dedupe_ambiguity.log"
    monkeypatch.setattr(accident_dedupe, "write_ambiguity_log", lambda payload: _write_log(ambiguity_log, payload))

    first_article = _article("https://example.com/dhaka-mirpur", "Bus crash kills two in Mirpur", date(2026, 5, 7))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="bus collision",
            location_raw="Mirpur 10 intersection, Dhaka",
            district="Dhaka",
            deaths=2,
            injuries=0,
            vehicles_involved=["bus", "truck"],
            summary="A bus and truck collision at Mirpur 10 killed two.",
        ),
        date(2026, 5, 7),
    )

    second_article = _article("https://example.com/dhaka-wari", "Bus crash kills two in Wari", date(2026, 5, 7))
    second_id = upsert_accident_event(
        second_article,
        AccidentEvent(
            accident_type="bus collision",
            location_raw="Wari area near Bangabhaban, Dhaka",
            district="Dhaka",
            deaths=2,
            injuries=0,
            vehicles_involved=["bus", "truck"],
            summary="A bus and truck collision in Wari killed two.",
        ),
        date(2026, 5, 7),
    )

    assert first_id != second_id
    assert len(_accidents()) == 2
    records = _log_records(ambiguity_log)
    assert records[0]["score"] < 75


def test_same_district_and_family_without_location_overlap_remains_separate(tmp_path, monkeypatch):
    ambiguity_log = tmp_path / "accident_dedupe_ambiguity.log"
    monkeypatch.setattr(accident_dedupe, "write_ambiguity_log", lambda payload: _write_log(ambiguity_log, payload))

    first_article = _article("https://example.com/cumilla-crossing-1", "Train hits bus at Shashidal", date(2026, 5, 8))
    first_id = upsert_accident_event(
        first_article,
        AccidentEvent(
            accident_type="train hits bus at rail crossing",
            location_raw="Shashidal rail crossing, Brahmanpara, Cumilla",
            district="Cumilla",
            deaths=4,
            injuries=1,
            vehicles_involved=["train", "bus"],
            summary="A train hit a bus at Shashidal rail crossing in Cumilla.",
        ),
        date(2026, 5, 8),
    )

    second_article = _article("https://example.com/cumilla-crossing-2", "Bus-train collision at Rajapur", date(2026, 5, 8))
    second_id = upsert_accident_event(
        second_article,
        AccidentEvent(
            accident_type="bus-train collision at level crossing",
            location_raw="Rajapur level crossing in Laksam upazila, Cumilla",
            district="Cumilla",
            deaths=4,
            injuries=1,
            vehicles_involved=["bus", "train"],
            summary="A bus-train collision at Rajapur level crossing killed four.",
        ),
        date(2026, 5, 8),
    )

    assert first_id != second_id
    assert len(_accidents()) == 2
    records = _log_records(ambiguity_log)
    assert records[0]["score"] < 75
    assert "same_accident_family" in records[0]["matched_signals"]
    assert "location_overlap" not in records[0]["matched_signals"]


def _write_log(path, payload):
    with path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(payload, default=str) + "\n")

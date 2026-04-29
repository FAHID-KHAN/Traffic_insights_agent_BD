"""Tests for app/extractor.py — accident data extraction from article text."""
import json
import pytest
from datetime import date
from app.extractor import AccidentExtractor
import app.llm.llm_extractor as llm_extractor_module
from app.llm.llm_extractor import LLMAccidentExtractor
from app.llm.llm_schema import ExtractionResult
from app.regex_extractor import RegexAccidentExtractor
from app import database as db


@pytest.fixture
def extractor():
    return AccidentExtractor()


@pytest.fixture
def regex_extractor():
    return RegexAccidentExtractor()


@pytest.fixture
def sample_article_id():
    return db.insert_article(
        "https://example.com/test-article",
        "Test Road Accident Article",
        "placeholder",
        date(2025, 6, 1),
    )


# ── Accident type detection ─────────────────────────────────────

class TestAccidentType:
    def test_bus_accident(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A bus crashed into a tree") == "bus accident"

    def test_truck_accident(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A truck overturned on the highway") == "truck accident"

    def test_train_accident(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A train derailed near the bridge") == "train accident"

    def test_boat_accident(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A launch capsized in the river") == "boat accident"

    def test_hit_and_run(self, regex_extractor):
        assert regex_extractor._extract_accident_type("The driver fled the scene after hitting the pedestrian") == "hit-and-run"

    def test_head_on_collision(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A head-on collision between two buses") == "head-on collision"

    def test_motorcycle(self, regex_extractor):
        assert regex_extractor._extract_accident_type("A motorcycle crash happened at midnight") == "motorcycle accident"

    def test_default_road_accident(self, regex_extractor):
        assert regex_extractor._extract_accident_type("Something happened on the street") == "road accident"


# ── Location extraction ─────────────────────────────────────────

class TestLocation:
    def test_district_detected(self, regex_extractor):
        loc = regex_extractor._extract_location("An accident in Gazipur left 3 dead")
        assert loc["district"] == "Gazipur"

    def test_division_detected(self, regex_extractor):
        loc = regex_extractor._extract_location("The crash occurred in Sylhet division")
        assert loc["division"] == "Sylhet"

    def test_division_inferred_from_district(self, regex_extractor):
        loc = regex_extractor._extract_location("A tragedy in Comilla reported 5 dead")
        assert loc["district"] in ("Comilla", "Cumilla")
        assert loc["division"] == "Chittagong"

    def test_no_location(self, regex_extractor):
        loc = regex_extractor._extract_location("Generic text without place names")
        assert loc["district"] is None


# ── Casualty extraction ─────────────────────────────────────────

class TestCasualties:
    def test_numeric_deaths(self, regex_extractor):
        c = regex_extractor._extract_casualties("At least 5 people were killed in the crash")
        assert c["deaths"] == 5

    def test_word_deaths(self, regex_extractor):
        c = regex_extractor._extract_casualties("Three people were killed in the accident")
        assert c["deaths"] == 3

    def test_injuries(self, regex_extractor):
        c = regex_extractor._extract_casualties("12 were injured in the collision")
        assert c["injuries"] == 12

    def test_mixed(self, regex_extractor):
        c = regex_extractor._extract_casualties(
            "The crash killed 4 and injured 20 others"
        )
        assert c["deaths"] >= 4
        assert c["injuries"] >= 20

    def test_zero_when_no_mention(self, regex_extractor):
        c = regex_extractor._extract_casualties("Traffic jam on the highway today")
        assert c["deaths"] == 0
        assert c["injuries"] == 0


# ── Vehicle extraction ──────────────────────────────────────────

class TestVehicles:
    def test_bus_and_truck(self, regex_extractor):
        v = RegexAccidentExtractor._extract_vehicles("A bus collided with a truck")
        assert "bus" in v
        assert "truck" in v

    def test_none_when_no_vehicle(self, regex_extractor):
        v = RegexAccidentExtractor._extract_vehicles("Nobody was there.")
        assert v is None


# ── Summary generation ──────────────────────────────────────────

class TestSummary:
    def test_strips_boilerplate(self, regex_extractor):
        text = (
            "At least 5 killed in Dhaka bus accident. "
            "The bus overturned on the highway. "
            "© The Daily Star all rights reserved."
        )
        s = RegexAccidentExtractor._generate_summary(text)
        assert "Daily Star" not in s
        assert "killed" in s

    def test_max_length(self, regex_extractor):
        long = " ".join(["word"] * 500)
        s = RegexAccidentExtractor._generate_summary(long, max_length=100)
        assert len(s) <= 200  # generous bound because of sentence splitting


# ── Full pipeline (process_article) ─────────────────────────────

class TestProcessArticle:
    def test_extracts_accident(self, extractor, sample_article_id):
        content = (
            "At least 5 people were killed and 12 injured when a bus "
            "crashed into a truck in Gazipur on the Dhaka-Mymensingh highway. "
            "The head-on collision happened early morning."
        )
        ids = extractor.process_article(sample_article_id, content, date(2025, 6, 1))
        assert len(ids) == 1

        rows = db.get_recent_accidents(10)
        match = [r for r in rows if r["id"] == ids[0]]
        assert len(match) == 1
        assert match[0]["deaths"] >= 5
        assert match[0]["injuries"] >= 12
        assert match[0]["district"] == "Gazipur"

    def test_skips_non_accident(self, extractor, sample_article_id):
        content = "The weather is sunny today in Dhaka. People enjoyed the day."
        ids = extractor.process_article(sample_article_id, content, date(2025, 6, 1))
        assert ids == []

    def test_skips_short_content(self, extractor, sample_article_id):
        ids = extractor.process_article(sample_article_id, "too short", date(2025, 6, 1))
        assert ids == []


class _FakeLLMClient:
    def __init__(self, payload):
        self.payload = payload

    def chat_json(self, messages, response_schema, schema_name="accident_extraction"):
        return json.dumps(self.payload)


class TestLLMNullHandling:
    def test_schema_accepts_outside_bangladesh_article_type(self):
        result = ExtractionResult.model_validate(
            {
                "article_type": "outside_bangladesh",
                "skip_reason": "Accident happened in Jakarta, Indonesia.",
                "accidents": [],
            }
        )

        assert result.article_type == "outside_bangladesh"
        assert result.accidents == []

    def test_skips_report_style_payload_without_insert(self, sample_article_id, tmp_path, monkeypatch):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": None,
                            "location_raw": None,
                            "district": None,
                            "division": None,
                            "deaths": 0,
                            "injuries": 0,
                            "vehicles_involved": None,
                            "road_name": None,
                            "accident_date": None,
                            "summary": "Report provides June road-accident totals; no specific incident described.",
                            "confidence": 0.92,
                        }
                    ]
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "Monthly report content about totals and statistics.",
            date(2025, 7, 2),
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["article_id"] == sample_article_id
        assert records[0]["reason"] == "non_incident"
        assert records[0]["published_date"] == "2025-07-02"
        assert "no specific incident" in records[0]["event"]["summary"]

    def test_skips_empty_payload_without_insert(self, sample_article_id, tmp_path, monkeypatch):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": None,
                            "location_raw": None,
                            "district": None,
                            "division": None,
                            "deaths": 0,
                            "injuries": 0,
                            "vehicles_involved": None,
                            "road_name": None,
                            "accident_date": None,
                            "summary": None,
                            "confidence": 0.51,
                        }
                    ]
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "Non-incident content long enough to reach the LLM extractor.",
            date(2025, 6, 1),
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["reason"] == "empty_payload"
        assert records[0]["event"]["summary"] is None

    def test_logs_casualty_outlier_without_insert(self, sample_article_id, tmp_path, monkeypatch):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": "road accident",
                            "location_raw": "Dhaka",
                            "district": "Dhaka",
                            "division": "Dhaka",
                            "deaths": 999,
                            "injuries": 0,
                            "vehicles_involved": ["bus"],
                            "road_name": None,
                            "accident_date": None,
                            "summary": "A report-like payload with unrealistic casualty count.",
                            "confidence": 0.8,
                        }
                    ]
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "Concrete-looking payload with unrealistic casualty values.",
            date(2025, 6, 1),
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["reason"] == "casualty_outlier"
        assert records[0]["event"]["deaths"] == 999

    def test_skips_time_window_roundup_title_without_insert(
        self,
        sample_article_id,
        tmp_path,
        monkeypatch,
    ):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        title = "13 killed in road accidents in 2 days"
        url = (
            "https://www.newagebd.net/post/country/296941/"
            "13-killed-in-road-accidents-in-2-days"
        )
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "time_window_roundup",
                    "skip_reason": "Title says the article summarizes road accidents over two days.",
                    "accidents": [],
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "At least 13 people were killed and 10 more were injured in road crashes "
            "in several districts between Tuesday and Wednesday.",
            date(2026, 4, 16),
            title=title,
            url=url,
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["article_id"] == sample_article_id
        assert records[0]["reason"] == "time_window_roundup"
        assert records[0]["published_date"] == "2026-04-16"
        assert records[0]["title"] == title
        assert records[0]["url"] == url
        assert "two days" in records[0]["skip_reason"]

    def test_skips_outside_bangladesh_article_without_insert(
        self,
        sample_article_id,
        tmp_path,
        monkeypatch,
    ):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        title = "Bus crash kills 12 in Jakarta"
        url = "https://www.newagebd.net/post/world/example"
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "outside_bangladesh",
                    "skip_reason": "The crash happened in Jakarta, Indonesia, not Bangladesh.",
                    "accidents": [],
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "At least 12 people were killed when a bus crashed in Jakarta, Indonesia.",
            date(2026, 4, 20),
            title=title,
            url=url,
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["article_id"] == sample_article_id
        assert records[0]["reason"] == "outside_bangladesh"
        assert records[0]["published_date"] == "2026-04-20"
        assert records[0]["title"] == title
        assert records[0]["url"] == url
        assert "not Bangladesh" in records[0]["skip_reason"]
        assert records[0]["event"] is None

    def test_skips_outside_bangladesh_event_without_insert(
        self,
        sample_article_id,
        tmp_path,
        monkeypatch,
    ):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": "bus crash",
                            "location_raw": "Jakarta, Indonesia",
                            "district": None,
                            "division": None,
                            "deaths": 12,
                            "injuries": 5,
                            "vehicles_involved": ["bus"],
                            "road_name": None,
                            "accident_date": None,
                            "summary": "A bus crash in Jakarta, Indonesia killed 12 people.",
                            "confidence": 0.95,
                        }
                    ],
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "At least 12 people were killed when a bus crashed in Jakarta, Indonesia.",
            date(2026, 4, 20),
        )

        assert inserted == []
        assert db.get_recent_accidents(10) == []
        records = [json.loads(line) for line in log_path.read_text().splitlines()]
        assert len(records) == 1
        assert records[0]["reason"] == "outside_bangladesh"
        assert records[0]["event"]["location_raw"] == "Jakarta, Indonesia"
        assert records[0]["event"]["deaths"] == 12

    def test_keeps_valid_incident_insert(self, sample_article_id, tmp_path, monkeypatch):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": "bus crash",
                            "location_raw": "Dhaka-Mymensingh highway, Gazipur",
                            "district": "Gazipur",
                            "division": "Dhaka",
                            "deaths": 5,
                            "injuries": 12,
                            "vehicles_involved": ["bus", "truck"],
                            "road_name": "Dhaka-Mymensingh Highway",
                            "accident_date": None,
                            "summary": "A bus crashed into a truck in Gazipur, killing 5 and injuring 12.",
                            "confidence": 0.97,
                        }
                    ]
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "Concrete accident coverage with named road, district, and casualties.",
            date(2025, 6, 1),
        )

        assert len(inserted) == 1
        rows = db.get_recent_accidents(10)
        assert len(rows) == 1
        assert rows[0]["district"] == "Gazipur"
        assert rows[0]["deaths"] == 5
        assert not log_path.exists()

    def test_keeps_valid_daily_multi_location_incidents(
        self,
        sample_article_id,
        tmp_path,
        monkeypatch,
    ):
        log_path = tmp_path / "non_incident_report.log"
        monkeypatch.setattr(llm_extractor_module, "_DISCARD_LOG_PATH", log_path)
        extractor = LLMAccidentExtractor(
            client=_FakeLLMClient(
                {
                    "article_type": "daily_incident",
                    "skip_reason": None,
                    "accidents": [
                        {
                            "accident_type": "truck crash",
                            "location_raw": "Cumilla",
                            "district": "Cumilla",
                            "division": "Chittagong",
                            "deaths": 7,
                            "injuries": 6,
                            "vehicles_involved": ["truck"],
                            "road_name": None,
                            "accident_date": None,
                            "summary": "A truck plunged into a ditch in Cumilla, killing 7 and injuring 6.",
                            "confidence": 0.94,
                        },
                        {
                            "accident_type": "road accident",
                            "location_raw": "Gazipur",
                            "district": "Gazipur",
                            "division": "Dhaka",
                            "deaths": 2,
                            "injuries": 1,
                            "vehicles_involved": ["bus"],
                            "road_name": None,
                            "accident_date": None,
                            "summary": "A bus accident in Gazipur killed 2 people and injured 1.",
                            "confidence": 0.91,
                        },
                    ],
                }
            )
        )

        inserted = extractor.process_article(
            sample_article_id,
            "Current accident coverage from multiple districts with named locations and casualties.",
            date(2026, 4, 16),
            title="9 killed in road accidents in 3 districts",
        )

        assert len(inserted) == 2
        rows = db.get_recent_accidents(10)
        assert len(rows) == 2
        assert sum(row["deaths"] for row in rows) == 9
        assert not log_path.exists()

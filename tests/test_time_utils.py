from app.time_utils import (
    normalize_accident_time,
    normalize_part_of_day,
    normalize_time_metadata,
    part_of_day_for_time,
)


def test_strict_time_parsing():
    assert normalize_accident_time("12.30 PM") == "12:30"
    assert normalize_accident_time("12:30 am") == "00:30"
    assert normalize_accident_time("23.00") == "23:00"
    assert normalize_accident_time("3.30 am") == "03:30"
    assert normalize_accident_time("00:15") == "00:15"


def test_part_of_day_boundaries():
    assert part_of_day_for_time("00:00") == "midnight"
    assert part_of_day_for_time("00:59") == "midnight"
    assert part_of_day_for_time("01:00") == "dawn"
    assert part_of_day_for_time("05:59") == "dawn"
    assert part_of_day_for_time("06:00") == "morning"
    assert part_of_day_for_time("10:59") == "morning"
    assert part_of_day_for_time("11:00") == "noon"
    assert part_of_day_for_time("12:59") == "noon"
    assert part_of_day_for_time("13:00") == "afternoon"
    assert part_of_day_for_time("16:59") == "afternoon"
    assert part_of_day_for_time("17:00") == "evening"
    assert part_of_day_for_time("19:59") == "evening"
    assert part_of_day_for_time("20:00") == "night"
    assert part_of_day_for_time("23:59") == "night"


def test_textual_part_aliases():
    assert normalize_part_of_day("early morning") == "dawn"
    assert normalize_part_of_day("Midday") == "noon"
    assert normalize_part_of_day("in the evening") == "evening"


def test_invalid_or_ambiguous_input_returns_none():
    assert normalize_accident_time("around 3:30 pm") is None
    assert normalize_accident_time("25:00") is None
    assert normalize_accident_time("12:60") is None
    assert normalize_part_of_day("late afternoonish") is None
    assert normalize_time_metadata(None, None) == (None, None)

"""Tests for road and highway name normalization."""

from app.normalize_roads import normalize_road_name


def test_normalizes_case_and_suffix():
    assert normalize_road_name("Dhaka-Sylhet highway") == "Dhaka-Sylhet Highway"


def test_normalizes_dash_variants():
    assert normalize_road_name("Dhaka–Chattogram highway") == "Dhaka-Chattogram Highway"


def test_normalizes_apostrophes_and_place_aliases():
    assert (
        normalize_road_name("Chittagong-Cox’s Bazar highway")
        == "Chattogram-Cox's Bazar Highway"
    )


def test_normalizes_district_spelling_inside_name():
    assert normalize_road_name("Bogra-Naogaon Highway") == "Bogura-Naogaon Highway"


def test_blank_values_return_none():
    assert normalize_road_name(None) is None
    assert normalize_road_name("   ") is None

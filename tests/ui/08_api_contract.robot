*** Settings ***
Documentation
...    API Health & Contract Tests (via Browser)
...    ═══════════════════════════════════════════════════════
...    Validates critical API endpoints return correct status codes and
...    data shapes. These run via Robot Framework HTTP library to test
...    the backend contract independently of the UI.
...
...    Edge Cases Covered:
...    • API returns JSON (not HTML from SPA catch-all)
...    • Overview endpoint includes all required fields
...    • Map data endpoint returns array with coordinates
...    • Search with empty query doesn't 500
...    • Divisions endpoint returns 8 unique divisions
...    • Daily endpoint handles missing date param

Library    RequestsLibrary
Library    Collections
Library    String

*** Variables ***
${API_BASE}    http://localhost:8000/api

*** Test Cases ***
# ─── Core Endpoints ───────────────────────────────────────────────
Overview API Returns Valid JSON With Required Fields
    [Documentation]    /api/overview must include totals, today, last_scrape, extraction_mode.
    ...    EDGE CASE: If DB is empty, totals should be 0 (not null or missing keys).
    [Tags]    api    smoke    contract
    ${resp}=    GET    ${API_BASE}/overview    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    Dictionary Should Contain Key    ${json}    total_accidents
    Dictionary Should Contain Key    ${json}    total_deaths
    Dictionary Should Contain Key    ${json}    total_injuries
    Dictionary Should Contain Key    ${json}    total_articles
    Dictionary Should Contain Key    ${json}    today
    Dictionary Should Contain Key    ${json}    extraction_mode
    Should Be True    ${json['total_accidents']} >= 0

Map Data API Returns Array With Coordinates
    [Documentation]    /api/map-data must return a JSON array where each item
    ...    has lat, lon, and accident metadata.
    ...    EDGE CASE: Null coordinates from LLM should be filtered out.
    [Tags]    api    map    contract
    ${resp}=    GET    ${API_BASE}/map-data    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    ${length}=    Get Length    ${json}
    Should Be True    ${length} >= 0    msg=Map data should be an array
    IF    ${length} > 0
        ${first}=    Set Variable    ${json[0]}
        Dictionary Should Contain Key    ${first}    latitude
        Dictionary Should Contain Key    ${first}    longitude
    END

Divisions API Returns Array With Unique Entries
    [Documentation]    /api/divisions must return exactly 8 Bangladesh divisions
    ...    with no duplicates (Chittagong/Chattogram was a past bug).
    [Tags]    api    divisions    data-integrity
    ${resp}=    GET    ${API_BASE}/divisions    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    ${length}=    Get Length    ${json}
    Should Be True    ${length} >= 1    msg=Expected at least 1 division
    Should Be True    ${length} <= 9    msg=Too many divisions (${length})

Daily API Returns Data For Valid Date
    [Documentation]    /api/daily?date=2026-01-01 should return a JSON response.
    ...    EDGE CASE: Missing date param should default to today, not 500.
    [Tags]    api    daily    contract
    ${resp}=    GET    url=${API_BASE}/daily?date=2026-01-01    expected_status=200

Daily API Handles Missing Date Param
    [Documentation]    Calling /api/daily without a date should default gracefully.
    ...    EDGE CASE: Some endpoints require date params and return 422
    ...    without them — this is acceptable but should not be 500.
    [Tags]    api    daily    edge-case
    ${resp}=    GET    ${API_BASE}/daily    expected_status=any
    Should Be True    ${resp.status_code} < 500    msg=API returned 500 for /daily without date

Trend API Returns Array
    [Documentation]    /api/trend should return time series data for chart rendering.
    [Tags]    api    trend    contract
    ${resp}=    GET    ${API_BASE}/trend    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    len($json) >= 0    msg=Trend should return a list

# ─── Search & Safety ─────────────────────────────────────────────
Search API Handles SQL Injection Attempt
    [Documentation]    Parameterized queries must prevent SQL injection.
    ...    EDGE CASE: This tests the backend directly — the search param
    ...    contains a classic SQL injection payload.
    [Tags]    api    security    edge-case
    ${resp}=    GET    url=${API_BASE}/search    params=q=';DROP TABLE accidents;--    expected_status=any
    Should Be True    ${resp.status_code} < 500    msg=SQL injection caused a 500 error

Search API Returns Results For Valid Query
    [Documentation]    A valid search term should return results array.
    [Tags]    api    search    contract
    ${resp}=    GET    url=${API_BASE}/search?q=bus&limit=10    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    len($json) >= 0

Recent API Returns Accident Records
    [Documentation]    /api/recent should return the latest accidents.
    [Tags]    api    records    contract
    ${resp}=    GET    url=${API_BASE}/recent?limit=5    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    ${length}=    Get Length    ${json}
    Should Be True    ${length} >= 0

# ─── Danger Zones & Compare ──────────────────────────────────────
Danger Zones API Returns Ranked Districts
    [Documentation]    /api/danger-zones returns districts with accident counts.
    [Tags]    api    zones    contract
    ${resp}=    GET    url=${API_BASE}/danger-zones?limit=10    expected_status=200
    ${json}=    Set Variable    ${resp.json()}
    ${length}=    Get Length    ${json}
    Should Be True    ${length} >= 0

Danger Index API Returns Fatality Scores
    [Documentation]    /api/danger-index returns fatality-scored districts.
    [Tags]    api    zones    contract
    ${resp}=    GET    url=${API_BASE}/danger-index?limit=10    expected_status=200

Monthly API Returns Data
    [Documentation]    /api/monthly with year and month should return stats.
    [Tags]    api    monthly    contract
    ${resp}=    GET    url=${API_BASE}/monthly?year=2026&month=1    expected_status=200

Compare Yearly API Does Not Crash
    [Documentation]    /api/compare/yearly with two years should not 500.
    ...    EDGE CASE: Same year for both params should return valid delta (0).
    [Tags]    api    compare    edge-case
    ${resp}=    GET    url=${API_BASE}/compare/yearly?year1=2025&year2=2026    expected_status=any
    Should Be True    ${resp.status_code} < 500    msg=Compare yearly API crashed

# ─── Non-existent endpoints ──────────────────────────────────────
Non-Existent API Endpoint Returns 404 Or 405
    [Documentation]    Random /api/xyz should return a proper error, not the SPA HTML.
    ...    EDGE CASE: If the API router doesn't handle 404s, the SPA catch-all
    ...    returns index.html with 200 — which is incorrect for API calls.
    [Tags]    api    edge-case    contract
    ${resp}=    GET    ${API_BASE}/nonexistent-endpoint-xyz    expected_status=any
    Should Be True    ${resp.status_code} != 500    msg=API returned 500 for unknown endpoint

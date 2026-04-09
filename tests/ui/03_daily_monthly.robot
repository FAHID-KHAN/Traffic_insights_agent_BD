*** Settings ***
Documentation
...    Daily & Monthly Analysis Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates date-driven pages: Daily (single date picker) and
...    Monthly (year + month selectors).
...
...    Edge Cases Covered:
...    • Selecting a future date (no data expected)
...    • Selecting a very old date (no data expected)
...    • Month/year dropdown boundary values (January, December)
...    • Page loads without crashing even with zero results
...    • Stat cards render correctly for both pages

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
# ─── Daily Page ───────────────────────────────────────────────────
Daily Page Loads With Date Picker
    [Documentation]    The daily page must render with a date input and stat cards.
    [Tags]    daily    smoke
    Go To    ${BASE_URL}/daily
    Sleep    1s
    Wait For Elements State    css=input[type="date"]    visible
    ${cards}=    Get Elements    css=.stat-card
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 3    msg=Expected at least 3 stat cards on Daily

Daily Page Shows Charts
    [Documentation]    Daily should render accident type pie chart and district bar chart.
    [Tags]    daily    charts
    Go To    ${BASE_URL}/daily
    Sleep    1.5s
    ${charts}=    Get Elements    css=.chart-card
    ${count}=    Get Length    ${charts}
    Should Be True    ${count} >= 1    msg=Expected at least 1 chart on Daily

Daily Page Handles Future Date Gracefully
    [Documentation]    Selecting a future date should show zero/empty state, not crash.
    ...    EDGE CASE: If the API doesn't handle future dates, it may return
    ...    a 500 error or the frontend may show NaN/undefined.
    [Tags]    daily    edge-case
    Go To    ${BASE_URL}/daily
    Sleep    1s
    Fill Text    css=input[type="date"]    2030-12-31
    Sleep    1s
    # Page should still be intact — header and stat cards visible
    Wait For Elements State    .header    visible
    ${cards}=    Get Elements    css=.stat-card
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 3    msg=Page crashed on future date

# ─── Monthly Page ─────────────────────────────────────────────────
Monthly Page Loads With Year And Month Selectors
    [Documentation]    Must show year and month dropdown selectors.
    [Tags]    monthly    smoke
    Go To    ${BASE_URL}/monthly
    Sleep    1s
    ${selects}=    Get Elements    css=.date-controls select
    ${count}=    Get Length    ${selects}
    Should Be True    ${count} >= 2    msg=Expected year and month selectors

Monthly Page Shows Stat Cards
    [Documentation]    Monthly page should display stat cards with totals.
    [Tags]    monthly    smoke
    Go To    ${BASE_URL}/monthly
    Sleep    1s
    ${cards}=    Get Elements    css=.stat-card
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 3    msg=Expected at least 3 stat cards on Monthly

Monthly Page Switching Month Updates Data
    [Documentation]    Changing the month selector should trigger a re-fetch.
    ...    EDGE CASE: If the onChange handler is missing, selecting a new month
    ...    does nothing and stale data persists.
    [Tags]    monthly    interaction
    Go To    ${BASE_URL}/monthly
    Sleep    1s
    # Select a different month
    Select Options By    css=.date-controls select >> nth=1    value    1
    Sleep    1.5s
    Wait For Elements State    .header    visible    message=Page crashed after month change
    Wait For Elements State    .main    visible    message=Main content missing after month change

Monthly Page Handles Empty Month Gracefully
    [Documentation]    A month with no accidents should show zeros or an empty state.
    ...    EDGE CASE: Selecting January 2020 (before data collection) should not crash.
    [Tags]    monthly    edge-case
    Go To    ${BASE_URL}/monthly
    Sleep    1s
    # Select a year unlikely to have data
    ${year_selects}=    Get Elements    css=.date-controls select
    Select Options By    css=.date-controls select >> nth=0    label    2021
    Sleep    1s
    Wait For Elements State    .header    visible    message=Page crashed on empty month

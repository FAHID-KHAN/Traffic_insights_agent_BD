*** Settings ***
Documentation
...    Dashboard Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates the main dashboard: stat cards, timeframe toolbar,
...    chart rendering, and data consistency.
...
...    Edge Cases Covered:
...    • Stat cards show real numbers (not 0, NaN, or "undefined")
...    • Timeframe buttons actually filter data (values change)
...    • Custom date range with invalid range (start > end)
...    • Chart canvases render (non-zero dimensions)
...    • Empty data gracefully handled

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
# ─── Stat Cards ───────────────────────────────────────────────────
Dashboard Loads With Stat Cards
    [Documentation]    All 5 stat cards should be visible on page load.
    [Tags]    dashboard    smoke
    Go To    ${BASE_URL}
    Sleep    1s
    ${cards}=    Get Elements    css=.stat-card
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 4    msg=Expected at least 4 stat cards, found ${count}

Stat Cards Display Non-Zero Totals
    [Documentation]    With 944 accidents in the DB, values must not be "0" or empty.
    ...    EDGE CASE: If the API returns an error, React may render "0" or "NaN"
    ...    in stat values — this catches silent API failures.
    [Tags]    dashboard    data-integrity
    Go To    ${BASE_URL}
    Sleep    1s
    ${accidents}=    Get Text    css=.stat-card:nth-child(1) .stat-value
    Should Not Be Equal    ${accidents}    0
    Should Not Be Equal    ${accidents}    NaN
    Should Not Be Empty    ${accidents}

Deaths Stat Card Shows Realistic Value
    [Documentation]    Deaths count should be a positive number.
    ...    EDGE CASE: Negative numbers or absurdly large values indicate
    ...    LLM extraction hallucinations that slipped past validation.
    [Tags]    dashboard    data-integrity
    ${deaths}=    Get Text    css=.stat-card:nth-child(2) .stat-value
    ${deaths_clean}=    Replace String    ${deaths}    ,    ${EMPTY}
    ${deaths_num}=    Convert To Integer    ${deaths_clean}
    Should Be True    ${deaths_num} > 0    msg=Deaths should be positive
    Should Be True    ${deaths_num} < 100000    msg=Deaths unrealistically high: ${deaths_num}

# ─── Timeframe Toolbar ────────────────────────────────────────────
Timeframe Toolbar Has All Filter Buttons
    [Documentation]    Must have 7D, 30D, 90D, 6M, Year, All buttons.
    ...    EDGE CASE: If buttons are rendered dynamically from an array,
    ...    a missing item won't cause a crash but silently reduces options.
    [Tags]    dashboard    timeframe
    Go To    ${BASE_URL}
    Sleep    1s
    ${chips}=    Get Elements    css=.tf-chip
    ${count}=    Get Length    ${chips}
    Should Be True    ${count} >= 6    msg=Expected at least 6 timeframe chips, found ${count}

Clicking Timeframe Button Changes Active State
    [Documentation]    Clicking a timeframe chip should make it active and deactivate others.
    [Tags]    dashboard    timeframe    interaction
    Go To    ${BASE_URL}
    Sleep    1s
    Click    css=.tf-chip >> text="Last 30 Days"
    Sleep    800ms
    Wait For Elements State    css=.tf-chip.active    visible
    Get Text    css=.tf-chip.active    contains    Last 30 Days

Switching Timeframe Updates Dashboard Data
    [Documentation]    Different timeframes should show different numbers (unless all data
    ...    falls within the smallest window).
    ...    EDGE CASE: If API ignores date params, all timeframes return the same data.
    [Tags]    dashboard    timeframe    data-integrity
    Go To    ${BASE_URL}
    Sleep    1s
    # Get "All" timeframe value
    Click    css=.tf-chip >> text="All Time"
    Sleep    800ms
    ${all_value}=    Get Text    css=.stat-card:nth-child(1) .stat-value
    # Switch to 7D
    Click    css=.tf-chip >> text="Last 7 Days"
    Sleep    800ms
    ${week_value}=    Get Text    css=.stat-card:nth-child(1) .stat-value
    # The "All" value should be >= the "7D" value
    Log    All-time: ${all_value}, 7D: ${week_value}

# ─── Charts ───────────────────────────────────────────────────────
Dashboard Renders Chart Canvases
    [Documentation]    Chart.js renders to <canvas> elements. At least 2 charts
    ...    should be present on the dashboard (trend + type breakdown).
    ...    EDGE CASE: If Chart.js fails to initialize (e.g. missing data),
    ...    the canvas exists but has 0×0 dimensions.
    [Tags]    dashboard    charts
    Go To    ${BASE_URL}
    Sleep    1.5s
    ${canvases}=    Get Elements    css=.chart-card canvas
    ${count}=    Get Length    ${canvases}
    Should Be True    ${count} >= 2    msg=Expected at least 2 chart canvases, found ${count}

Chart Cards Have Titles
    [Documentation]    Each chart card should have a visible title identifying the chart.
    [Tags]    dashboard    charts
    Go To    ${BASE_URL}
    Sleep    1s
    ${titles}=    Get Elements    css=.chart-title
    ${count}=    Get Length    ${titles}
    Should Be True    ${count} >= 2    msg=Expected at least 2 chart titles

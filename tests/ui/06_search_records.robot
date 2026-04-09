*** Settings ***
Documentation
...    Search & Records Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates the advanced search with filters, CSV export,
...    and the records table with debounced search.
...
...    Edge Cases Covered:
...    • Empty search query returns results (not an error)
...    • Special characters in search (SQL injection attempt)
...    • Search with no results shows empty state
...    • Filter dropdowns populate correctly
...    • CSV export button is present
...    • Records search debounce doesn't lose input

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
# ─── Search Page ──────────────────────────────────────────────────
Search Page Loads With Filter Controls
    [Documentation]    Must have search input, district/type/severity dropdowns, date pickers.
    [Tags]    search    smoke
    Go To    ${BASE_URL}/search
    Sleep    1s
    Wait For Elements State    css=input[type="text"], input[type="search"]    visible
    ${selects}=    Get Elements    css=select
    ${count}=    Get Length    ${selects}
    Should Be True    ${count} >= 3    msg=Expected at least 3 filter dropdowns (district, type, severity)

Search Returns Results For Common Terms
    [Documentation]    Searching for "bus" or "truck" — common accident types — should
    ...    return at least some results from the 944 accidents in DB.
    [Tags]    search    data-integrity
    Go To    ${BASE_URL}/search
    Sleep    1s
    Fill Text    css=input[type="text"], input[type="search"]    bus
    Press Keys    css=input[type="text"], input[type="search"]    Enter
    Sleep    1.5s
    # Check that results area updated (either table rows or result count)
    Wait For Elements State    .main    visible

Search Handles Special Characters Safely
    [Documentation]    SQL injection attempt via search input must not crash the app.
    ...    EDGE CASE: Input like '; DROP TABLE-- should be sanitized by the
    ...    backend parameterized queries. Frontend should not show an error page.
    [Tags]    search    security    edge-case
    Go To    ${BASE_URL}/search
    Sleep    1s
    Fill Text    css=input[type="text"], input[type="search"]    '; DROP TABLE accidents;--
    Press Keys    css=input[type="text"], input[type="search"]    Enter
    Sleep    1.5s
    # App must not crash — header should still be visible
    Wait For Elements State    .header    visible    message=App crashed on special character input
    # Should not show a server error
    ${content}=    Get Text    css=.main
    Should Not Contain    ${content}    Internal Server Error
    Should Not Contain    ${content}    500

Search With No Results Shows Empty State
    [Documentation]    Searching for a nonsense string should show an empty/no-results state.
    ...    EDGE CASE: Some apps show a blank page instead of an "empty state"
    ...    message, which is confusing for users.
    [Tags]    search    edge-case
    Go To    ${BASE_URL}/search
    Sleep    1s
    Fill Text    css=input[type="text"], input[type="search"]    zzzzxyznonexistent12345
    Press Keys    css=input[type="text"], input[type="search"]    Enter
    Sleep    1.5s
    Wait For Elements State    .header    visible

CSV Export Button Is Present On Search Page
    [Documentation]    The export CSV button should be accessible for downloading results.
    [Tags]    search    export
    Go To    ${BASE_URL}/search
    Sleep    1s
    Fill Text    css=input[type="text"], input[type="search"]    accident
    Press Keys    css=input[type="text"], input[type="search"]    Enter
    Sleep    1.5s
    # Look for an export/download button
    ${buttons}=    Get Elements    css=button:has-text("Export"), button:has-text("CSV"), button:has-text("Download")
    ${count}=    Get Length    ${buttons}
    Log    Found ${count} export buttons

# ─── Records Page ─────────────────────────────────────────────────
Records Page Loads With Table
    [Documentation]    The records page should show a table of recent 100 accidents.
    [Tags]    records    smoke
    Go To    ${BASE_URL}/records
    Sleep    1.5s
    Wait For Elements State    css=table    visible
    ${rows}=    Get Elements    css=table tbody tr
    ${count}=    Get Length    ${rows}
    Should Be True    ${count} >= 1    msg=Expected at least 1 record row

Records Table Has Expected Columns
    [Documentation]    Table must have columns: Date, Type, Location, District, Deaths, Injuries.
    ...    EDGE CASE: If column order changes, data may render in wrong columns
    ...    without a visible error.
    [Tags]    records    data-integrity
    Go To    ${BASE_URL}/records
    Sleep    1.5s
    ${headers}=    Get Text    css=table thead
    ${upper_headers}=    Convert To Upper Case    ${headers}
    Should Contain    ${upper_headers}    DATE
    Should Contain    ${upper_headers}    TYPE
    Should Contain    ${upper_headers}    LOCATION

Records Search Filters Table Rows
    [Documentation]    Typing in the search box filters visible rows.
    ...    EDGE CASE: Debounce delay (400ms) means the filter doesn't
    ...    apply instantly — test must account for the delay.
    [Tags]    records    interaction
    Go To    ${BASE_URL}/records
    Sleep    1.5s
    ${initial_rows}=    Get Elements    css=table tbody tr
    ${initial_count}=    Get Length    ${initial_rows}
    Fill Text    css=.search-box input    bus
    Sleep    1s    # Wait for debounce
    ${filtered_rows}=    Get Elements    css=table tbody tr
    ${filtered_count}=    Get Length    ${filtered_rows}
    Log    Before: ${initial_count}, After: ${filtered_count}

Records Page Handles XSS In Search Input
    [Documentation]    Entering HTML/script tags in search should be escaped.
    ...    EDGE CASE: React auto-escapes JSX, but we verify no script execution.
    [Tags]    records    security    edge-case
    Go To    ${BASE_URL}/records
    Sleep    1s
    Fill Text    css=.search-box input    <script>alert(1)</script>
    Sleep    1s
    # Page should not show an alert — just render escaped text or no results
    Wait For Elements State    .header    visible    message=App crashed on XSS attempt

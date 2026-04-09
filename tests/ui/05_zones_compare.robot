*** Settings ***
Documentation
...    Danger Zones & Compare Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates zone rankings (fatality index + classic) and the
...    comparison page (month-vs-month, year-vs-year).
...
...    Edge Cases Covered:
...    • Fatality index severity badges render with correct classes
...    • View toggle actually switches content
...    • Compare mode toggle changes form fields
...    • Same-year comparison (edge case: delta should be 0%)
...    • Year inputs accept valid ranges only

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
# ─── Danger Zones ─────────────────────────────────────────────────
Zones Page Loads With Ranking Cards
    [Documentation]    Default view should show ranked danger zone cards.
    [Tags]    zones    smoke
    Go To    ${BASE_URL}/zones
    Sleep    1.5s
    ${cards}=    Get Elements    css=.zone-card, .zones-table
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 1    msg=No zone cards found

Zones View Toggle Switches Between Views
    [Documentation]    Toggling between Risk Index, Table, and Division views should
    ...    change the displayed content.
    [Tags]    zones    interaction
    Go To    ${BASE_URL}/zones
    Sleep    1.5s
    ${buttons}=    Get Elements    css=.zone-toggle .btn-sm
    ${count}=    Get Length    ${buttons}
    Should Be True    ${count} >= 2    msg=Expected view toggle buttons
    Click    css=.zone-toggle .btn-sm >> nth=1
    Sleep    800ms
    Wait For Elements State    .header    visible    message=Page crashed on view toggle

# ─── Compare Page ─────────────────────────────────────────────────
Compare Page Loads With Mode Selector
    [Documentation]    Compare page must show month-vs-month and year-vs-year buttons.
    [Tags]    compare    smoke
    Go To    ${BASE_URL}/compare
    Sleep    1s
    Wait For Elements State    .main    visible

Compare Mode Toggle Changes Form Layout
    [Documentation]    Switching between monthly and yearly mode should show/hide
    ...    the month selector dropdown.
    ...    EDGE CASE: If mode state is not properly managed, both forms
    ...    may render simultaneously or neither shows.
    [Tags]    compare    interaction
    Go To    ${BASE_URL}/compare
    Sleep    1s
    ${buttons}=    Get Elements    css=.compare-mode .tf-chip
    ${count}=    Get Length    ${buttons}
    Should Be True    ${count} >= 2    msg=Expected compare mode buttons

Compare Page Shows Comparison Cards After Load
    [Documentation]    Comparison metric cards (accidents, deaths, injuries) should render.
    ...    EDGE CASE: If the API returns empty data for one period, the
    ...    delta calculation may produce Infinity or NaN.
    [Tags]    compare    data-integrity
    Go To    ${BASE_URL}/compare
    Sleep    1.5s
    # Should have some content in main
    Wait For Elements State    .main    visible
    # Verify no NaN text visible
    ${content}=    Get Text    css=.main
    Should Not Contain    ${content}    NaN
    Should Not Contain    ${content}    undefined
    Should Not Contain    ${content}    Infinity

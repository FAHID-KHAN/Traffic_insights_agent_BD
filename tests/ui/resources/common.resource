*** Settings ***
Library    Browser
Library    String
Library    Collections

*** Variables ***
${BASE_URL}           http://localhost:8000
${BROWSER}            chromium
${TIMEOUT}            15s

*** Keywords ***
Open Traffic Insight BD
    [Documentation]    Launch browser and navigate to the app
    New Browser    ${BROWSER}    headless=true
    New Context    viewport={'width': 1280, 'height': 900}
    New Page    ${BASE_URL}
    Set Browser Timeout    ${TIMEOUT}
    Wait For Elements State    .header    visible

Navigate To Page
    [Documentation]    Click a nav tab and wait for page to load
    [Arguments]    ${tab_text}
    Click    css=.nav-tab >> text="${tab_text}"
    Sleep    500ms

Get Stat Card Value
    [Documentation]    Extract the numeric value from a stat card by label text
    [Arguments]    ${label}
    ${value}=    Get Text    css=.stat-card:has(.stat-label:text("${label}")) .stat-value
    RETURN    ${value}

Page Should Have No Console Errors
    [Documentation]    Verify no JS errors in browser console
    ${logs}=    Get Console Log    level=error
    ${length}=    Get Length    ${logs}
    Should Be Equal As Numbers    ${length}    0    msg=Found ${length} console error(s)

Close Everything
    [Documentation]    Clean teardown
    Close Browser

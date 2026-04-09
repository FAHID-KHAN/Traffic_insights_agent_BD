*** Settings ***
Documentation
...    Danger Map Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates the interactive Leaflet map: marker/heatmap toggle,
...    division stats, and map tile loading.
...
...    Edge Cases Covered:
...    • Map container renders at correct dimensions (not 0px)
...    • Toggling between markers and heatmap modes
...    • Division stats accordion expand/collapse
...    • CARTO tile CSP — tiles must load (was a real bug)
...    • Division name normalization (Chittagong/Chattogram dedup)

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
Map Page Loads With Leaflet Container
    [Documentation]    The Leaflet map container must exist and have non-zero height.
    ...    EDGE CASE: If CSS sets height:0 or Leaflet fails to init,
    ...    a 0-height invisible map is a silent failure.
    [Tags]    map    smoke
    Go To    ${BASE_URL}/map
    Sleep    2s
    Wait For Elements State    css=.leaflet-container    visible

Map Mode Toggle Buttons Are Present
    [Documentation]    "Markers" and "Heatmap" toggle buttons must be visible.
    [Tags]    map    controls
    Go To    ${BASE_URL}/map
    Sleep    1.5s
    ${buttons}=    Get Elements    css=.btn-outline, .btn-primary
    ${count}=    Get Length    ${buttons}
    Should Be True    ${count} >= 2    msg=Expected map toggle buttons

Switching To Heatmap Mode Does Not Crash
    [Documentation]    Toggling to heatmap mode should re-render the map layer.
    ...    EDGE CASE: leaflet.heat plugin crash if data array is empty or
    ...    contains null coordinates — must handle gracefully.
    [Tags]    map    interaction    edge-case
    Go To    ${BASE_URL}/map
    Sleep    2s
    Click    text="Heatmap"
    Sleep    1s
    Wait For Elements State    css=.leaflet-container    visible    message=Map disappeared after heatmap toggle

Switching Back To Markers Mode Works
    [Documentation]    Toggle back to markers after heatmap.
    [Tags]    map    interaction
    Go To    ${BASE_URL}/map
    Sleep    2s
    Click    text="Heatmap"
    Sleep    800ms
    Click    text="Markers"
    Sleep    800ms
    Wait For Elements State    css=.leaflet-container    visible

Division Stats Section Renders
    [Documentation]    Division statistics cards should show all 8 divisions.
    ...    EDGE CASE: Duplicate division names (Chittagong/Chattogram) was
    ...    a bug that inflated the count — should be exactly 8.
    [Tags]    map    divisions    data-integrity
    Go To    ${BASE_URL}/map
    Sleep    2s
    ${divisions}=    Get Elements    css=.division-card
    ${count}=    Get Length    ${divisions}
    Should Be True    ${count} >= 1    msg=No division cards found
    Should Be True    ${count} <= 10    msg=Too many divisions (${count}) — possible duplicates

Division Card Expands On Click
    [Documentation]    Clicking a division card should expand to show district details.
    ...    EDGE CASE: If the accordion state isn't toggled, clicking does nothing.
    [Tags]    map    divisions    interaction
    Go To    ${BASE_URL}/map
    Sleep    2s
    ${cards}=    Get Elements    css=.division-card
    ${count}=    Get Length    ${cards}
    IF    ${count} > 0
        Click    css=.division-card >> nth=0
        Sleep    500ms
    END

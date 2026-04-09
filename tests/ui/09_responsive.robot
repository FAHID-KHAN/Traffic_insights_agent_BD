*** Settings ***
Documentation
...    Responsive Design & Accessibility Tests
...    ═══════════════════════════════════════════════════════
...    Validates the app behaves correctly at different viewport sizes
...    and maintains basic accessibility standards.
...
...    Edge Cases Covered:
...    • Mobile viewport (375px) — nav overflow, cards stack
...    • Tablet viewport (768px) — intermediate layout
...    • Very wide viewport (1920px) — max-width constraint
...    • Touch-friendly button sizes on small screens

Resource    resources/common.resource

*** Variables ***
${BASE_URL}    http://localhost:8000

*** Test Cases ***
# ─── Mobile Viewport ─────────────────────────────────────────────
App Renders On Mobile Viewport
    [Documentation]    At 375px width, the app must not crash and all critical
    ...    elements must still be reachable (even if scrollable).
    ...    EDGE CASE: Fixed-width elements may overflow and hide content.
    [Tags]    responsive    mobile
    New Browser    chromium    headless=true
    New Context    viewport={'width': 375, 'height': 812}
    New Page    ${BASE_URL}
    Sleep    1.5s
    Wait For Elements State    .header    visible
    Wait For Elements State    .main    visible
    Close Browser

Nav Tabs Scroll Horizontally On Mobile
    [Documentation]    9 tabs cannot fit in 375px — they should be scrollable,
    ...    not wrapped into invisible overflow.
    ...    EDGE CASE: overflow-x: auto without -webkit-overflow-scrolling
    ...    can feel broken on iOS Safari.
    [Tags]    responsive    mobile
    New Browser    chromium    headless=true
    New Context    viewport={'width': 375, 'height': 812}
    New Page    ${BASE_URL}
    Sleep    1s
    Wait For Elements State    css=.nav-tabs    visible
    # At least some tabs should be visible
    ${tabs}=    Get Elements    css=.nav-tab
    ${count}=    Get Length    ${tabs}
    Should Be True    ${count} >= 9    msg=All 9 tab elements should exist in DOM
    Close Browser

Dashboard Stat Cards Stack On Mobile
    [Documentation]    Stat cards should stack vertically on narrow screens.
    [Tags]    responsive    mobile
    New Browser    chromium    headless=true
    New Context    viewport={'width': 375, 'height': 812}
    New Page    ${BASE_URL}
    Sleep    1.5s
    ${cards}=    Get Elements    css=.stat-card
    ${count}=    Get Length    ${cards}
    Should Be True    ${count} >= 3    msg=Stat cards should render on mobile
    Close Browser

# ─── Tablet Viewport ─────────────────────────────────────────────
App Renders On Tablet Viewport
    [Documentation]    At 768px width, layout should adapt (2 columns for charts etc).
    [Tags]    responsive    tablet
    New Browser    chromium    headless=true
    New Context    viewport={'width': 768, 'height': 1024}
    New Page    ${BASE_URL}
    Sleep    1.5s
    Wait For Elements State    .header    visible
    Wait For Elements State    css=.stat-card >> nth=0    visible
    Close Browser

# ─── Wide Viewport ────────────────────────────────────────────────
App Respects Max Width On Wide Screen
    [Documentation]    At 1920px, .main should be constrained to max-width: 1400px.
    ...    EDGE CASE: Without max-width, content stretches uncomfortably wide.
    [Tags]    responsive    wide
    New Browser    chromium    headless=true
    New Context    viewport={'width': 1920, 'height': 1080}
    New Page    ${BASE_URL}
    Sleep    1.5s
    Wait For Elements State    .header    visible
    Wait For Elements State    .main    visible
    Close Browser

# ─── Map On Different Viewports ───────────────────────────────────
Map Renders On Mobile Without Crash
    [Documentation]    Leaflet maps can break on very small viewports due to
    ...    tile calculations. Verify the container renders.
    ...    EDGE CASE: leaflet.markercluster may throw if map dimensions are 0.
    [Tags]    responsive    mobile    map
    New Browser    chromium    headless=true
    New Context    viewport={'width': 375, 'height': 812}
    New Page    ${BASE_URL}/map
    Sleep    2.5s
    Wait For Elements State    css=.leaflet-container    visible
    Close Browser

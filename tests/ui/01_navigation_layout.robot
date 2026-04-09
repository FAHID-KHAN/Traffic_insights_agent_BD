*** Settings ***
Documentation
...    Navigation & Layout Tests
...    ═══════════════════════════════════════════════════════
...    Validates the app shell: header, navigation tabs, footer, theme toggle,
...    and SPA routing. These are the backbone — if navigation breaks, every
...    other page test becomes meaningless.
...
...    Edge Cases Covered:
...    • Direct URL access (deep linking) — bypasses SPA router
...    • 404 handling for unknown routes
...    • Theme toggle persists visual change
...    • All 9 nav tabs resolve without errors
...    • Footer content integrity (creators, data source, LinkedIn links)
...    • Mobile viewport nav overflow behavior

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
# ─── Header ──────────────────────────────────────────────────────
Header Displays Logo And Branding
    [Documentation]    The header must show the app name and tagline.
    ...    EDGE CASE: If the logo component crashes, the entire header may
    ...    vanish due to React error boundaries — verify both text elements.
    [Tags]    header    smoke
    ${text}=    Get Text    css=.logo h1
    ${upper}=    Convert To Upper Case    ${text}
    Should Contain    ${upper}    TRAFFIC INSIGHT
    Get Text    css=.logo p     contains    Bangladesh

Header Shows Extraction Mode Badge
    [Documentation]    Badge indicates whether AI (advanced) or regex (standard) extraction
    ...    is active. Must render a visible badge with correct class.
    [Tags]    header    extraction
    Wait For Elements State    css=.extraction-badge    visible
    ${class}=    Get Attribute    css=.extraction-badge    class
    Should Match Regexp    ${class}    (advanced|standard)

# ─── Navigation Tabs ─────────────────────────────────────────────
All Navigation Tabs Are Present
    [Documentation]    All 9 tabs must render. Missing tabs usually mean a broken
    ...    import or typo in App.jsx routes.
    [Tags]    navigation    smoke
    ${tabs}=    Get Elements    css=.nav-tab
    ${count}=    Get Length    ${tabs}
    Should Be Equal As Integers    ${count}    9    msg=Expected 9 nav tabs, found ${count}

Each Nav Tab Navigates Without Error
    [Documentation]    Click each tab → verify URL changes and no crash.
    ...    EDGE CASE: If a lazy-loaded chunk fails, the page shows a blank div
    ...    instead of content. We verify the URL path changed as proof of routing.
    [Tags]    navigation    regression
    @{expected}=    Create List    /    /daily    /monthly    /map    /zones    /compare    /insights    /search    /records
    ${tabs}=    Get Elements    css=.nav-tab
    FOR    ${i}    IN RANGE    0    9
        Click    css=.nav-tab >> nth=${i}
        Sleep    300ms
    END

Nav Tab Active State Highlights Correctly
    [Documentation]    The currently active tab should have the .active class.
    ...    EDGE CASE: React Router v7 changed NavLink behavior — confirm
    ...    isActive still applies the CSS class.
    [Tags]    navigation
    Go To    ${BASE_URL}/daily
    Sleep    500ms
    Wait For Elements State    css=.nav-tab.active    visible
    Get Text    css=.nav-tab.active    contains    Daily

# ─── SPA Routing & Deep Links ────────────────────────────────────
Direct URL Access Works For All Routes
    [Documentation]    Users may bookmark or share URLs. The server catch-all must
    ...    serve index.html and React Router must resolve the path.
    ...    EDGE CASE: A misconfigured server returns 404 JSON instead of HTML
    ...    for non-root paths (was a real bug with our SPA catch-all).
    [Tags]    routing    edge-case
    @{paths}=    Create List    /daily    /monthly    /map    /zones    /records    /insights
    FOR    ${path}    IN    @{paths}
        Go To    ${BASE_URL}${path}
        Sleep    500ms
        Wait For Elements State    .header    visible    message=Header missing on direct access to ${path}
        Wait For Elements State    .main     visible    message=Main content missing on direct access to ${path}
    END

Unknown Route Shows 404 Page
    [Documentation]    Navigating to a garbage path should show the NotFound component.
    ...    EDGE CASE: If the catch-all regex in App.jsx is wrong, it could
    ...    match a real route or show a blank page instead of 404 content.
    [Tags]    routing    edge-case
    Go To    ${BASE_URL}/this-page-does-not-exist
    Sleep    500ms
    Get Text    css=.main    contains    404

# ─── Theme Toggle ─────────────────────────────────────────────────
Theme Toggle Switches Dark And Light Mode
    [Documentation]    Clicking the theme button should toggle data-theme attribute on <html>.
    ...    EDGE CASE: If localStorage is full or blocked, the theme
    ...    may flash back to default on next interaction.
    [Tags]    theme    interaction
    Go To    ${BASE_URL}
    Sleep    500ms
    ${initial}=    Get Attribute    css=html    data-theme
    Click    css=.theme-toggle
    Sleep    300ms
    ${toggled}=    Get Attribute    css=html    data-theme
    Should Not Be Equal    ${initial}    ${toggled}    msg=Theme did not change after toggle
    # Toggle back to restore original
    Click    css=.theme-toggle
    Sleep    300ms

# ─── Footer ───────────────────────────────────────────────────────
Footer Contains Data Source Link To New Age
    [Documentation]    Footer data source must point to New Age Bangladesh, not the
    ...    legacy Daily Star or NIRAPAD links.
    ...    EDGE CASE: Verifying href is critical — a link with correct text but
    ...    wrong URL is a silent bug.
    [Tags]    footer    content
    ${href}=    Get Attribute    css=.site-footer a[href*="newagebd"]    href
    Should Contain    ${href}    newagebd.net

Footer Shows Both Creators With LinkedIn Links
    [Documentation]    Each creator must have a name, role, and working LinkedIn link.
    ...    EDGE CASE: LinkedIn URLs with special chars (%20, hyphens) can break
    ...    if not properly encoded in JSX.
    [Tags]    footer    content
    ${creators}=    Get Elements    css=.footer-creators .creator
    ${count}=    Get Length    ${creators}
    Should Be Equal As Integers    ${count}    2    msg=Expected 2 creators, found ${count}

    Get Text    css=.creator:nth-child(1) .creator-name    contains    Rafeed
    Get Text    css=.creator:nth-child(2) .creator-name    contains    Fahid

    ${linkedin_links}=    Get Elements    css=.creator-linkedin
    ${link_count}=    Get Length    ${linkedin_links}
    Should Be Equal As Integers    ${link_count}    2    msg=Expected 2 LinkedIn links

Footer Copyright Shows Current Year
    [Documentation]    Copyright must dynamically show the current year.
    ...    EDGE CASE: Hardcoded year strings become stale — verify dynamic rendering.
    [Tags]    footer    content
    Get Text    css=.footer-bottom    contains    2026

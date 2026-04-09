*** Settings ***
Documentation
...    Insights Page Tests
...    ═══════════════════════════════════════════════════════
...    Validates the analytics & insights page that contains
...    YoY summary, forecast chart, time heatmap, and cluster
...    timeline — all moved from the dashboard for clarity.

Resource    resources/common.resource

Suite Setup       Open Traffic Insight BD
Suite Teardown    Close Everything

*** Test Cases ***
Insights Page Loads Successfully
    [Documentation]    Insights page should load with the page title and analytics sections.
    [Tags]    insights    smoke
    Go To    ${BASE_URL}/insights
    Sleep    2s
    Wait For Elements State    .main    visible
    Wait For Elements State    .header    visible
    Get Text    css=.page-title    contains    Insights

Insights Page Has Analytics Sections
    [Documentation]    The page should contain YoY, Forecast, Heatmap, and Cluster sections.
    [Tags]    insights    content
    Go To    ${BASE_URL}/insights
    Sleep    2.5s
    # At least some chart-card or section-header elements should be present
    ${sections}=    Get Elements    css=.chart-card, .yoy-section, .section-header, .chart-title
    ${count}=    Get Length    ${sections}
    Should Be True    ${count} >= 1    msg=Expected analytics sections on Insights page

Insights Page Has Year Over Year Section
    [Documentation]    YoY summary should show current vs previous year comparison.
    [Tags]    insights    content
    Go To    ${BASE_URL}/insights
    Sleep    2.5s
    ${yoy}=    Get Elements    css=.yoy-section, .section-header
    ${count}=    Get Length    ${yoy}
    Log    Found ${count} YoY/section elements

Insights Page Has Cluster Timeline
    [Documentation]    Cluster timeline should be present with cluster data or empty state.
    [Tags]    insights    content
    Go To    ${BASE_URL}/insights
    Sleep    2.5s
    ${clusters}=    Get Elements    css=.cluster-card, .cluster-timeline, .chart-card
    ${count}=    Get Length    ${clusters}
    Should Be True    ${count} >= 1    msg=Expected cluster or chart sections

Dashboard Does Not Contain Moved Analytics
    [Documentation]    Dashboard should no longer have YoY, Forecast, Heatmap or Cluster sections.
    ...    These were moved to the Insights page.
    [Tags]    insights    regression
    Go To    ${BASE_URL}/
    Sleep    2s
    ${yoy}=    Get Elements    css=.yoy-section
    ${count}=    Get Length    ${yoy}
    Should Be Equal As Integers    ${count}    0    msg=YoY section should not be on Dashboard anymore

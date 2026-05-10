Feature: Dashboard – Region Filter
  As a user reviewing the dashboard
  I want to filter data by region
  So that I see only the sales for that market

  Background:
    Given the data engine is initialized

  Scenario: West filter returns only West sales
    When I ask "sales by region in West"
    Then the chart type is "bar"
    And the first row label is "West"
    And the first row value is close to 2160

  Scenario: Central filter returns only Central sales
    When I ask "sales in Central"
    Then the chart type is "kpi"
    And the first row value is close to 1180

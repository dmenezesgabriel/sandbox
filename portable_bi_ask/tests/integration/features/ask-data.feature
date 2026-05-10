Feature: Ask Data – Natural Language Queries
  As a user without SQL knowledge
  I want to ask data questions in plain English
  So that I can explore my data and get instant answers

  Background:
    Given the data engine is initialized

  Scenario: Simple metric grouped by dimension
    When I ask "sales by region"
    Then the chart type is "bar"
    And the interpretation contains "Region"
    And there are 4 result rows
    And the first row label is "West"

  Scenario: Sales total as a single KPI
    When I ask "total sales"
    Then the chart type is "kpi"
    And the first row value is close to 5760

  Scenario: Date-filtered query returns a yearly aggregate
    When I ask "sales in 2017"
    Then the chart type is "kpi"
    And the first row value is close to 2950

  Scenario: Top-N ranking limits the result set
    When I ask "top 3 products by sales"
    Then there are 3 result rows
    And the result rows are sorted descending by value

  Scenario: List of distinct dimension values
    When I ask "what categories do i have"
    Then the chart type is "table"
    And the result contains the label "Technology"
    And the result contains the label "Furniture"
    And the result contains the label "Office Supplies"

  Scenario: Comparison between two dimension values
    When I ask "compare sales in West vs East"
    Then there are 2 result rows
    And the first row label is "West"

  Scenario: Share analysis includes a share column
    When I ask "share of sales by category"
    Then the interpretation contains "Share"
    And the first result row has a "share" column with a value between 0 and 1

  Scenario: Unsupported metric returns a descriptive error
    When I ask "lucro por região"
    Then the result is an error
    And the error message contains "lucro"

  Scenario: Portuguese query resolves the same as English
    When I ask "vendas por região"
    Then the chart type is "bar"
    And the interpretation contains "Region"
    And the first row label is "West"

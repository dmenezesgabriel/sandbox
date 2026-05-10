Feature: Engine Metadata
  As a developer
  I want the engine to correctly catalog fields and report metadata
  So that queries are built against accurate schema information

  Background:
    Given the data engine is initialized

  Scenario: Catalog contains all fields from the test tables
    Then the catalog should have at least 8 fields

  Scenario: Sales is identified as a measure field
    Then the field "sales::Sales" should have role "measure"

  Scenario: Order Date is identified as a time field
    Then the field "sales::Order Date" should have role "time"

  Scenario: Region is a dimension with sample values
    Then the field "customer::Region" should have role "dimension"
    And the field "customer::Region" should have sample values including "West"

  Scenario: Confidence score is reported for successful queries
    When I ask "sales by region"
    Then the confidence should be between 0 and 1

  Scenario: Engine reuses cached catalog on subsequent calls
    When I ask "sales by region" twice
    Then the catalog build time should be unchanged

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
    Given I remember the current catalog build count
    And I remember the current catalog instance
    When I ask "sales by region" twice
    Then the catalog build count should be unchanged
    And the catalog instance should be unchanged

  Scenario: Engine rebuilds catalog after data changes
    Given I remember the current catalog build count
    When I add customer region "Northwest" to the test data
    And I refresh the data engine catalog
    Then the catalog build count should increase by 1
    And the field "customer::Region" should have sample values including "Northwest"

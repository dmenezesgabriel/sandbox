Feature: Datasource editor

  Background:
    Given the app is loaded

  Scenario: View an existing datasource
    When I navigate to "#/datasource/superstore-sales"
    Then the page heading should contain "sales"
    And the breadcrumb should contain "Datasources"
    And the name field should contain "sales"
    And the URL field should not be empty
    And the source type should be "CSV"

  Scenario: Read-only YAML-sourced datasource
    When I navigate to "#/datasource/superstore-sales"
    Then the name field should be disabled
    And the URL field should be disabled
    And the Save button should not be present

  Scenario: Create new datasource
    When I navigate to "#/datasource/new"
    Then the page heading should contain "Untitled Datasource"
    And the name field should be empty
    And the URL field should be empty
    When I fill in the name "New Test DS"
    And I fill in the URL "https://example.com/test.csv"
    And I click "Create"
    Then I should be on the datasource editor page for "new-test-ds"
    And the datasource "new-test-ds" should exist in the registry

  Scenario: Save an updated datasource
    Given a user datasource "editable-ds" with URL "https://example.com/old.csv" exists
    When I navigate to its datasource editor page
    And I update the URL to "https://example.com/new.csv"
    And I click "Save"
    Then the datasource "editable-ds" should have URL "https://example.com/new.csv"

  Scenario: Export YAML
    When I navigate to "#/datasource/superstore-sales"
    And I click "Export YAML"
    Then a YAML file should be downloaded

  Scenario: Not found datasource shows error
    When I navigate to "#/datasource/does-not-exist"
    Then the page should show "Datasource not found"

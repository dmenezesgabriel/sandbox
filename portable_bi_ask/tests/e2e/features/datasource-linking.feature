Feature: Linking datasources to questions

  Background:
    Given the app is loaded

  Scenario: Seed question shows linked datasource names
    When I navigate to "#/question/sales-by-region"
    Then the question editor should show "Linked datasources" section
    And the linked datasources should include "sales"

  Scenario: Link a datasource to a new question
    When I navigate to "#/questions"
    And I click "New Question"
    And I enter the question name "DS Link Test"
    And I click "Create"
    Then I should be on a question editor page
    When I click "Manage datasources"
    Then the datasource picker should be visible
    And the picker should list "sales"
    When I select "sales" in the picker
    And I confirm the picker selection
    Then "sales" should appear in the linked datasources list

  Scenario: Create new datasource link from question editor
    When I navigate to "#/question/sales-by-region"
    Then the question editor should show a "+ Create new datasource" link
    When I click "+ Create new datasource"
    Then I should be on the new datasource editor page

  Scenario: Auto-promote embedded datasources on load
    Given the localStorage contains a question with embedded dataSources for "https://example.com/legacy.csv"
    When I reload the app
    Then the datasource "https://example.com/legacy.csv" should appear in the datasources list
    And the legacy question should have dataSourceSlugs referencing that datasource

  Scenario: Preview runs with linked datasource
    When I navigate to "#/question/sales-by-region"
    Then the question editor should show "sales" in linked datasources
    When I click "Run preview"
    Then the preview panel should show data rows

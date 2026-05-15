Feature: Questions — CRUD

  Background:
    Given the app is loaded

  Scenario: Create a question and delete it from the collection page
    When I navigate to "#/questions"
    And I click "New Question"
    And I enter the question name "Delete Me"
    And I click "Create"
    Then I should be on a question editor page
    When I navigate to "#/questions"
    Then I should see "Delete Me" in the question list
    When I delete the question "Delete Me" from the list
    Then I should not see "Delete Me" in the question list

  Scenario: Delete a question from the editor page
    Given a user question "My Temp Question" exists
    When I navigate to "#/questions"
    And I navigate to its question editor page
    And I click Delete in the question editor header
    Then I should be on the questions collection page
    And I should not see "My Temp Question" in the question list

  Scenario: YAML-seeded questions cannot be deleted
    When I navigate to "#/questions"
    Then the question "Sales by Region" should not have a delete button
    When I navigate to "#/question/sales-by-region"
    Then the question editor header should not show a Delete button

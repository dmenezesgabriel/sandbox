Feature: Datasource collection page

  Background:
    Given the app is loaded

  Scenario: View seeded datasources
    When I navigate to "#/datasources"
    Then the page heading should contain "Datasources"
    And I should see at least 3 datasources in the list
    And the datasource list should contain "sales"
    And the datasource list should contain "customer"
    And the datasource list should contain "product"

  Scenario: Seed datasources are read-only
    When I navigate to "#/datasources"
    Then the datasource "sales" should show "read-only" badge
    And the datasource "sales" should not have a delete button

  Scenario: Create a new datasource
    When I navigate to "#/datasources"
    And I click "New Datasource"
    And I enter the datasource name "Test Collection DS"
    And I click "Create"
    Then I should be on a datasource editor page
    When I navigate to "#/datasources"
    Then the datasource list should contain "Test Collection DS"

  Scenario: Delete a user-created datasource
    Given a user datasource "Temp DS" exists
    When I navigate to "#/datasources"
    Then the datasource list should contain "Temp DS"
    When I delete the datasource "Temp DS" from the list
    Then the datasource list should not contain "Temp DS"
    And I should still see the seed datasources

  Scenario: Datasources nav link is present
    When I navigate to "#/"
    Then the top navigation should have a "Datasources" link
    When I click the "Datasources" nav link
    Then I should be on the datasources collection page

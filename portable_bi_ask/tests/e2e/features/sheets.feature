Feature: Sheets – Dashboard Builder Workspace
  As a BI analyst using the dashboard builder
  I want the Dashboard tab to show the config-driven dashboard and support drag-and-drop editing
  So that charts only re-render when data actually changes and widgets are only selectable when editing

  Background:
    Given the app is loaded
    And I navigate to the Dashboard tab

  Scenario: Dashboard tab shows the default dashboard from YAML config
    Then I should see widgets rendered on the canvas

  Scenario: Injecting a sheet with chart widgets renders the widgets
    Given a sheet exists with chart widgets
    Then I should see widgets rendered on the canvas
    And the chart widgets should initialize without errors

  Scenario: Clicking a chart widget in view mode does not select it
    Given a sheet exists with chart widgets
    When I click on a widget content area
    Then the widget should not be selected
    And the chart should not re-initialize

  Scenario: Clicking a chart widget in edit mode selects it
    Given a sheet exists with chart widgets
    When I click "Edit" to enter edit mode
    And I click on a widget content area
    Then the widget should be selected

  Scenario: Exiting edit mode deselects all widgets
    Given I am in edit mode with a selected widget
    When I click "Done Editing" to exit edit mode
    Then no widget should be selected

  Scenario: Switching between sheets uses data cache (no re-query)
    Given sheets exist with chart widgets on multiple sheets
    When I switch to the second sheet
    Then the ask engine should have called 1 time
    When I switch back to the first sheet
    Then the ask engine should have called 1 time

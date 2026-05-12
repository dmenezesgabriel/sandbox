# UI component directly instantiates infrastructure and creates SQL views

Priority: High

Category: Dependency Direction | Ports and Adapters

## Issue

`DashboardEditor` (dashboard-editor.ts:58-81) directly imports `AskDataEngine` and `duckDBManager`, creates SQL views via `duckDBManager.query()` with raw SQL strings, and manages the data loading lifecycle. The UI component knows about CSV URLs, SQL view creation syntax, and database connection details.

## Evidence

- `dashboard-editor.ts:9-11`: `import { AskDataEngine } from '../../ask-data'` and `import { duckDBManager } from '../../db'`
- `dashboard-editor.ts:63-75`: Direct SQL view creation with `escapeSqlString` and `quoteIdent` — infrastructure concerns in a UI component
- `dashboard-editor.ts:18`: `import { escapeSqlString, quoteIdent } from '../../utils'` — SQL utilities imported into a Lit component

## Design impact

The UI cannot be tested without DuckDB. The component mixes rendering logic with data orchestration and SQL string construction. If the database technology changes, the UI component must change. The component has three reasons to change: UI layout, data orchestration flow, and infrastructure details.

## Recommendation

Extract a `DataService` or `AskOrchestrator` class that handles engine creation, view setup, and question execution. The `DashboardEditor` should only call `orchestrator.ask(question)` and `orchestrator.initialize()`. SQL view creation should live behind a port/repository abstraction.

## Target shape

```
DashboardEditor → AskOrchestrator (UI calls application layer)
AskOrchestrator → AskDataEngine, DataSourceManager (application layer handles orchestration)
DataSourceManager → DuckDBManager (infrastructure behind port)
```

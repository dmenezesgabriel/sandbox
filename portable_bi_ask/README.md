# Portable BI

Portable BI is a Vite-powered browser BI application built with Lit, DuckDB-WASM, Chart.js, Fuse/MiniSearch, Chrono, and optional Transformers.js semantic field matching.

## Architecture

The app was split from a self-contained `index.html` into a flat, modular structure:

- `index.html` - HTML shell that loads the Vite entrypoint.
- `src/main.js` - app entrypoint and global stylesheet import.
- `src/styles.css` - shared application styles.
- `src/config.js` - dashboard and Ask Data semantic configuration.
- `src/db.js` - DuckDB-WASM adapter/manager.
- `src/utils.js` - formatting, SQL escaping, date, and normalization helpers.
- `src/resultAnalysis.js` - result shape analysis, chart decision, confidence, validation, and insights.
- `src/askData.js` - Ask Data engine, parser, field/value resolution, SQL planning, cataloging, and semantic matching strategies.
- `src/dataLoader.js` - dashboard data loading, filter application, KPI/chart/table queries.
- `src/components/PortableBiDashboard.js` - Lit component responsible for UI rendering and interaction wiring.

The modules keep responsibilities explicit without adding extra framework layers. Core services are exported so behavior can be tested or exercised independently from the UI.

## Scripts

```bash
npm install
npm run dev -- --port 8000
npm run build
npm run preview
```

## Datasets

- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/sales.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/product.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/customer.csv

## Ask Data

The natural-language parser remains deterministic for intent, dates, limits, filters, and SQL planning. Optional client-side semantic field matching is used as a fallback after exact terms and Fuse/MiniSearch matching fail.

Key responsibilities:

- `TermMatcher` - locale-aware vocabulary lookup and safe term patterns.
- `DateRangeParser` - dataset-relative, named-month, Chrono, and explicit-year parsers.
- `IntentCueDetector` - deterministic BI cues such as list, ranking, share, change, and YoY.
- `FieldResolver` - exact, text-search, Fuse, and semantic strategies.
- `SqlPlanner` - SQL generation and join planning.
- `AskDataEngine` - orchestration, diagnostics, confidence, insights, and observable timings.

Configuration lives in `DASHBOARD_CONFIG.askData`.

## Development

1. Explore the codebase
   Understand the existing architecture, conventions, domain behavior, and test structure before changing code.

2. Define behavior first
   When useful, write BDD-style acceptance criteria in Gherkin for user-facing behavior, integration flows, or E2E scenarios.

3. Develop with TDD
   Use the Red → Green → Refactor cycle for core logic and units:
   - Red: write a failing test
   - Green: implement the simplest working solution
   - Refactor: improve design without changing behavior

4. Add or update integration tests
   Verify that modules, services, APIs, databases, and external boundaries work together correctly.

5. Add or update E2E tests
   Cover the most important user journeys only; avoid duplicating lower-level tests.

6. Add regression tests
   For every fixed bug, add a test that would fail if the bug returns.

7. Run mutation tests
   Use mutation testing mainly on critical unit-tested logic to verify that tests detect real behavioral changes.

run checks and fix the existing errors, no workarrounds neither overengineering.

- [Pre-commit](#pre-commit)
- [Tests](#tests)


### Pre-commit

Using correct types instead of `any` or any kind of type ignoring, if needed folow the steps:

1. Detect dependency from package.json / lockfile
2. Read exact installed version
3. Inspect node_modules/<package>/package.json
4. Inspect README / docs / examples inside node_modules
5. Inspect .d.ts types
6. Search source with ripgrep
7. Prefer installed version over latest online docs

### Tests

Run all tests

- Unit
- Integration
- E2E

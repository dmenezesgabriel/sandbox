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

1. BDD: define behavior / acceptance examples
2. TDD: write small failing unit tests
3. Implement code
4. Add/pass integration tests
5. Add/pass a small number of E2E tests
6. Regression tests: prevent old bugs from returning
7. Mutation tests: verify your unit tests are actually strong

# Portable BI

Portable BI is a Vite-powered browser BI application built with Lit, DuckDB-WASM, Chart.js, Fuse/MiniSearch, Chrono, and optional Transformers.js semantic field matching.

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

## May Help

- export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 on ubuntu 26

## References

### **Articles and Resources**

- [Mutation Testing for JavaScript](https://medium.com/@alexbunardzic/mutation-testing-for-javascript-e5e5ef7b5b) — An introduction to improving test suite reliability by intentionally injecting bugs into code to verify if tests catch them.
- [Atomic Design (Table of Contents)](https://atomicdesign.bradfrost.com/table-of-contents/) — The full online version of Brad Frost's methodology for creating scalable design systems using atoms, molecules, organisms, templates, and pages.
- [Headless BI 101: A Comprehensive Guide](https://atlan.com/know/headless-bi-101/) — A deep dive into the architecture of headless business intelligence, focusing on the decoupling of data metrics (semantic layers) from the visualization tools.
- [Storytelling with Data Blog](https://www.storytellingwithdata.com/blog) — A resource for best practices in data visualization and effective communication through analytical storytelling.
- [University of Washington Data Interactive Lab (UW Data Medium)](https://medium.com/@uwdata) — Articles and research insights from the creators of Vega, Vega-Lite, and Jeffrey Heer's data visualization research group.

### **Data Science & Analytics**

- [Descriptive, Predictive, and Prescriptive Analytics Explained](https://business.adobe.com/blog/basics/descriptive-predictive-prescriptive-analytics-explained) — An Adobe Business guide breaking down the three stages of analytics: from understanding what happened to predicting future outcomes and recommending actions.

### **Text-to-SQL & Database Semantics**

- [Automatic Semantic Modeling for Structural Data Source with the Prior Knowledge from Knowledge Base](https://arxiv.org/abs/2212.10915) (Xu et al., 2022) — An arXiv research paper presenting automated machine learning and graph matching techniques to map relational database schemas to public-domain ontologies.
- [HKUSTDial / NL2SQL_Handbook](https://github.com/hkustdial/nl2sql_handbook) — A continuously updated GitHub handbook and paper collection tracking LLM-based Text-to-SQL (NL2SQL) translation methodologies, benchmarks, and data agents.
- [Text-to-SQL Basics and Benefits](https://promethium.ai/guides/text-to-sql-basics-benefits/) — A practical guide explaining how generative AI translates natural language queries into executable SQL commands to democratize data access.

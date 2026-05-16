- Replace hardcoded string blacklists with algorithmic/ML-based approaches. The modules have too many brittle heuristics
- Analytics Engineer Agent: Acts as an AI assistant that can create calculated fields, build visualizations, and answer analytical questions.
- Data Storytelling & Summaries: Automatically generates narratives that describe key patterns, outliers, and trends.
- Semantic Modeling Support: AI assists in mapping data and creating consistent definitions (e.g., defining "Profit" vs. "Revenue").
- Context Retention: The Agent remembers previous questions to support follow-up questions, similar to chat interfaces.
- Transforms complex datasets into clear, narrative insights by automatically generating written explanations of your data
- https://arxiv.org/pdf/2212.10915
- Natural language interface to database (NLIDB)
- Natural Language-to-SQL (NL2SQL)
- https://github.com/hkustdial/nl2sql_handbook
- https://promethium.ai/guides/text-to-sql-basics-benefits/

- pre-commit: lint, format, unit tests
- pre-push: integration, e2e

- dev containers
- https://duckdb.org/docs/current/clients/wasm/instantiation (move to vite instead of jsdeliver)

Browser SPA
├─ window error / unhandledrejection
├─ Web Vitals / performance
├─ route changes
├─ custom element lifecycle markers where useful
├─ user interaction events
└─ frontend logs / breadcrumbs
↓
Grafana Faro Web SDK
↓
Grafana Alloy / Faro receiver / collector
↓
Loki + Tempo + Prometheus/Mimir
↓
Grafana dashboards + alerts

# Portable BI

## Description

This is a self contained portable BI application tha lives in a single `index.html` file and use `importmaps` to load it external dependencies.

The application relies on `duckdb-wasm` to gather datasets from urls like `SELECT * FROM read_csv('https://example.com/dataset.csv')` and on a centralized `json` object configuration so it can be configured to use on any dataset.

## Datasets

- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/sales.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/product.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/customer.csv

## Ask Data semantic matching

The natural-language parser stays deterministic for intent, dates, limits, filters and SQL planning. Optional client-side semantic field matching is only used as a fallback after exact terms and Fuse fuzzy matching fail.

The Ask Data engine is split into small responsibilities:

- `TermMatcher`: locale-aware vocabulary lookup and safe term patterns.
- `DateRangeParser`: chain of dataset-relative, named-month, Chrono and explicit-year parsers.
- `IntentCueDetector`: deterministic BI cues such as list, ranking and YoY.
- `FieldResolver`: chain of exact, Fuse and semantic field match strategies.
- `SemanticFieldMatcher`: optional Transformers.js field matching.

Configuration lives in `DASHBOARD_CONFIG.askData.semanticMatching` and uses Transformers.js v4 via `@huggingface/transformers` with a quantized feature-extraction model by default.

## Docs

- https://duckdb.org/docs/current/clients/wasm/instantiation
- https://lit.dev/docs/components/overview/
- https://lit.dev/docs/templates/overview/
- https://huggingface.co/docs/transformers.js/pipelines

## Implementation examples

sample query:

```sql
SELECT * FROM read_csv('https://example.com')
``


example instantiation:
```html
  <script type="importmap">
    {
      "imports": {
        "@duckdb/duckdb-wasm": "https://esm.sh/@duckdb/duckdb-wasm@1.30.0",
      }
    }
  </script>
  <script type="module">
    import * as duckdb from '@duckdb/duckdb-wasm';

    class DuckDBManager {
      constructor() {
        this.dbInstance = null;
        this.dbConnection = null;
      }

      async initialize() {
        if (this.dbInstance) return this.dbInstance;

        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );
        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        this.dbInstance = db;
        this.dbConnection = await db.connect();
        return db;
      }

      async getConnection() {
        await this.initialize();
        return this.dbConnection;
      }

      async query(sql) {
        const connection = await this.getConnection();
        return connection.query(sql);
      }
    }

    const duckDBManager = new DuckDBManager();
  </script>
  ```

## References

- https://idl.uw.edu/visualization-curriculum/
- https://observablehq.com/@uwdata/data-visualization-curriculum
- https://docs.malloydata.dev/documentation/
- https://idl.uw.edu/mosaic/why-mosaic/
- https://motherduck.com/blog/semantic-layer-duckdb-tutorial/
- https://duckdb.org/2025/06/13/text-analytics
- https://motherduck.com/blog/who-needs-a-semantic-layer-anyway/

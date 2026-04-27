# Portable BI

## Description

This is a self contained portable BI application tha lives in a single `index.html` file and use `importmaps` to load it external dependencies.

The application relies on `duckdb-wasm` to gather datasets from urls like `SELECT * FROM read_csv('https://example.com/dataset.csv')` and on a centralized `json` object configuration so it can be configured to use on any dataset.

## Datasets

- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/sales.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/product.csv
- https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/customer.csv

## Docs

- https://duckdb.org/docs/current/clients/wasm/instantiation
- https://lit.dev/docs/components/overview/
- https://lit.dev/docs/templates/overview/

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

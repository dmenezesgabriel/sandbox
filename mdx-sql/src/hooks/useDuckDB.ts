import { useEffect, useState, useCallback } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

export interface QueryResult {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
}

export interface DuckDBHook {
  db: duckdb.AsyncDuckDB | null;
  isReady: boolean;
  error: string | null;
  executeQuery: (sql: string) => Promise<QueryResult>;
}

export const useDuckDB = (): DuckDBHook => {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initDuckDB = async () => {
      try {
        const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
          mvp: {
            mainModule: duckdb_wasm,
            mainWorker: mvp_worker,
          },
          eh: {
            mainModule: duckdb_wasm_eh,
            mainWorker: eh_worker,
          },
        };

        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const database = new duckdb.AsyncDuckDB(logger, worker);

        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);

        if (mounted) {
          setDb(database);
          setIsReady(true);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize DuckDB"
          );
        }
      }
    };

    initDuckDB();

    return () => {
      mounted = false;
    };
  }, []);

  const executeQuery = useCallback(
    async (sql: string): Promise<QueryResult> => {
      if (!db) {
        throw new Error("DuckDB not initialized");
      }

      try {
        const conn = await db.connect();
        const result = await conn.query(sql);
        await conn.close();

        const columns = result.schema.fields.map((field) => field.name);
        const rows = result
          .toArray()
          .map((row) => columns.map((col) => row[col]));

        return {
          columns,
          rows,
          rowCount: rows.length,
        };
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : "Query execution failed"
        );
      }
    },
    [db]
  );

  return { db, isReady, error, executeQuery };
};

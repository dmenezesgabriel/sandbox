# duckDBManager is a global singleton with no port abstraction

Priority: High

Category: Coupling | Testability | Dependency Direction

## Issue

`DuckDBManager` is exported as a singleton (`duckDBManager`) and imported directly by `DashboardEditor` and used via closures in `CatalogBuilder`. There is no interface or port separating core logic from the database infrastructure. Any class that needs query capability depends directly on the DuckDB WASM module.

## Evidence

- `db.ts:37`: `export const duckDBManager = new DuckDBManager()`
- `dashboard-editor.ts:11`: direct import and usage
- `ask-data.ts:2364-2371`: `CatalogBuilder` receives `duckDBManager` typed as `{ query: (sql: string) => Promise<unknown> }` — an inline structural type rather than a named port

## Design impact

Core logic classes (`CatalogBuilder`, `AskDataEngine`) cannot be tested without a real browser environment and WASM DuckDB. The database dependency cannot be swapped for a test double without monkey-patching the module export.

## Recommendation

Define a `QueryPort` interface: `{ query(sql: string): Promise<unknown> }`. Have `DuckDBManager` implement this. Inject the port through constructors. In tests, provide a mock implementation. Rename the structural type already used in `CatalogBuilder`'s constructor to `QueryPort`.

## Target shape

```typescript
export interface QueryPort {
  query(sql: string): Promise<unknown>;
}
```

All consumers depend on `QueryPort`, not on `DuckDBManager` directly.

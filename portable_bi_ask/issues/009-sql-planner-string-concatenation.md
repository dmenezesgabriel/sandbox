# SqlPlanner generates SQL strings without parameterized queries

Priority: Medium

Category: Encapsulation | Testability

## Issue

`SqlPlanner.plan()` and its helper methods build SQL by interpolating values directly into strings using `escapeSqlString()`. Filter values, table names, and column names are concatenated rather than parameterized.

## Evidence

- `ask-data.ts:1128-1134`: `` return `${expr} = '${escapeSqlString(filter.value)}'` ``
- `ask-data.ts:1218-1219`: `.map((value) => `'${escapeSqlString(value)}'`).join(', ')`
- `ask-data.ts:1267-1289`: diagnostic SQL built entirely through string concatenation

## Design impact

While SQL injection risk is mitigated by `escapeSqlString`, the approach makes testing harder (SQL strings must be asserted character-for-character) and prevents the database driver from optimizing prepared statements. Changing the SQL dialect requires editing string templates throughout `SqlPlanner`.

## Recommendation

Consider generating an intermediate `SqlPlan` AST (select, from, joins, where clauses, group by, order by, limit) and rendering it to SQL in one place. This separates the planning decision from the SQL string and makes testing possible without asserting exact SQL strings. At minimum, extract the SQL rendering into a separate `SqlRenderer` so the planning logic can be tested independently.

## Target shape

```
SqlPlanner.plan() → SqlPlan (AST)
SqlRenderer.render(SqlPlan) → { sql: string, params: unknown[] }
```

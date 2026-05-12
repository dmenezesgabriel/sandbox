# processConfig couples data mutation to YAML parsing

Priority: Low

Category: Responsibility | Encapsulation

## Issue

`processConfig()` (dashboard-registry.ts:13-21) mutates dashboard config by setting `format: 'currency'` on the first KPI and `columnFormats: { Sales: 'currency' }` on the first table. This hardcodes presentation formatting into the dashboard loading path.

## Evidence

- `dashboard-registry.ts:16`: `kpis: raw.kpis.map((kpi, i) => (i === 0 ? { ...kpi, format: 'currency' } : kpi))`
- `dashboard-registry.ts:18`: `i === 0 ? { ...table, columnFormats: { Sales: 'currency' } } : table`

## Design impact

Every dashboard that goes through `processConfig` gets the first KPI formatted as currency regardless of intent. This is demo-specific behavior baked into the registry. If a dashboard has no "Sales" column, the column format is silently ignored, but it's still incorrect coupling.

## Recommendation

Move currency formatting hints into the YAML config itself (the `format` and `columnFormats` fields already exist in `KpiConfig` and `TableConfig`). Remove `processConfig` or make it a no-op identity function.

## Target shape

YAML files specify their own `format: currency` and `columnFormats`. No processing step injects demo-specific formatting.

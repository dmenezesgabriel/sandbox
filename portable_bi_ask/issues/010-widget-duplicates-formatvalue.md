# Widget component duplicates formatValue from utils

Priority: Low

Category: Cohesion | Simplicity

## Issue

`Widget` (widget.ts:11-16) defines its own `FORMATTERS` map with a `currency` formatter that reimplements `formatValue` from `utils.ts:70-76`.

## Evidence

- `widget.ts:12-16`: `FORMATTERS.currency` does `'$' + Math.round(n).toLocaleString()`
- `utils.ts:72`: `formatValue` does `'$' + Math.round(n).toLocaleString()` for `'currency'`

## Design impact

If currency formatting logic changes, it must be updated in two places. The two implementations can drift.

## Recommendation

Import and use `formatValue` from `utils.ts` in the `Widget` component, removing the local `FORMATTERS` map.

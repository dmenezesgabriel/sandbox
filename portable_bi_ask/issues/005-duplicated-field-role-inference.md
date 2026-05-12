# CatalogBuilder duplicates AutoFieldRoleDetector logic

Priority: Medium

Category: Cohesion | Coupling

## Issue

`CatalogBuilder.inferRole()` (ask-data.ts:2140-2146) implements field role inference using `isIdLike`, `isNumericType`, `isDateName` from utils, and hardcoded fallback logic. `AutoFieldRoleDetector.detectRole()` (semantic-modeling.ts:118-146) implements the same inference with additional heuristics (cardinality checking, pattern matching). These two code paths can produce different roles for the same fields.

## Evidence

- `ask-data.ts:2140-2146`: `inferRole` checks override, then date/name, then id, then numeric, then falls back to `dimension`
- `semantic-modeling.ts:118-146`: `detectRole` checks id, then date samples, then type-based numeric/string heuristics with cardinality

## Design impact

The two role inference paths can disagree on field roles, causing inconsistent behavior. Changes to role inference must be made in two places. The simpler `CatalogBuilder.inferRole` will drift from the more thorough `AutoFieldRoleDetector`.

## Recommendation

Unify on a single role detection path. `CatalogBuilder` should delegate to `AutoFieldRoleDetector.detectRole()` or both should call a shared `inferFieldRole()` function. The config override should wrap the detector, not duplicate it.

## Target shape

`CatalogBuilder.buildField()` calls `AutoFieldRoleDetector.detectRole()` (or a shared `inferFieldRole`) for the default, then applies the config override on top.

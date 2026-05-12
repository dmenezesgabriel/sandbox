# ConfidenceScorer requires a buildJoinPlan callback instead of a named port

Priority: Low

Category: Abstraction Quality | Coupling

## Issue

`ConfidenceScorer` (result-analysis.ts:253-336) receives `buildJoinPlan` as a constructor callback typed as `(baseTable: string, neededTables: string[]) => JoinPlanLike`. This is an anonymous function type that shadows the actual `SqlPlanner.buildJoinPlan` method, creating a piecewise interface that's hard to discover and document.

## Evidence

- `result-analysis.ts:271-272`: `buildJoinPlan: (baseTable: string, neededTables: string[]) => JoinPlanLike`

## Design impact

Callers must read `ConfidenceScorer`'s constructor to know what shape of function to provide. The `JoinPlanLike` interface at line 248-251 is defined locally in result-analysis.ts rather than shared, and its `joins` field conflicts with the similar `Relationship[]` type that `SqlPlanner` actually returns.

## Recommendation

Define a `JoinPlanProvider` interface with a `buildJoinPlan` method. Have `SqlPlanner` implement it. This makes the dependency explicit and navigable, ensures TypeScript enforces the contract, and keeps the interface in one discoverable place.

## Target shape

```typescript
export interface JoinPlanProvider {
  buildJoinPlan(baseTable: string, neededTables: string[]): JoinPlanResult;
}
// SqlPlanner implements JoinPlanProvider
```

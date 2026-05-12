# calculateRecentTrend has swapped variable names causing inverted trend detection

Priority: Low

Category: Encapsulation

## Issue

In `NarrativeGenerator.calculateRecentTrend()` (narrative-generator.ts:177-188), the variable names `avgLast` and `avgFirst` are swapped: `avgLast` is computed from `firstThird` and `avgFirst` is computed from `lastThird`.

## Evidence

```typescript
const avgLast = firstThird.reduce((s, r) => s + Number(r.value), 0) / firstThird.length;
const avgFirst = lastThird.reduce((s, r) => s + Number(r.value), 0) / lastThird.length;
```

Lines 183-184: `avgLast` is average of `firstThird`, `avgFirst` is average of `lastThird`.

## Design impact

The trend direction narrative is inverted: when recent values increase, it reports "decelerating" instead of "accelerating", and vice versa. This is a logic bug that affects user-facing narrative text.

## Recommendation

Swap the variable names: compute `avgFirst` from `firstThird` and `avgLast` from `lastThird`.

## Target shape

```typescript
const avgFirst = firstThird.reduce((s, r) => s + Number(r.value), 0) / firstThird.length;
const avgLast = lastThird.reduce((s, r) => s + Number(r.value), 0) / lastThird.length;
```

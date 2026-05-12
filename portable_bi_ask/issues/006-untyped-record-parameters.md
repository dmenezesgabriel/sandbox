# Parameter types use `Record<string, unknown>` instead of named domain types

Priority: Medium

Category: Encapsulation | Testability

## Issue

`QuestionParser.parse()` accepts `options: Record<string, unknown>`, and `FieldResolver.clarify` accepts `pending: Record<string, unknown>`, `message: string`, `fields: CatalogField[]` as separate parameters. These should be named types that make the contract explicit.

## Evidence

- `ask-data.ts:1601`: `async parse(question, options: Record<string, unknown> = {})`
- `ask-data.ts:923-928`: `clarify: (pending: Record<string, unknown>, message: string, fields: CatalogField[]) => ...`

## Design impact

Callers must know the expected key structure without type safety. Typos in key names won't be caught at compile time. Tests must construct anonymous objects with no documentation about required shape.

## Recommendation

Define named types for options: `ParseOptions` with `clarification?: ClarificationPending`, `QuestionOptions`, etc. Use the existing `ClarificationPending` type instead of `Record<string, unknown>` in `FieldResolver`.

## Target shape

```typescript
interface ParseOptions { clarification?: ClarificationPending }
parse(question: string, options?: ParseOptions): Promise<ParsedQuestion>
```

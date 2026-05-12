# buildVocabulary embeds 120+ hardcoded localization strings in the engine constructor

Priority: Medium

Category: Coupling | Testability

## Issue

`AskDataEngine.buildVocabulary()` (ask-data.ts:2444-2567) contains 120+ hardcoded English and Portuguese term groups. Adding a new language requires editing core engine code. The method is ~120 lines of inline data.

## Evidence

- Lines 2446-2555: Two complete term dictionaries embedded in a method

## Design impact

Localization changes force engine code changes. The vocabulary cannot be loaded from configuration. Testing with custom vocabulary requires overriding the entire method.

## Recommendation

Extract vocabulary data into separate JSON/YAML locale files (e.g., `locales/en.ts`, `locales/pt.ts`). Load them via a `VocabularyLoader` port. The engine should receive vocabulary through its config, not generate it inline.

## Target shape

```
locales/
  en.ts   → export default { by: ['by'], ... }
  pt.ts   → export default { by: ['por'], ... }
AskDataEngine receives vocabulary via config.vocabulary merged with locale defaults
```

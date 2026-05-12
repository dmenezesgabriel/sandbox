# AskDataEngine is a god object with 20+ responsibilities

Priority: High

Category: Responsibility | Cohesion | Coupling

## Issue

`AskDataEngine` (lines 2286–3048 of `ask-data.ts`) orchestrates catalog building, vocabulary, locale, field matching, value filtering, question parsing, SQL planning, diagnostics evaluation, insight narration, evidence description, metric defaults, time field defaults, format labels, and confidence scoring. It has 30+ public/private methods spanning at least six distinct reasons to change: vocabulary/localization changes, question parsing logic, SQL generation, diagnostic queries, result analysis, and UI description formatting.

## Evidence

- `ask-data.ts:2286-3048` (AskDataEngine class)
- Constructor at line 2329 manually wires 15+ collaborators via closures: `() => this.catalog`, `() => this.displayLabel(item)`, etc.
- `buildVocabulary()` (line 2444) contains hardcoded English/Portuguese term dictionaries
- `describeIntent()`, `describeMetricPart()`, `describeFilterParts()`, `describeDatePart()` (lines 2989-3047) are pure formatting methods
- `evaluateJoinFanout()`, `evaluateFilterSelectivity()`, `evaluateDateParse()` (lines 2797-2855) execute diagnostic SQL

## Design impact

Any change to vocabulary, question parsing, SQL generation, result formatting, or diagnostics forces editing this class. Changes ripple unpredictably. The class cannot be tested without DuckDB (infrastructure required for `evaluateDiagnostics`). Individual behaviors cannot be composed or replaced independently.

## Recommendation

Split AskDataEngine into focused modules: (1) `Vocabulary` already exists as `TermMatcher` but the hardcoded dictionaries should live in configuration; (2) extract `describeIntent`, `describeMetricPart`, etc. into an `IntentDescriber`; (3) extract diagnostic evaluation into a `DiagnosticRunner` that receives a query function as a port; (4) extract `buildVocabulary` construction into a factory function; (5) have `AskDataEngine` compose these modules rather than containing their logic.

## Target shape

`AskDataEngine` becomes a thin orchestrator that delegates to `QuestionParser`, `SqlPlanner`, `DiagnosticRunner`, `IntentDescriber`, `ResultAnalyzer`, and `NarrativeGenerator` — each injectable and independently testable.

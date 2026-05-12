# ask-data.ts is a 3048-line monolith mixing 6 domain concepts

Priority: High

Category: Cohesion | Boundary

## Issue

`ask-data.ts` contains 15+ classes spanning semantic matching, date parsing, field search, intent detection, SQL planning, value resolution, question parsing, catalog building, and the engine. These are distinct domain concepts that change for different reasons and belong in separate bounded contexts.

## Evidence

- `SemanticFieldMatcher` (line 56): NLP embedding infrastructure
- `TermMatcher`, `MonthCatalog`, `DateQuestionText`, `RelativePeriodDateParser`, `NamedMonthDateParser`, `ChronoDateParser`, `ExplicitYearDateParser`, `DateRangeParser` (lines 215-594): date/time parsing
- `IntentCueDetector` (line 596): intent classification
- `FieldSearchIndex`, `TextSearchFieldMatchStrategy`, `ExactFieldMatchStrategy`, `FuseFieldMatchStrategy`, `SemanticFieldMatchStrategy`, `FieldResolver` (lines 686-970): field resolution strategies
- `SqlPlanner` (line 972): SQL generation
- `ValueFilterResolver` (line 1365): filter value matching
- `QuestionParser` (line 1542): question interpretation
- `CatalogBuilder` (line 2007): data catalog construction with DB queries

## Design impact

Navigating, understanding, and testing is difficult. A change to date parsing risks breaking SQL generation. The large file makes code review harder. Each concept has its own change cycle.

## Recommendation

Move each class cluster into its own file/module: `semantic-field-matcher.ts`, `date-parsing.ts`, `intent-cue-detector.ts`, `field-search.ts`, `field-match-strategies.ts`, `sql-planner.ts`, `value-filter-resolver.ts`, `question-parser.ts`, `catalog-builder.ts`. Keep `AskDataEngine` as the composition root.

## Target shape

Each domain concept in its own file with a clear public interface. `AskDataEngine` re-exports the composition and wires collaborators.

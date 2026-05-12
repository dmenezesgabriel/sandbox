# Narrative generation duplicates insight generation logic

Priority: Medium

Category: Cohesion | Coupling

## Issue

`InsightGenerator` (result-analysis.ts:339-480) and `NarrativeGenerator` (narrative-generator.ts:25-532) both analyze the same result data to produce human-readable observations. Both detect outliers, compute distribution characteristics, and format values. They duplicate logic like outlier detection, top-N analysis, and trend detection.

## Evidence

- `InsightGenerator.groupedMetricInsights()` (result-analysis.ts:375-389) finds top/bottom values, computes shares — same logic as `NarrativeGenerator.analyzeExtremes()` (narrative-generator.ts:324-375)
- Both compute "top 3 share" percentages: insight line 413-421 vs narrative line 230-247
- Both detect outliers: insight line 446-457 vs narrative line 263-303

## Design impact

Changes to analysis heuristics must be made in two places. The two modules can produce contradictory observations. Memory and compute are wasted doing the same statistical operations twice.

## Recommendation

Extract a `ResultAnalyzer` that computes structural facts (top/bottom/outliers/trend) once, producing an `AnalysisFacts` object. Both `InsightGenerator` and `NarrativeGenerator` consume `AnalysisFacts` rather than recomputing. Alternatively, merge them into a single `ResultAnalysis` module that produces both insights and narratives from one pass.

## Target shape

```
AskDataEngine.ask():
  facts = ResultAnalyzer.analyze(rows, intent, shape)
  insights = InsightGenerator.fromFacts(facts)
  narratives = NarrativeGenerator.fromFacts(facts)
```

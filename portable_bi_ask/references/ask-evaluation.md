# Ask Data Smoke Tests and Evaluation

Ground truth lives in `references/ask-smoke-tests.json`.

## Smoke test goals

These tests protect the deterministic Ask Data contract while the parser/planner internals are refactored.

A change is safe when:

- the browser has no console errors;
- the dashboard loads with no error state;
- every Ask smoke question returns the expected interpretation, chart type, and row values;
- confidence stays in the expected range;
- typo/fuzzy tests do not introduce unintended filters;
- DuckDB/MotherDuck SQL cross-checks agree with UI rows within tolerance.

## Metrics

| Metric | How measured | Pass condition |
|---|---|---|
| Ask pass rate | Passed Ask tests / total Ask tests | 100% for smoke suite |
| Dashboard pass rate | Passed dashboard tests / total dashboard tests | 100% for smoke suite |
| Numeric accuracy | Absolute delta vs expected rows and executable DuckDB SQL cross-checks | `<= numericAbs` from JSON |
| Interpretation accuracy | Expected substring in `result.interpretation` | All expected substrings present |
| Chart accuracy | `result.chartType` | Equals expected chart type |
| Confidence calibration | `result.confidence` | Within min/max bounds when specified |
| Warning calibration | `result.warnings` | Expected caveats appear for fuzzy/inferred low-confidence answers |
| Evidence trace accuracy | `result.evidence` | Expected metric/dimension/filter evidence is present |
| Console health | `playwright-cli console error` | 0 errors |
| Query latency | Catalog build time / Ask parse time / SQL execution time / Total Ask time | Recorded per Ask result and aggregated in `smoke-last-result.json` |
| Regression surface | Unexpected filters, row count changes, bad first rows | None in smoke suite |

## Manual Playwright evaluation form

For each question:

```text
Test id:
Question:
Interpretation:
Chart type:
Confidence:
First rows:
Console errors:
Pass/fail:
Notes:
```

## DuckDB/MotherDuck cross-check form

```text
Test id:
DuckDB SQL:
DuckDB rows:
UI/Ask rows:
Max absolute delta:
Pass/fail:
Notes:
```

## Reusable browser smoke runner

Run the maintained smoke runner and save the latest report artifact with:

```bash
node references/run-ask-smoke-and-save.js
```

It writes `references/smoke-last-result.json` with:

- `timestamp`
- `passCount`, `failCount`, and `summary`
- per-test `results`
- top-level `failures`
- `browserConsoleErrors`
- per-test `durationMs`, Ask `metrics`, and aggregate latency summaries
- per-test `groundTruth` SQL cross-checks and `metrics.groundTruthCrossChecks`

For quick ad hoc checks without writing the artifact, run:

```bash
playwright-cli run-code --filename=references/run-ask-smoke.js
```

The runner loads `references/ask-smoke-tests.json`, runs all Ask tests plus dashboard filter checks, captures browser console/page errors, and returns a pass/fail summary.

## Inline browser smoke runner snippet

After opening `http://localhost:8000/` with Playwright, this can also be run via `playwright-cli --raw eval`:

```js
async () => {
  const smoke = await (await fetch('/references/ask-smoke-tests.json')).json();
  const el = document.querySelector('portable-bi-dashboard');
  await el.askEngine.initialize();
  const tol = smoke.tolerances.numericAbs;
  const close = (a, b) => Math.abs(Number(a) - Number(b)) <= tol;
  const out = [];
  for (const t of smoke.tests.filter(t => t.kind === 'ask')) {
    const r = await el.askEngine.ask(t.question);
    const e = t.expect;
    const failures = [];
    if (r.error) failures.push('error: ' + r.error);
    if (e.interpretationContains && !r.interpretation.includes(e.interpretationContains)) failures.push('interpretation');
    if (e.chartType && r.chartType !== e.chartType) failures.push('chartType');
    if (e.confidenceMin !== undefined && !(r.confidence >= e.confidenceMin)) failures.push('confidence low');
    if (e.confidenceMax !== undefined && !(r.confidence <= e.confidenceMax)) failures.push('confidence high');
    for (const expectedWarning of e.warningsContain || []) {
      if (!(r.warnings || []).some(warning => warning.includes(expectedWarning))) failures.push('missing warning');
    }
    for (const forbiddenWarning of e.warningsNotContain || []) {
      if ((r.warnings || []).some(warning => warning.includes(forbiddenWarning))) failures.push('unexpected warning');
    }
    for (const expectedEvidence of e.evidenceContains || []) {
      const found = (r.evidence || []).some(item => Object.entries(expectedEvidence).every(([key, value]) => item[key] === value));
      if (!found) failures.push('missing evidence');
    }
    const expectedRows = e.rows || e.firstRows || (e.firstRow ? [e.firstRow] : []);
    for (let i = 0; i < expectedRows.length; i++) {
      const er = expectedRows[i];
      const ar = r.rows?.[i];
      if (!ar) failures.push('missing row ' + i);
      else {
        for (const [key, expectedValue] of Object.entries(er)) {
          const actualValue = ar[key];
          if (typeof expectedValue === 'number') {
            if (!close(actualValue, expectedValue)) failures.push('row ' + i + ' ' + key);
          } else if (expectedValue !== undefined && String(actualValue) !== String(expectedValue)) failures.push('row ' + i + ' ' + key);
        }
      }
    }
    if (e.rowCount !== undefined && r.rows?.length !== e.rowCount) failures.push('rowCount');
    out.push({ id: t.id, ok: failures.length === 0, failures, confidence: r.confidence, chartType: r.chartType });
  }
  return JSON.stringify(out);
}
```

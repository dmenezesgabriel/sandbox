async page => {
  const baseUrl = 'http://localhost:8000/';
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const consoleErrors = [];
  const onConsole = msg => {
    if (msg.type() === 'error') consoleErrors.push({ type: 'console', text: msg.text(), location: msg.location?.() });
  };
  const onPageError = err => consoleErrors.push({ type: 'pageerror', text: String(err?.stack || err?.message || err) });
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('portable-bi-dashboard');
  await page.waitForFunction(() => {
    const el = document.querySelector('portable-bi-dashboard');
    return el && !el.loading && el.askEngine?.initialized;
  }, null, { timeout: 60000 });

  const evaluated = await page.evaluate(async () => {
    const smoke = await (await fetch('/references/ask-smoke-tests.json')).json();
    const el = document.querySelector('portable-bi-dashboard');
    const close = (actual, expected) => Math.abs(Number(actual) - Number(expected)) <= smoke.tolerances.numericAbs;
    const percentile = (values, p) => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
      if (!sorted.length) return null;
      return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
    };
    const summarizeDurations = rows => {
      const values = rows.map(row => row.metrics?.totalAskMs ?? row.durationMs).filter(Number.isFinite);
      if (!values.length) return null;
      return {
        count: values.length,
        avgMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        p95Ms: percentile(values, 0.95),
        maxMs: Math.max(...values)
      };
    };
    const normalizeValue = value => {
      if (typeof value === 'bigint') return Number(value);
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return value;
    };
    const tableToRows = table => (typeof table?.toArray === 'function' ? table.toArray() : (table?.rows || table || []))
      .map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])));
    const valuesMatch = (actual, expected) => {
      if (expected === null || expected === undefined) return actual === null || actual === undefined;
      if (typeof expected === 'number') return close(actual, expected);
      return String(normalizeValue(actual)) === String(normalizeValue(expected));
    };
    const compareRows = (actualRows, expectedRows, context) => {
      const failures = [];
      if ((actualRows || []).length < (expectedRows || []).length) failures.push(`${context} rowCount: ${actualRows?.length || 0} < ${expectedRows?.length || 0}`);
      for (let i = 0; i < Math.min(actualRows?.length || 0, expectedRows?.length || 0); i++) {
        for (const [key, expectedValue] of Object.entries(expectedRows[i])) {
          if (!valuesMatch(actualRows[i]?.[key], expectedValue)) failures.push(`${context} row ${i} ${key}: ${actualRows[i]?.[key]} !== ${expectedValue}`);
        }
      }
      return failures;
    };
    const runGroundTruth = async (test, actualRows) => {
      if (!test.duckdbSql) return null;
      const started = performance.now();
      try {
        const expectedRows = tableToRows(await el.dashboardLoader.duckDBManager.query(test.duckdbSql));
        const failures = compareRows(actualRows, expectedRows, `duckdb ${test.id}`);
        return { ok: failures.length === 0, failures, rowCount: expectedRows.length, durationMs: Math.round(performance.now() - started) };
      } catch (error) {
        return { ok: false, failures: [`duckdb ${test.id}: ${String(error)}`], rowCount: 0, durationMs: Math.round(performance.now() - started) };
      }
    };
    const summarizeGroundTruth = rows => {
      const checks = rows.map(row => row.groundTruth).filter(Boolean);
      if (!checks.length) return null;
      return {
        total: checks.length,
        passed: checks.filter(check => check.ok).length,
        failed: checks.filter(check => !check.ok).length,
        avgDurationMs: Math.round(checks.reduce((sum, check) => sum + (check.durationMs || 0), 0) / checks.length)
      };
    };
    const results = [];

    await el.askEngine.initialize();

    for (const test of smoke.tests.filter(t => t.kind === 'ask')) {
      const testStarted = performance.now();
      const result = await el.askEngine.ask(test.question);
      const durationMs = Math.round(performance.now() - testStarted);
      const expected = test.expect;
      const failures = [];

      if (expected.errorContains) {
        if (!result.error?.includes(expected.errorContains)) failures.push(`error: ${result.error}`);
        results.push({ id: test.id, kind: test.kind, ok: failures.length === 0, failures, chartType: result.chartType, confidence: result.confidence, durationMs, metrics: result.metrics, rowCount: result.rows?.length || 0, warningCount: result.warnings?.length || 0 });
        continue;
      }
      if (result.error) failures.push(`error: ${result.error}`);
      if (expected.interpretationContains && !result.interpretation?.includes(expected.interpretationContains)) failures.push(`interpretation: ${result.interpretation}`);
      if (expected.chartType && result.chartType !== expected.chartType) failures.push(`chartType: ${result.chartType}`);
      if (expected.confidenceMin !== undefined && !(result.confidence >= expected.confidenceMin)) failures.push(`confidence low: ${result.confidence}`);
      if (expected.confidenceMax !== undefined && !(result.confidence <= expected.confidenceMax)) failures.push(`confidence high: ${result.confidence}`);
      for (const expectedWarning of expected.warningsContain || []) {
        if (!(result.warnings || []).some(warning => warning.includes(expectedWarning))) failures.push(`missing warning: ${expectedWarning}`);
      }
      for (const forbiddenWarning of expected.warningsNotContain || []) {
        if ((result.warnings || []).some(warning => warning.includes(forbiddenWarning))) failures.push(`unexpected warning: ${forbiddenWarning}`);
      }
      for (const expectedEvidence of expected.evidenceContains || []) {
        const found = (result.evidence || []).some(item => Object.entries(expectedEvidence).every(([key, value]) => item[key] === value));
        if (!found) failures.push(`missing evidence: ${JSON.stringify(expectedEvidence)}`);
      }

      const expectedRows = expected.rows || expected.firstRows || (expected.firstRow ? [expected.firstRow] : []);
      for (let i = 0; i < expectedRows.length; i++) {
        const er = expectedRows[i];
        const ar = result.rows?.[i];
        if (!ar) {
          failures.push(`missing row ${i}`);
          continue;
        }
        for (const [key, expectedValue] of Object.entries(er)) {
          const actualValue = ar[key];
          if (typeof expectedValue === 'number') {
            if (!close(actualValue, expectedValue)) failures.push(`row ${i} ${key}: ${actualValue}`);
          } else if (expectedValue !== undefined && String(actualValue) !== String(expectedValue)) {
            failures.push(`row ${i} ${key}: ${actualValue}`);
          }
        }
      }
      if (expected.rowCount !== undefined && result.rows?.length !== expected.rowCount) failures.push(`rowCount: ${result.rows?.length}`);

      const groundTruth = await runGroundTruth(test, result.rows || []);
      if (groundTruth && !groundTruth.ok) failures.push(...groundTruth.failures);
      results.push({ id: test.id, kind: test.kind, ok: failures.length === 0, failures, chartType: result.chartType, confidence: result.confidence, durationMs, metrics: result.metrics, rowCount: result.rows?.length || 0, warningCount: result.warnings?.length || 0, groundTruth });
    }

    for (const test of smoke.tests.filter(t => t.kind === 'clarification_unit')) {
      const testStarted = performance.now();
      const failures = [];
      const region = el.askEngine.fieldByKey.get('customer::Region');
      const category = el.askEngine.fieldByKey.get('product::Category');
      const items = [
        { field: region, value: 'Shared', normalizedValue: 'shared', matchScore: 1, matchSource: 'exact_value' },
        { field: category, value: 'Shared', normalizedValue: 'shared', matchScore: 1, matchSource: 'exact_value' }
      ];
      const byValue = new Map([['shared', items]]);
      const clarification = el.askEngine.filterResolver.toFilters('sales in shared', byValue).clarification;
      if (clarification?.pending?.slot !== test.expect.pending.slot) failures.push(`slot: ${clarification?.pending?.slot}`);
      if (clarification?.pending?.originalQuestion !== null) failures.push(`originalQuestion should be null before parser annotation`);
      if ((clarification?.pending?.candidates || []).length !== test.expect.pending.candidateCount) failures.push(`candidateCount: ${clarification?.pending?.candidates?.length}`);
      const choice = clarification?.pending?.candidates?.find(candidate => candidate.fieldId === test.expect.applyChoice.fieldId);
      const applied = el.askEngine.filterResolver.toFilters('sales in shared', byValue, { ...clarification.pending, fieldId: choice?.fieldId, valueNormalized: choice?.valueNormalized });
      if (applied.filters?.[0]?.field?.id !== test.expect.applyChoice.fieldId) failures.push(`applied field: ${applied.filters?.[0]?.field?.id}`);
      results.push({ id: test.id, kind: test.kind, ok: failures.length === 0, failures, durationMs: Math.round(performance.now() - testStarted) });
    }

    for (const test of smoke.tests.filter(t => t.kind === 'dashboard_filter')) {
      const testStarted = performance.now();
      const failures = [];
      const filter = test.playwright.steps.find(step => step.includes('Region ='))?.split('=')[1]?.trim();
      if (filter) el.filters = { ...el.filters, Region: filter };
      const data = await el.dashboardLoader.refresh(el.filters);
      el._kpiResults = data.kpiResults;
      el._chartData = data.chartData;
      el._tableRows = data.tableRows;
      await el.updateComplete;

      const totalSalesText = document.querySelector('.kpi-value')?.textContent;
      const firstRow = document.querySelector('tbody tr')?.innerText || '';
      if (test.playwright.expect.totalSalesText && totalSalesText !== test.playwright.expect.totalSalesText) failures.push(`totalSalesText: ${totalSalesText}`);
      for (const part of test.playwright.expect.firstTableRowContains || []) {
        if (!firstRow.includes(part)) failures.push(`firstTableRow missing: ${part}`);
      }
      if (document.querySelector('#error-state')?.textContent?.trim()) failures.push('dashboard error state present');
      const groundTruth = await runGroundTruth(test, test.expectedRows || []);
      if (groundTruth && !groundTruth.ok) failures.push(...groundTruth.failures);
      results.push({ id: test.id, kind: test.kind, ok: failures.length === 0, failures, durationMs: Math.round(performance.now() - testStarted), groundTruth });
    }

    const failed = results.filter(result => !result.ok);
    return {
      results,
      failures: failed.map(result => ({ id: result.id, kind: result.kind, failures: result.failures })),
      metrics: {
        askLatency: summarizeDurations(results.filter(result => result.kind === 'ask')),
        dashboardLatency: summarizeDurations(results.filter(result => result.kind === 'dashboard_filter')),
        testDuration: summarizeDurations(results),
        groundTruthCrossChecks: summarizeGroundTruth(results)
      }
    };
  });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  const failed = evaluated.failures || [];
  const smokeFailures = [...failed];
  if (consoleErrors.length) smokeFailures.push({ id: 'browser_console', kind: 'browser', failures: consoleErrors.map(error => error.text) });
  const total = evaluated.results.length;
  const passCount = total - failed.length;
  return {
    reportVersion: 1,
    timestamp: startedAt,
    durationMs: Date.now() - startedAtMs,
    ok: smokeFailures.length === 0,
    passCount,
    failCount: failed.length,
    summary: { total, passed: passCount, failed: failed.length, consoleErrors: consoleErrors.length },
    metrics: evaluated.metrics,
    failures: smokeFailures,
    browserConsoleErrors: consoleErrors,
    results: evaluated.results
  };
}

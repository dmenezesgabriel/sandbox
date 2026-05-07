import Chart from 'chart.js/auto';
import { LitElement, html, nothing } from 'lit';
import { AskDataEngine } from '../askData.js';
import { DASHBOARD_CONFIG } from '../config.js';
import { DashboardDataLoader } from '../dataLoader.js';
import { duckDBManager } from '../db.js';
import { formatValue, numberValue } from '../utils.js';

export class PortableBiDashboard extends LitElement {
  createRenderRoot() { return this; }
  static properties = {
    config: { type: Object },
    filters: { type: Object },
    _filterOptions: { state: true },
    _kpiResults: { state: true },
    _chartData: { state: true },
    _tableRows: { state: true },
    _activeTab: { state: true },
    _askQuestion: { state: true },
    _askResult: { state: true },
    _askLoading: { state: true },
    _askError: { state: true },
    _askClarification: { state: true },
    loading: { state: true },
    error: { state: true }
  };
  constructor() {
    super();
    this.config = DASHBOARD_CONFIG;
    this.filters = {};
    this._filterOptions = {};
    this._kpiResults = [];
    this._chartData = [];
    this._tableRows = [];
    this._activeTab = 'dashboard';
    this._askQuestion = DASHBOARD_CONFIG.askData.defaultQuestion;
    this._askResult = null;
    this._askLoading = false;
    this._askError = '';
    this._askClarification = null;
    this.loading = false;
    this.error = '';
    this.askEngine = new AskDataEngine(this.config, duckDBManager);
    this.dashboardLoader = new DashboardDataLoader({ config: this.config, duckDBManager, askEngine: this.askEngine });
  }
  connectedCallback() {
    super.connectedCallback();
    this._initDashboard();
  }
  async _initDashboard() {
    this.loading = true;
    this.error = '';
    try {
      await this.dashboardLoader.ensureDataReady();
      if (!Object.keys(this._filterOptions).length) {
        const loaded = await this.dashboardLoader.loadFilterOptions(this.filters);
        this._filterOptions = loaded.filterOptions;
        this.filters = loaded.filters;
      }
      const data = await this.dashboardLoader.refresh(this.filters);
      this._kpiResults = data.kpiResults;
      this._chartData = data.chartData;
      this._tableRows = data.tableRows;
      this.loading = false;
    } catch (err) {
      console.error(err);
      this.loading = false;
      this.error = 'Failed to load data or render dashboard: ' + err;
    }
  }
  _onFilterChange(e, field) {
    this.filters = { ...this.filters, [field]: e.target.value };
    this._initDashboard();
  }
  _chartInstances = {};
  _askChartInstance = null;
  firstUpdated() {
    this._drawCharts();
  }
  updated(changed) {
    if (changed.has('_chartData') || changed.has('_activeTab')) this._drawCharts();
    if (changed.has('_askResult') || changed.has('_activeTab')) this._drawAskChart();
  }
  _drawCharts() {
    if (this._activeTab !== 'dashboard') return;
    if (this._chartInstances) {
      Object.values(this._chartInstances).forEach(inst => {
        try { inst?.destroy?.(); } catch (e) {}
      });
    }
    this._chartInstances = {};
    this._chartData.forEach(({ chartDef, labels, data }) => {
      const canvas = this.querySelector(`#${chartDef.id}`);
      if (!canvas) return;
      this._chartInstances[chartDef.id] = new Chart(canvas.getContext('2d'), {
        type: chartDef.type,
        data: { labels: labels, datasets: [{ label: chartDef.title || chartDef.id, data }] },
        options: chartDef.options || {}
      });
    });
  }
  _drawAskChart() {
    try { this._askChartInstance?.destroy?.(); } catch (e) {}
    this._askChartInstance = null;
    const chartType = this._askResult?.chartType;
    const renderable = ['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'bubble', 'histogram'];
    if (this._activeTab !== 'askData' || !this._askResult || !renderable.includes(chartType)) return;
    const canvas = this.querySelector('#ask-data-chart');
    if (!canvas) return;
    const rows = this._askResult.rows || [];
    const colors = ['#406ac1', '#6aa7e8', '#8fd0a6', '#f2bf5e', '#e07a72', '#8d7ae8', '#6cc5c0', '#c0d065'];
    let type = ['area', 'donut'].includes(chartType) ? (chartType === 'area' ? 'line' : 'doughnut') : chartType;
    let data = {
      labels: rows.map(row => String(row.label)),
      datasets: [{
        label: this._askResult.interpretation,
        data: rows.map(row => numberValue(row.value)),
        fill: chartType === 'area',
        borderColor: '#406ac1',
        backgroundColor: chartType === 'area' ? '#406ac133' : colors
      }]
    };
    let options = { responsive: true, scales: chartType === 'bar' ? { y: { beginAtZero: true } } : {}, plugins: { legend: { display: ['pie', 'donut'].includes(chartType) } } };

    if (chartType === 'scatter' || chartType === 'bubble') {
      const numeric = this._askResult.shape?.numeric || [];
      const [xKey, yKey, rKey] = numeric;
      if (!xKey || !yKey) return;
      type = chartType;
      data = {
        datasets: [{
          label: this._askResult.interpretation,
          data: rows.map(row => ({ x: numberValue(row[xKey]), y: numberValue(row[yKey]), r: Math.max(3, Math.sqrt(Math.abs(numberValue(row[rKey])) || 9)) })),
          backgroundColor: '#406ac188',
          borderColor: '#406ac1'
        }]
      };
      options = { responsive: true, scales: { x: { title: { display: true, text: xKey } }, y: { title: { display: true, text: yKey } } } };
    } else if (chartType === 'histogram') {
      const key = this._askResult.shape?.numeric?.[0] || 'value';
      const values = rows.map(row => numberValue(row[key])).filter(Number.isFinite);
      if (!values.length) return;
      const min = Math.min(...values), max = Math.max(...values);
      const binCount = Math.min(12, Math.max(3, Math.ceil(Math.sqrt(values.length))));
      const step = (max - min || 1) / binCount;
      const bins = Array.from({ length: binCount }, (_, i) => ({ start: min + i * step, count: 0 }));
      for (const value of values) bins[Math.min(binCount - 1, Math.floor((value - min) / step))].count++;
      type = 'bar';
      data = { labels: bins.map(b => `${b.start.toFixed(0)}–${(b.start + step).toFixed(0)}`), datasets: [{ label: key, data: bins.map(b => b.count), backgroundColor: '#406ac1' }] };
      options = { responsive: true, scales: { y: { beginAtZero: true } } };
    }

    this._askChartInstance = new Chart(canvas.getContext('2d'), { type, data, options });
  }
  async _runAsk(appliedClarification = null) {
    this._askLoading = true;
    this._askError = '';
    this._askClarification = null;
    this._askResult = null;
    try {
      const result = await this.askEngine.ask(this._askQuestion, appliedClarification ? { clarification: appliedClarification } : {});
      if (result.clarification) this._askClarification = result.clarification;
      else if (result.error) this._askError = result.error;
      else this._askResult = result;
    } catch (err) {
      console.error(err);
      this._askError = String(err);
    } finally {
      this._askLoading = false;
    }
  }
  _chooseClarification(choice) {
    const pending = this._askClarification?.pending;
    if (!pending) return;
    this._askQuestion = pending.originalQuestion || this._askQuestion;
    this._runAsk({ ...pending, fieldId: choice.fieldId, value: choice.value, valueNormalized: choice.valueNormalized });
  }
  _setExample(example) {
    this._askQuestion = example;
    this._askError = '';
    this._askClarification = null;
  }
  async _copyText(text) {
    await navigator.clipboard?.writeText(String(text || ''));
  }
  _downloadText(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  _resultToCsv(result) {
    const columns = result.columns || [];
    const esc = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [columns.map(esc).join(','), ...(result.rows || []).map(row => columns.map(col => esc(row[col])).join(','))].join('\n');
  }
  _exportAskCsv(result) {
    this._downloadText('ask-result.csv', this._resultToCsv(result), 'text/csv');
  }
  _exportAskJson(result) {
    this._downloadText('ask-result.json', JSON.stringify({ interpretation: result.interpretation, sql: result.sql, columns: result.columns, rows: result.rows }, null, 2), 'application/json');
  }
  render() {
    const c = this.config;
    return html`
      <header>
        <h1>${c.title}</h1>
        <span class="subtitle">${c.subtitle}</span>
      </header>

      <nav class="tabs" aria-label="App sections">
        <button class="tab-button ${this._activeTab === 'dashboard' ? 'active' : ''}" @click=${() => { this._activeTab = 'dashboard'; }}>Dashboard</button>
        <button class="tab-button ${this._activeTab === 'askData' ? 'active' : ''}" @click=${() => { this._activeTab = 'askData'; }}>Ask Data</button>
      </nav>

      ${this._activeTab === 'dashboard' ? this.renderDashboard(c) : this.renderAskData(c)}

      ${(this.loading || this.error || this._askLoading) ? html`
        <div id="loading-state" style="display:${(this.loading || this._askLoading)?'block':'none'}">${this._askLoading ? 'Asking data…' : 'Loading data, please wait…'}</div>
        <div id="error-state" style="display:${this.error?'block':'none'};color:#e74c3c">${this.error}</div>
      ` : nothing}
    `;
  }
  renderDashboard(c) {
    return html`
      <form id="filter-bar">
        ${c.filters.map(f => html`
          <label>${f.label}:
            <select name="${f.field}"
                    .value=${this.filters[f.field] || 'All'}
                    @change=${e => this._onFilterChange(e, f.field)}
                    style="margin-right:.8em;font-size:1em;padding:0.12em .9em;border-radius:.5em;border:1.5px solid #b0c4e7;background:#fff;">
              ${this._filterOptions[f.field]?.map(o => html`<option value=${o}>${o}</option>`) || nothing}
            </select>
          </label>
        `)}
      </form>

      <section id="kpi-cards">
        ${c.kpis.map((kpi, i) => html`
          <div class="kpi-card">
            <div class="kpi-title">${kpi.title}</div>
            <div class="kpi-value">${kpi.format ? kpi.format(this._kpiResults[i]) : this._kpiResults[i]}</div>
          </div>
        `)}
      </section>

      <section id="viz-section">
        ${this._chartData.map(({ chartDef }) => html`
          <div class="chart-card">
            <canvas id="${chartDef.id}"></canvas>
          </div>
        `)}
      </section>

      ${c.tables.map((t, i) => html`
        <section id="table-section">
          <h2>${t.title}</h2>
          <div id="data-table-wrap">
            <table>
              <thead><tr>${t.columns.map(col => html`<th>${col}</th>`)}</tr></thead>
              <tbody>
              ${(this._tableRows[i] || []).map(r => html`<tr>${t.columns.map(col => html`<td>${r[col]}</td>`)}</tr>`)}
              </tbody>
            </table>
          </div>
        </section>
      `)}
    `;
  }
  renderAskData(c) {
    const result = this._askResult;
    return html`
      <main class="ask-page">
        <section class="ask-card">
          <h2>Ask Data</h2>
          <div class="ask-input-row">
            <input aria-label="Ask your data" .value=${this._askQuestion} @input=${e => this._askQuestion = e.target.value} @keydown=${e => { if (e.key === 'Enter') this._runAsk(); }} placeholder="sales by region">
            <button class="primary-button" @click=${this._runAsk} ?disabled=${this._askLoading}>Ask</button>
          </div>
          <div class="ask-examples">
            Try:
            ${(c.askData.examples || []).map((example, i) => html`${i ? ' · ' : ''}<button @click=${() => this._setExample(example)}>${example}</button>`)}
          </div>
        </section>

        ${this._askError ? html`<div class="warning">${this._askError}</div>` : nothing}
        ${this._askClarification ? html`
          <section class="ask-card">
            <h3>Clarification needed</h3>
            <p>${this._askClarification.message}</p>
            ${this._askClarification.choices.map(choice => html`<button class="choice-button" @click=${() => this._chooseClarification(choice)}>${choice.label}</button>`)}
          </section>
        ` : nothing}

        ${result ? html`
          <section class="ask-card">
            <div class="interpretation"><strong>Interpreted as:</strong> ${result.interpretation}</div>
            ${(result.warnings || []).map(w => html`<div class="warning">${w}</div>`)}
            ${this.renderAskDecision(result)}
            ${this.renderAskInsights(result)}
            ${this.renderAskExports(result)}
            ${this.renderAskResult(result)}
            <details class="sql-details">
              <summary>Show SQL and details</summary>
              <pre>${result.sql}</pre>
              <p><strong>Decision path:</strong> ${(result.chartDecision?.path || []).join(' → ')}</p>
              <p><strong>Recommended chart:</strong> ${result.chartDecision?.recommended}; <strong>Rendered:</strong> ${result.chartDecision?.rendered}</p>
              ${result.confidence !== undefined ? html`<p><strong>Confidence:</strong> ${Math.round(result.confidence * 100)}%</p>` : nothing}
              ${result.metrics ? html`<p><strong>Latency:</strong> catalog ${result.metrics.catalogBuildMs ?? 'n/a'}ms; parse ${result.metrics.parseMs ?? 'n/a'}ms; SQL ${result.metrics.sqlExecutionMs ?? 'n/a'}ms; total ${result.metrics.totalAskMs ?? 'n/a'}ms.</p>` : nothing}
              ${result.diagnostics?.joinFanout ? html`<p><strong>Join fanout check:</strong> ${result.diagnostics.joinFanout.baseCount?.toLocaleString?.() || result.diagnostics.joinFanout.baseCount} base rows → ${result.diagnostics.joinFanout.joinedCount?.toLocaleString?.() || result.diagnostics.joinFanout.joinedCount} joined rows (${result.diagnostics.joinFanout.ratio}x).</p>` : nothing}
              ${result.evidence?.length ? html`
                <p><strong>Evidence:</strong></p>
                <ul>${result.evidence.map(item => html`<li>${item.kind}: ${item.field}${item.value !== undefined ? ` = ${item.value}` : ''} (${item.source})</li>`)}</ul>
              ` : nothing}
            </details>
          </section>
        ` : nothing}
      </main>
    `;
  }
  renderAskExports(result) {
    return html`
      <div class="interpretation" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
        <strong>Export:</strong>
        <button class="choice-button" @click=${() => this._copyText(result.sql)}>Copy SQL</button>
        <button class="choice-button" @click=${() => this._exportAskCsv(result)}>Download CSV</button>
        <button class="choice-button" @click=${() => this._exportAskJson(result)}>Download JSON</button>
      </div>
    `;
  }
  renderAskDecision(result) {
    const decision = result.chartDecision;
    if (!decision) return nothing;
    return html`
      <div class="interpretation">
        <strong>Chart decision:</strong> ${decision.path.join(' → ')} → ${decision.rendered}.
        ${decision.reason}
      </div>
    `;
  }
  renderAskInsights(result) {
    const insights = result.insights || [];
    if (!insights.length) return nothing;
    return html`
      <div class="interpretation">
        <strong>Insights:</strong>
        <ul style="margin:.45rem 0 0 1.1rem;padding:0;">
          ${insights.map(insight => html`<li>${insight}</li>`)}
        </ul>
      </div>
    `;
  }
  renderAskResult(result) {
    if (result.chartType === 'kpi') {
      const value = result.rows[0]?.value;
      const metric = result.intent.metric?.field || result.intent.metric;
      return html`<div class="ask-kpi-value">${formatValue(value, metric?.format)}</div>${this.renderAskTable(result)}`;
    }
    if (['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'bubble', 'histogram'].includes(result.chartType)) {
      return html`
        <div class="ask-result-grid">
          <div><canvas id="ask-data-chart"></canvas></div>
          ${this.renderAskTable(result)}
        </div>
      `;
    }
    return this.renderAskTable(result);
  }
  formatAskCell(col, value, metric) {
    if (value === null || value === undefined || value === '') return '';
    if (String(col).includes('percent') || col === 'share') return formatValue(value, 'percent');
    if (['value', 'previous_value', 'start_value', 'end_value', 'change'].includes(col)) return formatValue(value, metric?.format);
    return String(value);
  }
  renderAskTable(result) {
    const columns = result.columns || [];
    const metric = result.intent.metric?.field || result.intent.metric;
    return html`
      <div class="ask-table-wrap">
        <table>
          <thead><tr>${columns.map(col => html`<th>${col}</th>`)}</tr></thead>
          <tbody>
            ${(result.rows || []).map(row => html`<tr>${columns.map(col => html`<td>${this.formatAskCell(col, row[col], metric)}</td>`)}</tr>`)}
          </tbody>
        </table>
      </div>
    `;
  }
}

if (!customElements.get('portable-bi-dashboard')) {
  customElements.define('portable-bi-dashboard', PortableBiDashboard);
}

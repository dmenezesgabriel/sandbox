import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskDataEngine } from '../ask-data';
import { DASHBOARD_CONFIG } from '../config';
import { DashboardDataLoader } from '../data-loader';
import { duckDBManager } from '../db';
import type {
  AskResult,
  AskSuccessResult,
  Clarification,
  ClarificationChoice,
  DashboardConfig,
  FilterOptions,
  Filters,
} from '../types';

import './ask-clarification';
import './ask-input';
import './ask-result';
import './chart-section';
import './data-table';
import './filter-bar';
import './header';
import './kpi-cards';
import './loading-state';
import './sheet-editor';
import './sheets-view';
import './tab-nav';
import type { ActiveTab } from './tab-nav';

function isAskSuccess(result: AskResult): result is AskSuccessResult {
  return 'rows' in result && 'sql' in result && 'chartType' in result;
}

export class Dashboard extends LitElement {
  static override readonly properties = {
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
    error: { state: true },
  };

  config: DashboardConfig;
  filters: Filters;
  private _filterOptions: FilterOptions;
  private _kpiResults: Awaited<ReturnType<DashboardDataLoader['refresh']>>['kpiResults'];
  private _chartData: Awaited<ReturnType<DashboardDataLoader['refresh']>>['chartData'];
  private _tableRows: Awaited<ReturnType<DashboardDataLoader['refresh']>>['tableRows'];
  private _activeTab: ActiveTab;
  private _askQuestion: string;
  private _askResult: AskSuccessResult | null;
  private _askLoading: boolean;
  private _askError: string;
  private _askClarification: Clarification | null;
  loading: boolean;
  error: string;
  private readonly askEngine: AskDataEngine;
  private readonly dashboardLoader: DashboardDataLoader;

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
    this.dashboardLoader = new DashboardDataLoader({
      config: this.config,
      duckDBManager,
      askEngine: this.askEngine,
    });
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._initDashboard().catch(console.error);
  }

  private async _initDashboard(): Promise<void> {
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
    } catch (err: unknown) {
      console.error(err);
      this.loading = false;
      this.error = 'Failed to load data or render dashboard: ' + String(err);
    }
  }

  private _onFilterChange(event: CustomEvent<{ field: string; value: string }>): void {
    this.filters = { ...this.filters, [event.detail.field]: event.detail.value };
    this._initDashboard().catch(console.error);
  }

  private async _runAsk(appliedClarification: Clarification['pending'] | null = null): Promise<void> {
    this._askLoading = true;
    this._askError = '';
    this._askClarification = null;
    this._askResult = null;
    try {
      const result = await this.askEngine.ask(
        this._askQuestion,
        appliedClarification ? { clarification: appliedClarification } : {},
      );
      if ('clarification' in result) this._askClarification = result.clarification;
      else if ('error' in result) this._askError = result.error;
      else if (isAskSuccess(result)) this._askResult = result;
    } catch (err: unknown) {
      console.error(err);
      this._askError = String(err);
    } finally {
      this._askLoading = false;
    }
  }

  private _chooseClarification(choice: ClarificationChoice): void {
    const pending = this._askClarification?.pending;
    if (!pending) return;
    this._askQuestion = pending.originalQuestion || this._askQuestion;
    this._runAsk({
      ...pending,
      fieldId: choice.fieldId,
      value: choice.value,
      valueNormalized: choice.valueNormalized,
    }).catch(console.error);
  }

  private _renderDashboard(): TemplateResult {
    const c = this.config;
    return html`
      <filter-bar
        .filterDefs=${c.filters}
        .filterOptions=${this._filterOptions}
        .values=${this.filters}
        @filter-change=${this._onFilterChange}
      ></filter-bar>

      <kpi-cards .kpis=${c.kpis} .results=${this._kpiResults}></kpi-cards>

      <chart-section .chartData=${this._chartData}></chart-section>

      ${c.tables.map(
        (t, i) => html`
          <data-table
            title="${t.title}"
            .columns=${t.columns}
            .rows=${this._tableRows[i] || []}
            .columnFormats=${t.columnFormats || {}}
          ></data-table>
        `,
      )}
    `;
  }

  private _renderAskData(): TemplateResult {
    const c = this.config;
    return html`
      <main class="ask-page">
        <ask-input
          .question=${this._askQuestion}
          .examples=${c.askData.examples || []}
          .loading=${this._askLoading}
          @question-change=${(e: CustomEvent<string>) => { this._askQuestion = e.detail; }}
          @ask=${() => { this._runAsk().catch(console.error); }}
          @example-select=${(e: CustomEvent<string>) => {
            this._askQuestion = e.detail;
            this._askError = '';
            this._askClarification = null;
            this._runAsk().catch(console.error);
          }}
        ></ask-input>

        ${this._askError ? html`<div class="warning">${this._askError}</div>` : nothing}

        <ask-clarification
          .clarification=${this._askClarification}
          @choice-select=${(e: CustomEvent<ClarificationChoice>) => this._chooseClarification(e.detail)}
        ></ask-clarification>

        <ask-result .result=${this._askResult}></ask-result>
      </main>
    `;
  }

  override render(): TemplateResult {
    const c = this.config;
    return html`
      <page-header title="${c.title}" subtitle="${c.subtitle}"></page-header>

      <tab-nav
        .activeTab=${this._activeTab}
        @tab-change=${(e: CustomEvent<ActiveTab>) => { this._activeTab = e.detail; }}
      ></tab-nav>

      ${this._activeTab === 'dashboard' ? this._renderDashboard() :
        this._activeTab === 'askData' ? this._renderAskData() :
        html`<sheets-view></sheets-view>`}

      <loading-state
        .loading=${this.loading}
        .askLoading=${this._askLoading}
        .error=${this.error}
      ></loading-state>
    `;
  }
}

if (!customElements.get('app-dashboard')) {
  customElements.define('app-dashboard', Dashboard);
}

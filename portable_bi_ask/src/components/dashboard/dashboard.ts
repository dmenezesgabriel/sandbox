import '../ask-clarification';
import '../ask-input';
import '../ask-result';
import '../sheet-editor';
import '../sheets-view';
import '../top-nav';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskDataEngine } from '../../ask-data';
import { DASHBOARD_CONFIG } from '../../dashboard-config';
import { duckDBManager } from '../../db';
import type {
  AskResult,
  AskSuccessResult,
  Clarification,
  ClarificationChoice,
  DashboardConfig,
} from '../../types';
import { escapeSqlString, quoteIdent } from '../../utils';
import type { ActiveTab } from '../top-nav';

function isAskSuccess(result: AskResult): result is AskSuccessResult {
  return 'rows' in result && 'sql' in result && 'chartType' in result;
}

export class Dashboard extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    _activeTab: { state: true },
    _askQuestion: { state: true },
    _askResult: { state: true },
    _askLoading: { state: true },
    _askError: { state: true },
    _askClarification: { state: true },
  };

  config: DashboardConfig;
  private _activeTab: ActiveTab;
  private _askQuestion: string;
  private _askResult: AskSuccessResult | null;
  private _askLoading: boolean;
  private _askError: string;
  private _askClarification: Clarification | null;
  private _dataReady: boolean;
  private readonly askEngine: AskDataEngine;

  constructor() {
    super();
    this.config = DASHBOARD_CONFIG;
    this._activeTab = 'dashboard';
    this._askQuestion = DASHBOARD_CONFIG.askData.defaultQuestion;
    this._askResult = null;
    this._askLoading = false;
    this._askError = '';
    this._askClarification = null;
    this._dataReady = false;
    this.askEngine = new AskDataEngine(this.config, duckDBManager);
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private async _ensureDataReady(): Promise<void> {
    if (this._dataReady) return;
    for (const source of DASHBOARD_CONFIG.dataSources) {
      await duckDBManager.query(
        `CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(source.url)}')`,
      );
    }
    await this.askEngine.initialize();
    this._dataReady = true;
  }

  private async _runAsk(
    appliedClarification: Clarification['pending'] | null = null,
  ): Promise<void> {
    await this._ensureDataReady();
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

  private _renderAskData(): TemplateResult {
    const c = this.config;
    return html`
      <main class="ask-page">
        <ask-input
          .question=${this._askQuestion}
          .examples=${c.askData.examples || []}
          .loading=${this._askLoading}
          @question-change=${(e: CustomEvent<string>) => {
            this._askQuestion = e.detail;
          }}
          @ask=${() => {
            this._runAsk().catch(console.error);
          }}
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
          @choice-select=${(e: CustomEvent<ClarificationChoice>) =>
            this._chooseClarification(e.detail)}
        ></ask-clarification>

        <ask-result .result=${this._askResult}></ask-result>
      </main>
    `;
  }

  private _renderTabContent(): TemplateResult {
    if (this._activeTab === 'dashboard') return html`<sheets-view></sheets-view>`;
    if (this._activeTab === 'askData') return this._renderAskData();
    return html`<sheets-view></sheets-view>`;
  }

  override render(): TemplateResult {
    const c = this.config;
    return html`
      <top-nav
        .activeTab=${this._activeTab}
        .subtitle=${c.subtitle}
        @tab-change=${(e: CustomEvent<ActiveTab>) => {
          this._activeTab = e.detail;
        }}
      ></top-nav>

      ${this._renderTabContent()}
    `;
  }
}

if (!customElements.get('app-dashboard')) {
  customElements.define('app-dashboard', Dashboard);
}

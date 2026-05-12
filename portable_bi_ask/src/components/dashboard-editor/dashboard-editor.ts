import '../ask-clarification';
import '../ask-input';
import '../ask-result';
import '../sheet-editor';
import '../sheets-view';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskOrchestrator } from '../../ask-orchestrator';
import { createDashboardOrchestrator } from '../../create-dashboard-orchestrator';
import type {
  AskResult,
  AskSuccessResult,
  Clarification,
  ClarificationChoice,
  DashboardConfig,
} from '../../types';

function isAskSuccess(result: AskResult): result is AskSuccessResult {
  return 'rows' in result && 'sql' in result && 'chartType' in result;
}

export class DashboardEditor extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    slug: { type: String },
    isNew: { type: Boolean },
    _activeTab: { state: true },
    _askQuestion: { state: true },
    _askResult: { state: true },
    _askLoading: { state: true },
    _askError: { state: true },
    _askClarification: { state: true },
  };

  config: DashboardConfig | null = null;
  slug = '';
  isNew = false;

  private _activeTab: 'dashboard' | 'askData' = 'dashboard';
  private _askQuestion = '';
  private _askResult: AskSuccessResult | null = null;
  private _askLoading = false;
  private _askError = '';
  private _askClarification: Clarification | null = null;
  private _orchestrator: AskOrchestrator | null = null;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _getOrchestrator(): AskOrchestrator | null {
    if (!this.config) return null;
    if (!this._orchestrator) {
      this._orchestrator = createDashboardOrchestrator(this.config);
    }
    return this._orchestrator;
  }

  private async _ensureDataReady(): Promise<void> {
    const orchestrator = this._getOrchestrator();
    if (!orchestrator) return;
    await orchestrator.initialize();
  }

  private async _runAsk(
    appliedClarification: Clarification['pending'] | null = null,
  ): Promise<void> {
    await this._ensureDataReady();
    const orchestrator = this._getOrchestrator();
    if (!orchestrator) return;
    this._askLoading = true;
    this._askError = '';
    this._askClarification = null;
    this._askResult = null;
    try {
      const result = await orchestrator.ask(
        this._askQuestion,
        appliedClarification ? { clarification: appliedClarification } : undefined,
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
    if (!c) return html``;
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
    if (this._activeTab === 'askData') return this._renderAskData();
    return html`<sheets-view
      .config=${this.config}
      .isNew=${this.isNew}
      .slug=${this.slug}
    ></sheets-view>`;
  }

  override render(): TemplateResult {
    const c = this.config;
    const subtitle = c?.subtitle ?? '';
    return html`
      <top-nav
        .activeTab=${this._activeTab}
        .subtitle=${subtitle}
        .dashboardSlug=${this.slug}
        .showTabs=${true}
        @tab-change=${(e: CustomEvent<'dashboard' | 'askData'>) => {
          this._activeTab = e.detail;
        }}
      ></top-nav>

      ${this._renderTabContent()}
    `;
  }
}

if (!customElements.get('dashboard-editor')) {
  customElements.define('dashboard-editor', DashboardEditor);
}

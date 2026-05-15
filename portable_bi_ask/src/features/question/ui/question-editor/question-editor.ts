import './question-editor-header';
import '../question-editor-panel';

import { html, LitElement, type TemplateResult } from 'lit';

import type { QuestionConfig } from '../../../../shared/types/index';
import {
  addQuestion,
  deleteQuestion,
  getQuestionBySlug,
  updateQuestion,
} from '../../data/question-registry';
import { createEmptyQuestionConfig } from '../../model/question-config';

export class QuestionEditor extends LitElement {
  static override readonly properties = {
    slug: { type: String },
    isNew: { type: Boolean },
    _config: { state: true },
    _isDirty: { state: true },
  };

  slug = '';
  isNew = false;

  private _config: QuestionConfig | null = null;
  private _isDirty = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadConfig();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('slug') || changed.has('isNew')) {
      this._loadConfig();
    }
  }

  private _loadConfig(): void {
    if (this.isNew) {
      this._config = createEmptyQuestionConfig();
      this._isDirty = false;
    } else {
      const q = getQuestionBySlug(this.slug);
      this._config = q ?? null;
      this._isDirty = false;
    }
  }

  private _onPanelChange(e: CustomEvent<QuestionConfig>): void {
    this._config = e.detail;
    this._isDirty = true;
  }

  private _onSave(): void {
    if (!this._config) return;
    if (this.isNew) {
      const saved = addQuestion(this._config);
      window.location.hash = `#/question/${saved.slug}`;
    } else {
      updateQuestion(this.slug, this._config);
    }
    this._isDirty = false;
  }

  private _onDelete(): void {
    if (!this._config || this.isNew) return;
    if (this._config.source === 'yaml') return;
    if (!confirm(`Delete "${this._config.title}"? This cannot be undone.`)) return;
    deleteQuestion(this.slug);
    window.location.hash = '#/questions';
  }

  override render(): TemplateResult {
    if (!this._config) {
      return html`<div class="qe-not-found">Question not found: ${this.slug}</div>`;
    }

    return html`
      <question-editor-header
        .title=${this._config.title}
        .isNew=${this.isNew}
        .isDirty=${this._isDirty}
        .isYaml=${this._config.source === 'yaml'}
        @question-save=${this._onSave}
        @question-delete=${this._onDelete}
      ></question-editor-header>

      <main class="qe-main">
        <question-editor-panel
          .config=${this._config}
          @panel-change=${(e: CustomEvent<QuestionConfig>) => this._onPanelChange(e)}
        ></question-editor-panel>
      </main>
    `;
  }
}

if (!customElements.get('question-editor')) {
  customElements.define('question-editor', QuestionEditor);
}

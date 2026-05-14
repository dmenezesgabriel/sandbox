import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { createEmptyQuestionConfig } from '../../question-config';
import { deleteQuestion, questionList } from '../../question-registry';
import { addQuestion } from '../../question-registry';
import type { QuestionConfig } from '../../types';

const TYPE_ICONS: Record<string, string> = {
  chart: '📊',
  table: '⊞',
  kpi: '◈',
  text: '¶',
};

export class QuestionList extends LitElement {
  static override readonly properties = {
    _viewMode: { state: true },
  };

  private _viewMode: 'grid' | 'list' = 'grid';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _handleCreate(): void {
    const q = addQuestion(createEmptyQuestionConfig());
    this.dispatchEvent(
      new CustomEvent<string>('question-create', {
        detail: q.slug,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent<string>('question-select', {
        detail: slug,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event, q: QuestionConfig): void {
    e.stopPropagation();
    if (q.source === 'yaml') return;
    if (!confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
    deleteQuestion(q.slug);
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent<string>('question-delete', {
        detail: q.slug,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderCard(q: QuestionConfig): TemplateResult {
    const icon = TYPE_ICONS[q.type] ?? '?';
    const isReadOnly = q.source === 'yaml';

    return html`
      <div
        class="question-card"
        role="button"
        tabindex="0"
        @click=${() => this._handleSelect(q.slug)}
        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._handleSelect(q.slug)}
      >
        <div class="question-card-icon" aria-hidden="true">${icon}</div>
        <div class="question-card-body">
          <span class="question-card-title">${q.title}</span>
          ${q.description
            ? html`<span class="question-card-desc">${q.description}</span>`
            : nothing}
          <span class="question-card-meta">${q.type}${isReadOnly ? ' · read-only' : ''}</span>
        </div>
        ${!isReadOnly
          ? html`
              <button
                class="question-card-delete"
                title="Delete question"
                aria-label="Delete ${q.title}"
                @click=${(e: Event) => this._handleDelete(e, q)}
              >
                ✕
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private _renderCards(): TemplateResult {
    const gridClass = `question-cards${this._viewMode === 'list' ? ' list-mode' : ''}`;
    return html`
      <div class="${gridClass}">${questionList().map((q) => this._renderCard(q))}</div>
    `;
  }

  override render(): TemplateResult {
    const questions = questionList();

    return html`
      <div class="question-list-page">
        <div class="question-list-header">
          <div class="question-list-title-group">
            <h1 class="question-list-heading">Questions</h1>
            <span class="question-list-count">${questions.length}</span>
          </div>
          <div class="question-list-actions">
            <button
              class="question-list-view-btn ${this._viewMode === 'grid' ? 'active' : ''}"
              @click=${() => {
                this._viewMode = 'grid';
              }}
              aria-label="Grid view"
              title="Grid view"
            >
              ⊞
            </button>
            <button
              class="question-list-view-btn ${this._viewMode === 'list' ? 'active' : ''}"
              @click=${() => {
                this._viewMode = 'list';
              }}
              aria-label="List view"
              title="List view"
            >
              ≡
            </button>
            <button class="question-list-create-btn" @click=${this._handleCreate}>
              New Question
            </button>
          </div>
        </div>

        ${questions.length === 0
          ? html`
              <div class="question-list-empty">
                <p>No questions yet.</p>
                <button class="question-list-create-btn" @click=${this._handleCreate}>
                  Create your first question
                </button>
              </div>
            `
          : this._renderCards()}
      </div>
    `;
  }
}

if (!customElements.get('question-list')) {
  customElements.define('question-list', QuestionList);
}

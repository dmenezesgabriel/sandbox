import { html, nothing, type TemplateResult } from 'lit';
import { BarChart2, FileText, HelpCircle, MessageSquare, Table2, TrendingUp } from 'lucide';

import type { QuestionConfig } from '../../../../shared/types/index';
import { CollectionList } from '../../../../shared/ui/collection-list/collection-list';
import { icon } from '../../../../shared/utils/icons';
import { deleteQuestion, questionList } from '../../data/question-registry';

export class QuestionList extends CollectionList {
  public override get title(): string {
    return 'Questions';
  }

  protected override get subtitle(): string {
    return 'Reusable data questions and visualizations';
  }

  protected override get createDialogTitle(): string {
    return 'Create New Question';
  }

  protected override get createNameLabel(): string {
    return 'Name';
  }

  protected override get createNamePlaceholder(): string {
    return 'Enter question name';
  }

  protected override get createButtonLabel(): string {
    return 'New Question';
  }

  protected override get itemCount(): number {
    return questionList().length;
  }

  protected override get itemCountLabel(): string {
    return 'question';
  }

  protected override _titleIcon(): TemplateResult {
    return icon(MessageSquare, { size: 32 });
  }

  protected override _handleCreate(): void {
    this.dispatchEvent(
      new CustomEvent('question-create', {
        detail: { name: this._newItemName.trim() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override _renderGridItems(): TemplateResult {
    const questions = questionList();
    if (questions.length === 0) {
      return html`
        <div class="question-list-empty">
          <p>No questions yet. Create your first question to get started.</p>
        </div>
      `;
    }
    return html` <div class="question-cards">${questions.map((q) => this._renderCard(q))}</div> `;
  }

  protected override _renderListItems(): TemplateResult {
    const questions = questionList();
    if (questions.length === 0) {
      return html`
        <div class="question-list-empty">
          <p>No questions yet. Create your first question to get started.</p>
        </div>
      `;
    }
    return html`
      <div class="question-cards list-mode">${questions.map((q) => this._renderCard(q))}</div>
    `;
  }

  private _handleSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('question-select', {
        detail: { slug },
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
      new CustomEvent('question-delete', {
        detail: { slug: q.slug },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getTypeIcon(type: string): TemplateResult {
    const iconMap: Record<string, Parameters<typeof icon>[0]> = {
      chart: BarChart2,
      table: Table2,
      kpi: TrendingUp,
      text: FileText,
    };
    return icon(iconMap[type] ?? HelpCircle, { size: 20 });
  }

  private _renderCard(q: QuestionConfig): TemplateResult {
    const isReadOnly = q.source === 'yaml';

    return html`
      <div
        class="question-card"
        role="button"
        tabindex="0"
        @click=${() => this._handleSelect(q.slug)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter') this._handleSelect(q.slug);
        }}
      >
        <div class="question-card-icon" aria-hidden="true">${this._getTypeIcon(q.type)}</div>
        <div class="question-card-body">
          <span class="question-card-title">${q.title}</span>
          ${q.description
            ? html`<span class="question-card-desc">${q.description}</span>`
            : nothing}
          <span class="question-card-meta"> ${q.type}${isReadOnly ? ' · read-only' : ''} </span>
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
}

if (!customElements.get('question-list')) {
  customElements.define('question-list', QuestionList);
}

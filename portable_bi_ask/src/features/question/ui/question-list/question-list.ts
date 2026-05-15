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

  private _handleSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('question-select', {
        detail: { slug },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(q: QuestionConfig): void {
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
    return icon(iconMap[type] ?? HelpCircle, { size: 16 });
  }

  protected override _renderListItems(): TemplateResult {
    const questions = questionList();
    if (questions.length === 0) {
      return html`
        <div class="collection-list-empty">
          <p>No questions yet. Create your first question to get started.</p>
        </div>
      `;
    }
    return html`
      <div class="collection-list-table">
        <div class="collection-list-header">
          <span class="collection-list-col collection-list-col-name">Name</span>
          <span class="collection-list-col collection-list-col-desc">Description</span>
          <span class="collection-list-col collection-list-col-meta">Type</span>
          <span class="collection-list-col collection-list-col-actions"></span>
        </div>
        ${questions.map(
          (q: QuestionConfig) => html`
            <div
              class="collection-list-row"
              role="button"
              tabindex="0"
              @click=${() => this._handleSelect(q.slug)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._handleSelect(q.slug);
              }}
            >
              <span class="collection-list-col collection-list-col-name">
                <span class="collection-list-row-icon" aria-hidden="true"
                  >${this._getTypeIcon(q.type)}</span
                >
                <span class="collection-list-row-title">${q.title}</span>
              </span>
              <span class="collection-list-col collection-list-col-desc"
                >${q.description ?? nothing}</span
              >
              <span class="collection-list-col collection-list-col-meta">
                ${q.type}${q.source === 'yaml'
                  ? html`<span class="collection-list-sep">·</span> read-only`
                  : nothing}
              </span>
              <span
                class="collection-list-col collection-list-col-actions"
                @click=${(e: Event) => e.stopPropagation()}
              >
                ${this._renderRowActions(
                  () => this._handleSelect(q.slug),
                  () => this._handleSelect(q.slug),
                  q.source !== 'yaml' ? () => this._handleDelete(q) : null,
                )}
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('question-list')) {
  customElements.define('question-list', QuestionList);
}

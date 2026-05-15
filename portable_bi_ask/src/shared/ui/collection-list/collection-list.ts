// src/shared/ui/collection-list/collection-list.ts

import '../../ui/ui-button';
import '../../ui/ui-text-field';

import { html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { Eye, Pencil, Plus, Trash2 } from 'lucide';

import { icon } from '../../utils/icons';

export abstract class CollectionList extends LitElement {
  // All reactive state for the scaffold lives here.
  // Subclasses that add their own reactive state must merge these:
  //   static override readonly properties = {
  //     ...CollectionList.properties,
  //     _myField: { state: true },
  //   };
  // Subclasses with NO additional reactive state omit `static properties` entirely.
  static override readonly properties: PropertyDeclarations = {
    _showCreateModal: { state: true },
    _newItemName: { state: true },
    _createNameError: { state: true },
  };

  protected _showCreateModal = false;
  protected _newItemName = '';
  protected _createNameError = '';

  private _dialogRef = createRef<HTMLDialogElement>();
  private _triggerEl: HTMLElement | null = null;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this as unknown as HTMLElement;
  }

  // ── Abstract configuration ────────────────────────────────────────────────

  /** Display title shown in the hero, e.g. "Dashboards" or "Questions". */
  public abstract override get title(): string;

  /** Tagline shown below the hero title. */
  protected abstract get subtitle(): string;

  /** `<h3>` inside the create dialog, e.g. "Create New Dashboard". */
  protected abstract get createDialogTitle(): string;

  /** `<label>` for the name field in the create dialog, e.g. "Name". */
  protected abstract get createNameLabel(): string;

  /** Input placeholder, e.g. "Enter dashboard name". */
  protected abstract get createNamePlaceholder(): string;

  /** Accessible label for the hero CTA button, e.g. "New Dashboard". */
  protected abstract get createButtonLabel(): string;

  /** Total item count for the toolbar count string. */
  protected abstract get itemCount(): number;

  /**
   * Singular noun for the entity used in the toolbar count label.
   * e.g. "dashboard" → "3 dashboards", "question" → "1 question".
   */
  protected abstract get itemCountLabel(): string;

  /**
   * Hero title icon. Must return `icon(SomeLucideIcon, { size: 32 })`.
   * The scaffold wraps it in `.collection-hero-mark`.
   */
  protected abstract _titleIcon(): TemplateResult;

  // ── Abstract rendering ────────────────────────────────────────────────────

  /**
   * Full item list. Must include empty-state markup when there are no items.
   * Must NOT include the `.collection-content` wrapper.
   */
  protected abstract _renderListItems(): TemplateResult;

  // ── Abstract create ───────────────────────────────────────────────────────

  /**
   * Called by the scaffold after name validation passes.
   * `this._newItemName` is guaranteed non-empty (trimmed) at this point.
   * Subclass responsibility:
   *   1. Call the registry (addDashboard / addQuestion / etc.).
   *   2. Dispatch the appropriate CustomEvent.
   * Do NOT call `_closeCreateModal()` — the scaffold does it automatically.
   */
  protected abstract _handleCreate(): void;

  // ── Concrete shared methods ───────────────────────────────────────────────

  /**
   * Renders View, Edit, and (optionally) Delete icon buttons for a list row.
   * Pass `null` for `onDelete` to suppress the delete button (read-only items).
   */
  protected _renderRowActions(
    onView: () => void,
    onEdit: () => void,
    onDelete: (() => void) | null,
  ): TemplateResult {
    return html`
      <div class="collection-list-actions">
        <button class="collection-action-btn view" aria-label="View" title="View" @click=${onView}>
          ${icon(Eye, { size: 16 })}
        </button>
        <button class="collection-action-btn edit" aria-label="Edit" title="Edit" @click=${onEdit}>
          ${icon(Pencil, { size: 16 })}
        </button>
        ${onDelete !== null
          ? html`<button
              class="collection-action-btn delete"
              aria-label="Delete"
              title="Delete"
              @click=${onDelete}
            >
              ${icon(Trash2, { size: 16 })}
            </button>`
          : nothing}
      </div>
    `;
  }

  protected _openCreateModal(): void {
    this._triggerEl = document.activeElement as HTMLElement;
    this._showCreateModal = true;
    this._newItemName = '';
    this._createNameError = '';
    this.updateComplete.then(() => this._dialogRef.value?.showModal());
  }

  protected _closeCreateModal(): void {
    this._dialogRef.value?.close();
  }

  private _onDialogClose(): void {
    this._showCreateModal = false;
    this._triggerEl?.focus();
    this._triggerEl = null;
  }

  private _onCreateSubmit(): void {
    if (!this._newItemName.trim()) {
      this._createNameError = `Please enter a ${this.itemCountLabel} name.`;
      return;
    }
    this._createNameError = '';
    this._handleCreate();
    this._closeCreateModal();
  }

  // ── Shared render ─────────────────────────────────────────────────────────

  override render(): TemplateResult {
    const count = this.itemCount;
    const label = this.itemCountLabel;
    const countText = `${count} ${label}${count !== 1 ? 's' : ''}`;

    return html`
      <section class="collection-page">
        <div class="collection-hero">
          <div class="collection-hero-inner">
            <h1 class="collection-hero-title">
              <span class="collection-hero-mark" aria-hidden="true">${this._titleIcon()}</span>
              ${this.title}
            </h1>
            <p class="collection-hero-subtitle">${this.subtitle}</p>
            <div class="collection-hero-actions">
              <ui-button
                .variant=${'primary'}
                .size=${'lg'}
                .content=${html`${icon(Plus, { size: 18 })} ${this.createButtonLabel}`}
                @click=${this._openCreateModal}
              ></ui-button>
            </div>
          </div>
        </div>

        <div class="collection-toolbar">
          <div class="collection-toolbar-info">${countText}</div>
        </div>

        <div class="collection-content">${this._renderListItems()}</div>

        ${this._showCreateModal ? this._renderCreateModal() : nothing}
      </section>
    `;
  }

  private _renderCreateModal(): TemplateResult {
    const hasError = !!this._createNameError;
    const describedBy = hasError ? 'collection-name-error' : undefined;
    const invalid = hasError ? 'true' : undefined;

    return html`
      <dialog
        class="modal-content"
        aria-labelledby="collection-create-dialog-title"
        @close=${this._onDialogClose}
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this._closeCreateModal();
        }}
        ${ref(this._dialogRef)}
      >
        <h3 id="collection-create-dialog-title">${this.createDialogTitle}</h3>
        <div class="form-group">
          <label for="collection-new-item-name">${this.createNameLabel}</label>
          <ui-text-field
            .inputId=${'collection-new-item-name'}
            .value=${this._newItemName}
            .placeholder=${this.createNamePlaceholder}
            .describedBy=${describedBy}
            .invalid=${invalid}
            .autoFocus=${true}
            @value-change=${(e: CustomEvent<string>) => {
              this._newItemName = e.detail;
              this._createNameError = '';
            }}
            @enter-press=${this._onCreateSubmit}
          ></ui-text-field>
          ${hasError
            ? html`<p id="collection-name-error" class="field-error" role="alert">
                ${this._createNameError}
              </p>`
            : nothing}
        </div>
        <div class="modal-actions">
          <ui-button
            .variant=${'secondary'}
            .content=${'Cancel'}
            @click=${this._closeCreateModal}
          ></ui-button>
          <ui-button
            .variant=${'primary'}
            .content=${'Create'}
            @click=${this._onCreateSubmit}
          ></ui-button>
        </div>
      </dialog>
    `;
  }
}

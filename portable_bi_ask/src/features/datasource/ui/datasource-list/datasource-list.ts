import { html, nothing, type TemplateResult } from 'lit';
import { Database } from 'lucide';

import type { DataSourceConfig } from '../../../../shared/types/index';
import { CollectionList } from '../../../../shared/ui/collection-list/collection-list';
import { icon } from '../../../../shared/utils/icons';
import { datasourceList, deleteDatasource } from '../../data/datasource-registry';

export class DatasourceList extends CollectionList {
  public override get title(): string {
    return 'Datasources';
  }

  protected override get subtitle(): string {
    return 'Reusable data connections for questions and dashboards';
  }

  protected override get createDialogTitle(): string {
    return 'Create New Datasource';
  }

  protected override get createNameLabel(): string {
    return 'Name';
  }

  protected override get createNamePlaceholder(): string {
    return 'Enter datasource name';
  }

  protected override get createButtonLabel(): string {
    return 'New Datasource';
  }

  protected override get itemCount(): number {
    return datasourceList().length;
  }

  protected override get itemCountLabel(): string {
    return 'datasource';
  }

  protected override _titleIcon(): TemplateResult {
    return icon(Database, { size: 32 });
  }

  protected override _handleCreate(): void {
    this.dispatchEvent(
      new CustomEvent('datasource-create', {
        detail: { name: this._newItemName.trim() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('datasource-select', {
        detail: { slug },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(ds: DataSourceConfig): void {
    if (!confirm(`Delete "${ds.name}"? This cannot be undone.`)) return;
    deleteDatasource(ds.slug);
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('datasource-delete', {
        detail: { slug: ds.slug },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _typeLabel(type: string): string {
    return type.toUpperCase();
  }

  protected override _renderListItems(): TemplateResult {
    const items = datasourceList();
    if (items.length === 0) {
      return html`
        <div class="collection-list-empty">
          <p>No datasources yet. Create your first datasource to get started.</p>
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
        ${items.map(
          (ds: DataSourceConfig) => html`
            <div
              class="collection-list-row"
              role="button"
              tabindex="0"
              @click=${() => this._handleSelect(ds.slug)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._handleSelect(ds.slug);
              }}
            >
              <span class="collection-list-col collection-list-col-name">
                <span class="collection-list-row-icon" aria-hidden="true"
                  >${icon(Database, { size: 16 })}</span
                >
                <span class="collection-list-row-title">${ds.name}</span>
              </span>
              <span class="collection-list-col collection-list-col-desc"
                >${ds.description ?? nothing}</span
              >
              <span class="collection-list-col collection-list-col-meta">
                <span class="ds-type-badge ds-type-${ds.type}">${this._typeLabel(ds.type)}</span>
                ${ds.source === 'yaml'
                  ? html`<span class="collection-list-sep">·</span> read-only`
                  : nothing}
              </span>
              <span
                class="collection-list-col collection-list-col-actions"
                @click=${(e: Event) => e.stopPropagation()}
              >
                ${this._renderRowActions(
                  () => this._handleSelect(ds.slug),
                  () => this._handleSelect(ds.slug),
                  ds.source !== 'yaml' ? () => this._handleDelete(ds) : null,
                )}
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('datasource-list')) {
  customElements.define('datasource-list', DatasourceList);
}

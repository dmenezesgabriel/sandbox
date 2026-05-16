import '../datasource-editor-header/datasource-editor-header';
import '../datasource-editor-panel/datasource-editor-panel';

import { html, LitElement, type TemplateResult } from 'lit';

import type { DataSourceConfig } from '../../../../shared/types/index';
import {
  addDatasource,
  deleteDatasource,
  getDatasourceBySlug,
  updateDatasource,
} from '../../data/datasource-registry';
import { createEmptyDatasourceConfig } from '../../model/datasource-config';
import { serializeDatasourceYaml } from '../../model/datasource-yaml';

export class DatasourceEditor extends LitElement {
  static override readonly properties = {
    slug: { type: String },
    isNew: { type: Boolean },
    _config: { state: true },
    _isDirty: { state: true },
    _nameError: { state: true },
    _urlError: { state: true },
  };

  slug = '';
  isNew = false;

  private _config: DataSourceConfig | null = null;
  private _isDirty = false;
  private _nameError = '';
  private _urlError = '';

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
    if (this.isNew && this.slug && this.slug !== 'new') {
      // Shell pre-created the entry; load it so the name appears pre-filled.
      this._config = getDatasourceBySlug(this.slug) ?? createEmptyDatasourceConfig();
    } else if (this.isNew) {
      this._config = createEmptyDatasourceConfig();
    } else {
      this._config = getDatasourceBySlug(this.slug) ?? null;
    }
    this._isDirty = false;
    this._nameError = '';
    this._urlError = '';
  }

  private _onPanelChange(e: CustomEvent<DataSourceConfig>): void {
    this._config = e.detail;
    this._isDirty = true;
    if (e.detail.name) this._nameError = '';
    if (e.detail.url) this._urlError = '';
  }

  private _validate(): boolean {
    let valid = true;
    if (!this._config?.name?.trim()) {
      this._nameError = 'Name is required.';
      valid = false;
    }
    if (!this._config?.url?.trim()) {
      this._urlError = 'URL is required.';
      valid = false;
    }
    return valid;
  }

  private _onSave(): void {
    if (!this._config) return;
    if (!this._validate()) return;
    if (this.isNew && (!this.slug || this.slug === 'new')) {
      const saved = addDatasource({
        name: this._config.name,
        type: this._config.type,
        url: this._config.url,
        description: this._config.description,
      });
      window.location.hash = `#/datasource/${saved.slug}`;
    } else {
      updateDatasource(this.slug, this._config);
      if (this.isNew) window.location.hash = `#/datasource/${this.slug}`;
    }
    this._isDirty = false;
  }

  private _onDelete(): void {
    if (!this._config || this.isNew) return;
    if (this._config.source === 'yaml') return;
    if (!confirm(`Delete "${this._config.name}"? This cannot be undone.`)) return;
    deleteDatasource(this.slug);
    window.location.hash = '#/datasources';
  }

  private _onExport(): void {
    if (!this._config) return;
    const yaml = serializeDatasourceYaml(this._config);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._config.slug}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  override render(): TemplateResult {
    if (!this._config) {
      return html`<div class="qe-not-found">Datasource not found: ${this.slug}</div>`;
    }

    return html`
      <datasource-editor-header
        .title=${this._config.name}
        .isNew=${this.isNew}
        .isDirty=${this._isDirty}
        .isYaml=${this._config.source === 'yaml'}
        @datasource-save=${this._onSave}
        @datasource-delete=${this._onDelete}
        @datasource-export=${this._onExport}
      ></datasource-editor-header>

      <main class="qe-main">
        <datasource-editor-panel
          .config=${this._config}
          .readonly=${this._config.source === 'yaml'}
          .nameError=${this._nameError}
          .urlError=${this._urlError}
          @panel-change=${(e: CustomEvent<DataSourceConfig>) => this._onPanelChange(e)}
        ></datasource-editor-panel>
      </main>
    `;
  }
}

if (!customElements.get('datasource-editor')) {
  customElements.define('datasource-editor', DatasourceEditor);
}

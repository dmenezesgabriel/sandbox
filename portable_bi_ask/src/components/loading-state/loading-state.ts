import { html, LitElement, nothing, type TemplateResult } from 'lit';

export class LoadingState extends LitElement {
  static override readonly properties = {
    loading: { type: Boolean },
    askLoading: { type: Boolean },
    error: { type: String },
  };

  loading = false;
  askLoading = false;
  error = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult | typeof nothing {
    if (!this.loading && !this.askLoading && !this.error) return nothing;
    const active = this.loading || this.askLoading;
    const msg = this.askLoading ? 'Asking data…' : 'Loading data, please wait…';
    return html`
      <div id="loading-state" style="display:${active ? 'block' : 'none'}">${msg}</div>
      <div id="error-state" style="display:${this.error ? 'block' : 'none'}">${this.error}</div>
    `;
  }
}

if (!customElements.get('loading-state')) {
  customElements.define('loading-state', LoadingState);
}

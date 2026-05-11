import { html, LitElement, type TemplateResult } from 'lit';

export class SkeletonLoader extends LitElement {
  static override readonly properties = {
    variant: { type: String },
    lines: { type: Number },
    columns: { type: Number },
    rows: { type: Number },
    width: { type: String },
    height: { type: String },
  };

  variant: 'line' | 'box' | 'kpi' | 'table' = 'line';
  lines = 1;
  columns = 4;
  rows = 3;
  width = '';
  height = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const style = [
      this.width ? `width:${this.width};` : '',
      this.height ? `height:${this.height};` : '',
    ]
      .filter(Boolean)
      .join('');

    switch (this.variant) {
      case 'kpi':
        return html`
          <div class="skeleton-kpi" style=${style}>
            <div class="skeleton skeleton-kpi-label"></div>
            <div class="skeleton skeleton-kpi-value"></div>
          </div>
        `;
      case 'table':
        return html`
          <div class="skeleton-table" style=${style}>
            <div class="skeleton-table-header">
              ${Array.from(
                { length: this.columns },
                (_, i) =>
                  html`<div class="skeleton-cell" style="animation-delay:${i * 0.05}s"></div>`,
              )}
            </div>
            ${Array.from(
              { length: this.rows },
              (_, rowIdx) => html`
                <div class="skeleton-table-row">
                  ${Array.from({ length: this.columns }, (_, colIdx) => {
                    const isLastCol = colIdx === this.columns - 1 && this.columns > 1;
                    return html`
                      <div
                        class="skeleton skeleton-cell"
                        style="animation-delay:${(rowIdx * this.columns + colIdx) *
                        0.04}s;${isLastCol ? 'width:60%;' : ''}"
                      ></div>
                    `;
                  })}
                </div>
              `,
            )}
          </div>
        `;
      case 'line':
        return html`
          <div class="skeleton-group" style=${style}>
            ${Array.from({ length: this.lines }, (_, i) => {
              const isLast = i === this.lines - 1 && this.lines > 1;
              return html`
                <div
                  class="skeleton skeleton-line"
                  style="width:${isLast ? '60%' : '100%'};animation-delay:${i * 0.08}s"
                ></div>
              `;
            })}
          </div>
        `;
      case 'box':
      default:
        return html`<div class="skeleton skeleton-box" style=${style}></div>`;
    }
  }
}

if (!customElements.get('skeleton-loader')) {
  customElements.define('skeleton-loader', SkeletonLoader);
}

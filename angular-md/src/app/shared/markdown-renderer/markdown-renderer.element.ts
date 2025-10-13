import { LitElement, html, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { marked } from 'marked';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { DataStore } from '../data.store';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const STYLES = `
.markdown-container {
  position: relative;
}

.markdown-content {
  line-height: 1.6;
  color: #2d3748;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content h1 {
  font-size: 2rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.markdown-content h2 {
  font-size: 1.5rem;
}

.markdown-content h3 {
  font-size: 1.25rem;
}

.markdown-content p {
  margin-bottom: 16px;
}

.markdown-content code {
  background: #f7fafc;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.9em;
}

.markdown-content pre {
  background: #2d3748;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content pre code {
  background: none;
  padding: 0;
  color: inherit;
}

.markdown-content blockquote {
  border-left: 4px solid #667eea;
  padding-left: 16px;
  margin: 16px 0;
  color: #718096;
  font-style: italic;
}

.markdown-content ul,
.markdown-content ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

.markdown-content li {
  margin-bottom: 4px;
}

.markdown-content a {
  color: #667eea;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}
`;

@customElement('lit-markdown-renderer')
export class MarkdownRendererElement extends LitElement {
  public static style = unsafeCSS(STYLES);

  @property({ type: String })
  content: string = '';

  @property({ type: Object })
  store?: DataStore;

  private preprocessContent(rawContent: string): string {
    if (!this.store) {
      return rawContent;
    }

    // Regex to find $store.path, including inside single or double quotes
    // We look for $store followed by one or more (word characters or dots)
    const storeRegex = /\$store\.([a-zA-Z0-9.]+)/g;

    // This is a complex replacement, so we use a replacer function
    const processedContent = rawContent.replace(storeRegex, (match, path) => {
      const value = this.store!.get(path);

      if (value === undefined) {
        console.warn(`[Markdown Renderer] Store path not found: ${path}`);
        return `UNRESOLVED_STORE_PATH:${path}`;
      }

      // 1. If the value is an array or object (like chart data), stringify it.
      // This is perfect for array/object values inside JSON attributes (e.g., options='{...}')
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }

      // 2. If it's a string or number (like a button label), return it.
      return String(value);
    });

    return processedContent;
  }

  public override render() {
    if (!this.content) {
      return html`<div class="markdown-content"></div>`;
    }

    // NEW: Apply the store resolution before passing to marked
    const processedContent = this.preprocessContent(this.content);

    const htmlOutput = marked(processedContent) as string;

    return html`
      <div class="markdown-container">
        <div class="markdown-content">${unsafeHTML(htmlOutput)}</div>
      </div>
    `;
  }
}

import { Injectable, EnvironmentInjector, inject } from '@angular/core';
import { marked } from 'marked';

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  private environmentInjector = inject(EnvironmentInjector);

  constructor() {
    this.configureMarked();
  }

  private configureMarked(): void {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  async renderMarkdown(
    content: string,
    containerElement: HTMLElement
  ): Promise<void> {
    containerElement.innerHTML = '';

    if (!content.trim()) return;

    try {
      const html = await marked(content);

      containerElement.innerHTML = html;
    } catch (error) {
      console.error('Error rendering markdown content:', error);
    }
  }
}

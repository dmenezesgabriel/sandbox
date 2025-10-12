import {
  Component,
  Input,
  ViewChild,
  ViewContainerRef,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MarkdownService } from "../services/markdown.service";

@Component({
  selector: "markdown-renderer",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="markdown-container">
      <div #markdownContent class="markdown-content"></div>
      <div #componentContainer></div>
    </div>
  `,
  styles: [
    `
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
    `,
  ],
})
export class MarkdownRendererComponent implements OnChanges, AfterViewInit {
  @Input() content: string = "";
  @ViewChild("componentContainer", { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  constructor(private markdownService: MarkdownService) {}

  ngAfterViewInit(): void {
    if (this.content) {
      this.renderContent();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["content"] && this.componentContainer) {
      this.renderContent();
    }
  }

  private async renderContent(): Promise<void> {
    if (!this.content || !this.componentContainer) return;

    try {
      await this.markdownService.renderMarkdown(
        this.content,
        this.componentContainer
      );
    } catch (error) {
      console.error("Error rendering markdown content:", error);
    }
  }
}

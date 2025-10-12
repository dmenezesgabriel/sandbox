import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  ViewChild,
  type AfterViewInit,
  type OnChanges,
  ViewContainerRef,
  type SimpleChanges,
} from '@angular/core';
import { MarkdownService } from './markdown.service';

@Component({
  selector: 'app-markdown-renderer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './markdown-renderer.component.html',
  styleUrl: './markdown-renderer.component.css',
})
export class MarkdownRendererComponent implements OnChanges, AfterViewInit {
  @Input() content: string = '';
  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  constructor(private markdownService: MarkdownService) {}

  ngAfterViewInit(): void {
    if (this.content) {
      this.renderContent();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.componentContainer) {
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
      console.error('Error rendering markdown content:', error);
    }
  }
}

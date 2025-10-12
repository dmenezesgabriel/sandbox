import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  ViewChild,
  type AfterViewInit,
  type OnChanges,
  type SimpleChanges,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
} from '@angular/core';
import { MarkdownService } from './markdown.service';

@Component({
  selector: 'app-markdown-renderer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './markdown-renderer.component.html',
  styleUrl: './markdown-renderer.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MarkdownRendererComponent implements OnChanges, AfterViewInit {
  @Input() content: string = '';
  @ViewChild('markdownContent', { read: ElementRef })
  markdownContainer!: ElementRef<HTMLDivElement>;

  constructor(private markdownService: MarkdownService) {}

  ngAfterViewInit(): void {
    if (this.content && this.markdownContainer) {
      this.renderContent();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.markdownContainer) {
      this.renderContent();
    }
  }

  private async renderContent(): Promise<void> {
    if (!this.content || !this.markdownContainer) return;

    try {
      await this.markdownService.renderMarkdown(
        this.content,
        this.markdownContainer.nativeElement
      );
    } catch (error) {
      console.error('Error rendering markdown content:', error);
    }
  }
}

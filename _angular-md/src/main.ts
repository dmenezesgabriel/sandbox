import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MarkdownRendererComponent } from "./components/markdown-renderer.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownRendererComponent],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Angular Markdown Renderer</h1>
        <p>Render markdown with embedded Angular components</p>
      </header>

      <main class="app-main">
        <div class="editor-section">
          <h2>Markdown Input</h2>
          <textarea
            [(ngModel)]="markdownContent"
            class="markdown-editor"
            placeholder="Enter your markdown with Angular components..."
          >
          </textarea>
          <div class="editor-actions">
            <button (click)="loadExample()" class="load-example-btn">
              Load Example
            </button>
            <button (click)="clearContent()" class="clear-btn">Clear</button>
          </div>
        </div>

        <div class="preview-section">
          <h2>Rendered Output</h2>
          <div class="preview-container">
            <markdown-renderer [content]="markdownContent"></markdown-renderer>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .app-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .app-header {
        background: white;
        padding: 32px;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .app-header h1 {
        margin: 0 0 8px 0;
        font-size: 2.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .app-header p {
        margin: 0;
        color: #718096;
        font-size: 1.1rem;
      }

      .app-main {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        padding: 32px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .editor-section,
      .preview-section {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }

      .editor-section h2,
      .preview-section h2 {
        margin: 0 0 20px 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #2d3748;
      }

      .markdown-editor {
        width: 100%;
        height: 400px;
        padding: 16px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        font-size: 14px;
        line-height: 1.5;
        resize: vertical;
        outline: none;
        transition: border-color 0.3s ease;
      }

      .markdown-editor:focus {
        border-color: #667eea;
      }

      .editor-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }

      .load-example-btn,
      .clear-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .load-example-btn {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }

      .load-example-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
      }

      .clear-btn {
        background: #f7fafc;
        color: #4a5568;
        border: 2px solid #e2e8f0;
      }

      .clear-btn:hover {
        background: #edf2f7;
        border-color: #cbd5e0;
      }

      .preview-container {
        min-height: 400px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        background: #fafafa;
      }

      @media (max-width: 1024px) {
        .app-main {
          grid-template-columns: 1fr;
          gap: 24px;
          padding: 24px 16px;
        }
      }
    `,
  ],
})
export class App {
  markdownContent = `# Welcome to Angular Markdown Renderer

This is a **powerful** markdown renderer that supports embedded Angular components!

## Features

- Standard markdown rendering
- Embedded Angular components
- Interactive elements
- Real-time preview

## Try the Components

### Custom Button
<custom-button label="Click Me!" variant="primary"></custom-button>

<custom-button label="Secondary Button" variant="secondary"></custom-button>

### Custom Alert
<custom-alert type="info" title="Information" message="This is an info alert with Angular components!"></custom-alert>

<custom-alert type="success" message="Success! Your markdown is rendering perfectly."></custom-alert>

<custom-alert type="warning" title="Warning" message="Be careful when mixing markdown and components."></custom-alert>

### Custom Card
<custom-card title="Amazing Card" subtitle="This card is rendered as an Angular component">

You can put **any markdown content** inside the card component!

- List item 1
- List item 2
- List item 3

\`\`\`typescript
const example = "This is code inside a card!";
console.log(example);
\`\`\`

</custom-card>

## Code Example

\`\`\`typescript
// This is how you embed components in markdown
<custom-button label="My Button" variant="primary"></custom-button>
\`\`\`

> This is a blockquote. You can mix standard markdown with Angular components seamlessly!

---

**Try editing the markdown on the left to see real-time updates!**`;

  loadExample(): void {
    this.markdownContent = `# Interactive Example

Let's create something interactive!

<custom-alert type="info" title="Interactive Demo" message="Click the buttons below to see Angular components in action!"></custom-alert>

<custom-card title="User Profile" subtitle="This could be a dynamic user card">

## John Doe
**Software Developer**

- 🌟 5 years experience
- 💻 Angular Expert
- 🚀 Loves building cool stuff

<custom-button label="View Profile" variant="primary"></custom-button>
<custom-button label="Send Message" variant="secondary"></custom-button>

</custom-card>

<custom-alert type="success" message="Components are fully interactive and maintain their Angular functionality!"></custom-alert>

## More Examples

You can create complex layouts:

<custom-card title="Project Statistics">

### This Month
- **127** commits
- **23** pull requests
- **8** releases

<custom-alert type="warning" message="Don't forget to update your documentation!"></custom-alert>

</custom-card>`;
  }

  clearContent(): void {
    this.markdownContent = "";
  }
}

bootstrapApplication(App);

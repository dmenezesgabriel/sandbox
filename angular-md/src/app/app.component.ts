import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  markdownContent = `# Welcome to Angular Markdown Renderer

This is a **powerful** markdown renderer that supports embedded Angular components!

## Features

- Standard markdown rendering
- Embedded Angular components
- Interactive elements
- Real-time preview

## Try the Components

### Custom Button
<app-button label="Click Me!" variant="primary"></app-button>

<app-button label="Secondary Button" variant="secondary"></app-button>

### Custom Alert
<app-alert type="info" title="Information" message="This is an info alert with Angular components!"></app-alert>

<app-alert type="success" message="Success! Your markdown is rendering perfectly."></app-alert>

<app-alert type="warning" title="Warning" message="Be careful when mixing markdown and components."></app-alert>

### Custom Card
<app-card title="Amazing Card" subtitle="This card is rendered as an Angular component">

You can put **any markdown content** inside the card component!

- List item 1
- List item 2
- List item 3

\`\`\`typescript
const example = "This is code inside a card!";
console.log(example);
\`\`\`

</app-card>

## Code Example

\`\`\`typescript
// This is how you embed components in markdown
<app-button label="My Button" variant="primary"></app-button>
\`\`\`

> This is a blockquote. You can mix standard markdown with Angular components seamlessly!

---

**Try editing the markdown on the left to see real-time updates!**`;

  loadExample(): void {
    this.markdownContent = `# Interactive Example

Let's create something interactive!

<app-alert type="info" title="Interactive Demo" message="Click the buttons below to see Angular components in action!"></app-alert>

<app-card title="User Profile" subtitle="This could be a dynamic user card">

## John Doe
**Software Developer**

- 🌟 5 years experience
- 💻 Angular Expert
- 🚀 Loves building cool stuff

<app-button label="View Profile" variant="primary"></app-button>
<app-button label="Send Message" variant="secondary"></app-button>

</app-card>

<app-alert type="success" message="Components are fully interactive and maintain their Angular functionality!"></app-alert>

## More Examples

You can create complex layouts:

<app-card title="Project Statistics">

### This Month
- **127** commits
- **23** pull requests
- **8** releases

<app-alert type="warning" message="Don't forget to update your documentation!"></app-alert>

</app-card>`;
  }

  clearContent(): void {
    this.markdownContent = '';
  }

  handleEditorInput(event: Event | CustomEvent): void {
    // Safely cast the event to CustomEvent and get the detail property
    this.markdownContent = (event as CustomEvent).detail;
  }
}

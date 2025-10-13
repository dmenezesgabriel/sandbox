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

## SQL Data Source 🚀

\`\`\`sql:product_sales
SELECT *
FROM (VALUES
('Shirt', 5),
('Jumper', 20),
('Cardigan', 36),
('Jacket', 10),
('Vest', 10)
) AS products(item, sales);
\`\`\`

## Try the Components

### Data Visualization (ECharts)

<lit-echarts-chart
  options='{
    "title": {"text": "Simple Bar Chart", "left": "center"},
    "tooltip": {},
    "legend": {"data": ["Sales"]},
    "xAxis": {"data": ["Shirt", "Jumper", "Cardigan", "Jacket", "Vest"]},
    "yAxis": {},
    "series": [{"name": "Sales", "type": "bar", "data": [5, 20, 36, 10, 10]}]
  }'/>

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

  handleEditorInput(event: Event | CustomEvent): void {
    // Safely cast the event to CustomEvent and get the detail property
    this.markdownContent = (event as CustomEvent).detail;
  }
}

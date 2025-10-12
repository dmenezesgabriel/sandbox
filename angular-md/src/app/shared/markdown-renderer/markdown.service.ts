import {
  Injectable,
  ComponentRef,
  ViewContainerRef,
  Type,
  createComponent,
  EnvironmentInjector,
  inject,
} from '@angular/core';
import { marked } from 'marked';
import { ButtonComponent } from '../button/button.component';
import { AlertComponent } from '../alert/alert.component';
import { CardComponent } from '../card/card.component';

interface ComponentConfig {
  component: Type<any>;
  selector: string; // New: Optional callbacks for dynamic behavior
  handleEvents?: (componentRef: ComponentRef<any>) => void;
  handleContent?: (
    componentRef: ComponentRef<any>,
    innerContent: string
  ) => Promise<void>;
}

interface ComponentPlaceholder {
  id: string;
  tagName: string;
  attributes: Record<string, any>;
  innerContent: string;
}

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  private componentRegistry: Map<string, ComponentConfig> = new Map();
  private environmentInjector = inject(EnvironmentInjector);

  constructor() {
    this.registerComponents();
    this.configureMarked();
  }

  private registerComponents(): void {
    this.componentRegistry.set('app-button', {
      component: ButtonComponent,
      selector: 'app-button', // Dynamic Event Handler for Button
      handleEvents: (componentRef) => {
        if (componentRef.instance.onClick) {
          componentRef.instance.onClick.subscribe(() => {
            // Note: componentRef.instance contains the live inputs
            console.log('Button clicked!', componentRef.instance);
          });
        }
      },
    });

    this.componentRegistry.set('app-alert', {
      component: AlertComponent,
      selector: 'app-alert',
    });

    this.componentRegistry.set('app-card', {
      component: CardComponent,
      selector: 'app-card', // Dynamic Content Projection Handler for Card
      handleContent: async (componentRef, innerContent) => {
        if (!innerContent.trim()) return; // 1. Process inner content as markdown

        const innerHtml = await marked(innerContent.trim()); // 2. Use setTimeout to ensure the component element is fully in the DOM

        setTimeout(() => {
          const cardElement = componentRef.location.nativeElement;
          const contentArea = cardElement.querySelector('.card-content');
          if (contentArea) {
            // Clear existing content and add processed markdown
            contentArea.innerHTML = innerHtml;
          } else {
            console.warn('Card content area not found');
          }
        }, 50);
      },
    });
  }

  private configureMarked(): void {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  async renderMarkdown(
    content: string,
    container: ViewContainerRef
  ): Promise<void> {
    // Clear existing content (removed container.clear() as it destroys existing components)
    const containerElement = container.element.nativeElement;
    containerElement.innerHTML = '';

    if (!content.trim()) return;

    try {
      // Step 1: Extract components and replace with placeholders
      const { processedContent, components } = this.extractComponents(content); // Step 2: Convert markdown to HTML (with placeholders intact)

      const html = await marked(processedContent); // Step 3: Set the HTML content

      containerElement.innerHTML = html; // Step 4: Replace placeholders with actual Angular components

      await this.replacePlaceholdersWithComponents(
        containerElement,
        components,
        container
      );
    } catch (error) {
      console.error('Error rendering markdown content:', error);
    }
  }

  private extractComponents(content: string): {
    processedContent: string;
    components: ComponentPlaceholder[];
  } {
    const components: ComponentPlaceholder[] = [];
    let processedContent = content;
    let componentIndex = 0; // Regex to match app- components

    const componentRegex = /<(app-\w+)([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;

    processedContent = processedContent.replace(
      componentRegex,
      (match, tagName, attributes, innerContent) => {
        const placeholderId = `component-placeholder-${componentIndex++}`;

        components.push({
          id: placeholderId,
          tagName,
          attributes: this.parseAttributes(attributes),
          innerContent: innerContent || '',
        }); // Return a placeholder div that will survive markdown processing

        return `<div data-component-id="${placeholderId}" class="component-placeholder"></div>`;
      }
    );

    return { processedContent, components };
  }

  private parseAttributes(attributeString: string): Record<string, any> {
    const attributes: Record<string, any> = {};
    const attrRegex = /(\w+)=["']([^"']*?)["']/g;

    let match;
    while ((match = attrRegex.exec(attributeString)) !== null) {
      const [, name, value] = match; // Try to parse as JSON for complex values, otherwise use as string
      try {
        attributes[name] = JSON.parse(value);
      } catch {
        attributes[name] = value;
      }
    }

    return attributes;
  }

  private async replacePlaceholdersWithComponents(
    containerElement: HTMLElement,
    components: ComponentPlaceholder[],
    viewContainer: ViewContainerRef
  ): Promise<void> {
    for (const component of components) {
      const placeholderElement = containerElement.querySelector(
        `[data-component-id="${component.id}"]`
      );

      if (placeholderElement) {
        try {
          // Create the Angular component
          const componentRef = await this.createAngularComponent(
            component,
            viewContainer
          );

          if (componentRef) {
            // Replace the placeholder with the actual component element
            placeholderElement.parentNode?.replaceChild(
              componentRef.location.nativeElement,
              placeholderElement
            );
          }
        } catch (error) {
          console.error('Error creating component:', error); // Keep the placeholder if component creation fails
        }
      }
    }
  }

  private async createAngularComponent(
    componentData: ComponentPlaceholder,
    viewContainer: ViewContainerRef
  ): Promise<ComponentRef<any> | null> {
    const config = this.componentRegistry.get(componentData.tagName);
    if (!config) return null;

    try {
      // Create the Angular component
      const componentRef = createComponent(config.component, {
        environmentInjector: this.environmentInjector,
      }); // Set component inputs

      if (componentData.attributes) {
        Object.keys(componentData.attributes).forEach((key) => {
          if (componentRef.instance.hasOwnProperty(key)) {
            componentRef.instance[key] = componentData.attributes[key];
          }
        });
      } // 🔥 Use dynamic event handler

      if (config.handleEvents) {
        config.handleEvents(componentRef);
      } // Trigger change detection

      componentRef.changeDetectorRef.detectChanges(); // Handle content projection for components with inner content

      await this.handleContentProjection(componentRef, componentData);

      return componentRef;
    } catch (error) {
      console.error('Error creating component:', error);
      return null;
    }
  }

  private async handleContentProjection(
    componentRef: ComponentRef<any>,
    componentData: ComponentPlaceholder
  ): Promise<void> {
    if (!componentData.innerContent || !componentData.innerContent.trim()) {
      return;
    }

    const config = this.componentRegistry.get(componentData.tagName); // 🔥 Use dynamic content handler

    if (config && config.handleContent) {
      await config.handleContent(componentRef, componentData.innerContent);
    }
  }
}

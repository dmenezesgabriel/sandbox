import {
  Injectable,
  ComponentRef,
  ViewContainerRef,
  Type,
  createComponent,
  EnvironmentInjector,
  inject,
} from "@angular/core";
import { marked } from "marked";
import { CustomButtonComponent } from "../components/button.component";
import { CustomAlertComponent } from "../components/alert.component";
import { CustomCardComponent } from "../components/card.component";

interface ComponentConfig {
  component: Type<any>;
  selector: string;
}

interface ComponentPlaceholder {
  id: string;
  tagName: string;
  attributes: Record<string, any>;
  innerContent: string;
}

@Injectable({
  providedIn: "root",
})
export class MarkdownService {
  private componentRegistry: Map<string, ComponentConfig> = new Map();
  private environmentInjector = inject(EnvironmentInjector);

  constructor() {
    this.registerComponents();
    this.configureMarked();
  }

  private registerComponents(): void {
    this.componentRegistry.set("custom-button", {
      component: CustomButtonComponent,
      selector: "custom-button",
    });

    this.componentRegistry.set("custom-alert", {
      component: CustomAlertComponent,
      selector: "custom-alert",
    });

    this.componentRegistry.set("custom-card", {
      component: CustomCardComponent,
      selector: "custom-card",
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
    // Clear existing content
    container.clear();
    const containerElement = container.element.nativeElement;
    containerElement.innerHTML = "";

    if (!content.trim()) return;

    try {
      // Step 1: Extract components and replace with placeholders
      const { processedContent, components } = this.extractComponents(content);

      // Step 2: Convert markdown to HTML (with placeholders intact)
      const html = await marked(processedContent);

      // Step 3: Set the HTML content
      containerElement.innerHTML = html;

      // Step 4: Replace placeholders with actual Angular components
      await this.replacePlaceholdersWithComponents(
        containerElement,
        components,
        container
      );
    } catch (error) {
      console.error("Error rendering markdown content:", error);
    }
  }

  private extractComponents(content: string): {
    processedContent: string;
    components: ComponentPlaceholder[];
  } {
    const components: ComponentPlaceholder[] = [];
    let processedContent = content;
    let componentIndex = 0;

    // Find all component tags - updated regex to properly capture inner content
    const componentRegex = /<(custom-\w+)([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;

    processedContent = processedContent.replace(
      componentRegex,
      (match, tagName, attributes, innerContent) => {
        const placeholderId = `component-placeholder-${componentIndex++}`;

        components.push({
          id: placeholderId,
          tagName,
          attributes: this.parseAttributes(attributes),
          innerContent: innerContent || "",
        });

        // Return a placeholder div that will survive markdown processing
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
      const [, name, value] = match;
      // Try to parse as JSON for complex values, otherwise use as string
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
          console.error("Error creating component:", error);
          // Keep the placeholder if component creation fails
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
      });

      // Set component inputs
      if (componentData.attributes) {
        Object.keys(componentData.attributes).forEach((key) => {
          if (componentRef.instance.hasOwnProperty(key)) {
            componentRef.instance[key] = componentData.attributes[key];
          }
        });
      }

      // Handle click events for buttons
      if (
        componentData.tagName === "custom-button" &&
        componentRef.instance.onClick
      ) {
        componentRef.instance.onClick.subscribe(() => {
          console.log("Button clicked!", componentData.attributes);
        });
      }

      // Attach to view container for proper lifecycle management
      viewContainer.insert(componentRef.hostView);

      // Trigger change detection
      componentRef.changeDetectorRef.detectChanges();

      // Handle content projection for components with inner content
      await this.handleContentProjection(componentRef, componentData);

      return componentRef;
    } catch (error) {
      console.error("Error creating component:", error);
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

    if (componentData.tagName === "custom-card") {
      // Process inner markdown content
      const innerHtml = await marked(componentData.innerContent.trim());

      // Use setTimeout to ensure the component is fully rendered
      setTimeout(() => {
        const cardElement = componentRef.location.nativeElement;
        const contentArea = cardElement.querySelector(".card-content");
        if (contentArea) {
          // Clear existing content and add processed markdown
          contentArea.innerHTML = innerHtml;
        } else {
          console.warn("Card content area not found");
        }
      }, 50); // Increased timeout to ensure component is fully rendered
    }
  }
}

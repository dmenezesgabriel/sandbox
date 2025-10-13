// app/shared/codemirror-editor/codemirror-editor.element.ts
import { LitElement, html } from 'lit';
import { property, customElement, query } from 'lit/decorators.js';
import {
  EditorState,
  Compartment,
  Extension,
  StateEffect,
} from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { foldGutter, LanguageDescription } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { sql } from '@codemirror/lang-sql';

const markdownExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [
    LanguageDescription.of({
      name: 'sql',
      alias: ['postgres', 'sqlite'],
      support: sql(),
    }),
  ],
});

@customElement('lit-codemirror-editor')
export class CodeMirrorEditorElement extends LitElement {
  // Use a query to get the container div for CodeMirror
  @query('#editor')
  private editorDiv!: HTMLDivElement;

  @property({ type: String })
  value: string = '';

  @property({ type: String })
  maxHeight: string = '400px';

  // CodeMirror instance and dynamic configuration compartments
  private view: EditorView | null = null;
  private lineWrapping = new Compartment();
  private themeCompartment = new Compartment();
  private skipNextUpdate = false; // Flag to skip view update when change originates from user input

  // Remove the shadow root for easier external styling
  protected override createRenderRoot() {
    return this;
  }

  // Lifecycle method called after the element is attached
  public override connectedCallback(): void {
    super.connectedCallback();
    this.initCodeMirror();
  }

  // Initialize CodeMirror editor instance
  private initCodeMirror(): void {
    if (this.view || !this.editorDiv) return;

    const extensions: Extension[] = [
      basicSetup,
      // Initial theme setting (defaulting to dark)
      this.themeCompartment.of(oneDark),
      // Language setup
      markdownExtension,
      foldGutter(),
      // Editor change listener: dispatches a custom 'input' event for Angular binding
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();

          // 1. Set the flag: This change originated internally
          this.skipNextUpdate = true;

          // 2. Dispatch event to Angular
          // CRUCIAL FIX: DO NOT update this.value internally.
          // Angular is the source of truth and will update this property later.
          this.dispatchEvent(
            new CustomEvent('input', {
              detail: text,
              bubbles: true,
              composed: true,
            })
          );
        }
      }),
      // Line wrapping setting
      this.lineWrapping.of(EditorView.lineWrapping),
      // Custom styling for the editor container
      EditorView.theme({
        '&': {
          fontSize: '14px',
        },
        '.cm-editor': {
          maxHeight: this.maxHeight,
          height: this.maxHeight, // Ensure it fills the container height
        },
        '.cm-scroller': {
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
        },
        '.cm-focused': {
          outline: 'none',
        },
      }),
    ];

    const startState = EditorState.create({
      doc: this.value,
      extensions,
    });

    this.view = new EditorView({
      state: startState,
      parent: this.editorDiv,
    });
  }

  // Lit lifecycle hook for property changes
  public override updated(
    changedProperties: Map<string | number | symbol, unknown>
  ): void {
    if (!this.view) {
      this.initCodeMirror();
      return;
    }

    // Check if the 'value' property changed
    if (changedProperties.has('value')) {
      // If the change was caused by our own dispatched 'input' event
      // (Angular reacting to user input), skip applying the update
      // to avoid resetting the cursor or causing a flicker.
      if (this.skipNextUpdate) {
        this.skipNextUpdate = false; // Reset the flag
        return;
      }

      // Handle external value changes (e.g., Load Example or Clear button clicked)
      const currentValue = this.view.state.doc.toString();
      const newValue = this.value;

      if (currentValue !== newValue) {
        // Dispatch changes to CodeMirror's state
        this.view.dispatch({
          changes: { from: 0, to: currentValue.length, insert: newValue },
          selection: { anchor: newValue.length, head: newValue.length }, // Move cursor to end
        });
      }
    }

    // Handle maxHeight changes
    if (changedProperties.has('maxHeight')) {
      // Re-apply the custom theme extension with the new maxHeight
      this.view.dispatch({
        effects: StateEffect.reconfigure.of(
          EditorView.theme({
            '.cm-editor': {
              maxHeight: this.maxHeight,
              height: this.maxHeight,
            },
          })
        ),
      });
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.view?.destroy();
    this.view = null;
  }

  // Lit's render function: provides the container for CodeMirror
  public override render() {
    // The Lit component itself serves as the container
    return html`<div id="editor" style="height: 100%;"></div>`;
  }
}

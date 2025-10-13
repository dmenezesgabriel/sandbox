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
  @query('#editor')
  private editorDiv!: HTMLDivElement;

  @property({ type: String })
  value: string = '';

  @property({ type: String })
  maxHeight: string = '400px';

  private view: EditorView | null = null;
  private lineWrapping = new Compartment();
  private themeCompartment = new Compartment();
  private skipNextUpdate = false; // Flag to skip view update when change originates from user input

  protected override createRenderRoot() {
    return this;
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this.initCodeMirror();
  }

  private initCodeMirror(): void {
    if (this.view || !this.editorDiv) return;

    const extensions: Extension[] = [
      basicSetup,

      this.themeCompartment.of(oneDark),
      markdownExtension,
      foldGutter(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();

          this.skipNextUpdate = true;

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
      this.lineWrapping.of(EditorView.lineWrapping),
      EditorView.theme({
        '&': {
          fontSize: '14px',
        },
        '.cm-editor': {
          maxHeight: this.maxHeight,
          height: this.maxHeight,
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

  public override updated(
    changedProperties: Map<string | number | symbol, unknown>
  ): void {
    if (!this.view) {
      this.initCodeMirror();
      return;
    }

    if (changedProperties.has('value')) {
      // If the change was caused by our own dispatched 'input' event
      // (Angular reacting to user input), skip applying the update
      // to avoid resetting the cursor or causing a flicker.
      if (this.skipNextUpdate) {
        this.skipNextUpdate = false; // Reset the flag
        return;
      }

      const currentValue = this.view.state.doc.toString();
      const newValue = this.value;

      if (currentValue !== newValue) {
        this.view.dispatch({
          changes: { from: 0, to: currentValue.length, insert: newValue },
          selection: { anchor: newValue.length, head: newValue.length }, // Move cursor to end
        });
      }
    }

    if (changedProperties.has('maxHeight')) {
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

  public override render() {
    return html`<div id="editor" style="height: 100%;"></div>`;
  }
}

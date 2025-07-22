import { EditorState, Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { foldGutter } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useRef } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  wordWrap?: boolean;
  maxHeight?: string;
  theme?: "light" | "dark";
}

export function CodeEditor({
  value,
  onChange,
  wordWrap = true,
  maxHeight = "500px",
  theme = "dark",
}: CodeEditorProps) {
  const editorDivRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const lineWrapping = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (editorDivRef.current && !editorViewRef.current) {
      const startState = EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          themeCompartment.current.of(theme === "dark" ? oneDark : []),
          languageCompartment.current.of(
            markdown({
              base: markdownLanguage,
            })
          ),
          foldGutter(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.doc.toString();
              onChange(text);
            }
          }),
          lineWrapping.current.of(wordWrap ? EditorView.lineWrapping : []),
          EditorView.theme({
            "&": {
              fontSize: "14px",
            },
            ".cm-editor": {
              maxHeight: maxHeight,
            },
            ".cm-scroller": {
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
            },
            ".cm-focused": {
              outline: "none",
            },
          }),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: editorDivRef.current,
      });

      editorViewRef.current = view;

      return () => {
        view.destroy();
        editorViewRef.current = null;
      };
    }
  }, [maxHeight, onChange, theme, wordWrap]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView) {
      const currentValue = editorView.state.doc.toString();
      if (currentValue !== value) {
        editorView.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        });
      }
    }
  }, [value]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView) {
      editorView.dispatch({
        effects: lineWrapping.current.reconfigure(
          wordWrap ? EditorView.lineWrapping : []
        ),
      });
    }
  }, [wordWrap]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView) {
      editorView.dispatch({
        effects: themeCompartment.current.reconfigure(
          theme === "dark" ? oneDark : []
        ),
      });
    }
  }, [theme]);

  return (
    <div
      ref={editorDivRef}
      className="border border-gray-300 rounded-lg overflow-hidden"
      style={{ maxHeight, overflow: "auto" }}
    />
  );
}

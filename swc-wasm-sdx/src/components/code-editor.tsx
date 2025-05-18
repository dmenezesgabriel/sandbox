import { EditorState, Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useMemo, useRef } from "react";
import type { EditorLanguages } from "../types";

interface CodeEditorProps {
  value: string;
  language: EditorLanguages;
  onChange: (value: string) => void;
  wordWrap?: boolean;
  maxHeight?: string; // Add maxHeight prop
}

export function CodeEditor({
  value,
  language,
  onChange,
  wordWrap,
  maxHeight = "500px", // Default maxHeight
}: CodeEditorProps) {
  const editorDivRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const initialValueRef = useRef(value);
  const lineWrapping = useRef(new Compartment());

  const languages = useMemo(
    () => ({
      javascript: javascript(),
      typescript: javascript({ typescript: true }),
      markdown: markdown(),
      jsx: javascript({ jsx: true }),
      tsx: javascript({ jsx: true, typescript: true }),
    }),
    []
  );

  useEffect(() => {
    if (editorDivRef.current) {
      const startState = EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          oneDark,
          languageCompartment.current.of(
            languages[language] || languages.javascript
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.doc.toString();
              onChange(text);
            }
          }),
          lineWrapping.current.of(EditorView.lineWrapping),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: editorDivRef.current,
      });

      editorViewRef.current = view;

      return () => {
        view.destroy();
      };
    }
  }, []); // Only initialize once on mount

  useEffect(() => {
    const view = editorViewRef.current;
    if (view) {
      const currentValue = view.state.doc.toString();
      if (currentValue !== value) {
        view.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        });
      }
    }
  }, [value]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (view) {
      const newExtension = languages[language] || languages.javascript;
      view.dispatch({
        effects: languageCompartment.current.reconfigure(newExtension),
      });
    }
  }, [language, languages]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (view) {
      view.dispatch({
        effects: lineWrapping.current.reconfigure(
          wordWrap ? EditorView.lineWrapping : []
        ),
      });
    }
  }, [wordWrap]);

  return (
    <div
      ref={editorDivRef}
      style={{ maxHeight, overflow: "auto" }} // Apply maxHeight and overflow styles
    />
  );
}

import { useNotebooks } from "../contexts/notebooks-context";
import type { Cell } from "../types";
import styles from "./cell.module.css";
import { useState, useRef, useEffect } from "react";
import { CodeEditor } from "./code-editor";
import { remark } from "remark";
import remarkHtml from "remark-html";

interface MarkdownCellProps {
  notebookId: string;
  cell: Cell;
}

export function MarkdownCell({ notebookId, cell }: MarkdownCellProps) {
  const { updateNotebookCell } = useNotebooks();
  const [editing, setEditing] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState(cell.source);
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const editorDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setMarkdownDraft(cell.source);
  }, [cell.source, editing]);

  useEffect(() => {
    if (editing && editorDivRef.current) {
      const textarea = editorDivRef.current.querySelector(
        "textarea, [contenteditable]"
      );
      if (textarea && typeof (textarea as HTMLElement).focus === "function") {
        (textarea as HTMLElement).focus();
      }
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      remark()
        .use(remarkHtml)
        .process(cell.source)
        .then((file) => {
          setRenderedHtml(String(file.value ?? ""));
        });
    }
  }, [cell.source, editing]);

  useEffect(() => {
    if (!editing) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        editorDivRef.current &&
        !editorDivRef.current.contains(event.target as Node)
      ) {
        setEditing(false);
        if (markdownDraft !== cell.source) {
          updateNotebookCell(notebookId, { ...cell, source: markdownDraft });
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    editing,
    markdownDraft,
    cell.source,
    notebookId,
    updateNotebookCell,
    cell,
  ]);

  const enterEditMode = () => {
    setEditing(true);
  };

  const exitEditMode = () => {
    setEditing(false);
    if (markdownDraft !== cell.source) {
      updateNotebookCell(notebookId, { ...cell, source: markdownDraft });
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      exitEditMode();
    }
  };

  return (
    <div className={styles.cell}>
      {editing ? (
        <div ref={editorDivRef} onKeyDown={handleEditorKeyDown}>
          <CodeEditor
            value={markdownDraft}
            language="markdown"
            onChange={setMarkdownDraft}
            wordWrap={true}
            maxHeight="200px"
          />
        </div>
      ) : (
        <div
          className={styles.cell__output}
          tabIndex={0}
          onFocus={enterEditMode}
          onClick={enterEditMode}
          style={{ cursor: "text" }}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  );
}

import { useNotebooks } from "../contexts/notebooks-context";
import type { Cell } from "../types";
import styles from "./cell.module.css";
import { remark } from "remark";
import remarkHtml from "remark-html";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";

interface MarkdownCellProps {
  notebookId: string;
  cell: Cell;
}

export function MarkdownCell({ notebookId, cell }: MarkdownCellProps) {
  const { updateNotebookCell } = useNotebooks();
  const [editing, setEditing] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState(cell.source);
  const renderedMarkdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const renderMarkdownToHtml = useCallback(async (markdown: string) => {
    const file = await remark().use(remarkHtml).process(markdown);
    return String(file.value ?? "");
  }, []);

  useEffect(() => {
    if (!editing) setMarkdownDraft(cell.source);
  }, [cell.source, editing]);

  useEffect(() => {
    if (editing || !renderedMarkdownRef.current) return;
    renderMarkdownToHtml(cell.source).then((html) => {
      renderedMarkdownRef.current!.innerHTML = html;
    });
  }, [cell.source, editing, renderMarkdownToHtml]);

  useLayoutEffect(() => {
    if (!editing || !editorRef.current) return;
    if (editorRef.current.innerText !== markdownDraft) {
      editorRef.current.innerText = markdownDraft;
    }
  }, [editing, markdownDraft]);

  const enterEditMode = () => {
    setEditing(true);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const exitEditMode = () => {
    setEditing(false);
    if (markdownDraft !== cell.source) {
      updateNotebookCell(notebookId, { ...cell, source: markdownDraft });
    }
  };

  const handleEditorInput = (event: React.FormEvent<HTMLDivElement>) => {
    setMarkdownDraft(event.currentTarget.innerText);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      editorRef.current?.blur();
    }
  };

  return (
    <div className={styles.cell}>
      {editing ? (
        <div
          className={styles.cell__textarea}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={handleEditorInput}
          onBlur={exitEditMode}
          onKeyDown={handleEditorKeyDown}
          style={{ whiteSpace: "pre-wrap", minHeight: "1.5rem" }}
        />
      ) : (
        <div
          className={styles.cell__output}
          ref={renderedMarkdownRef}
          tabIndex={0}
          onFocus={enterEditMode}
          onClick={enterEditMode}
          style={{ cursor: "text" }}
        />
      )}
    </div>
  );
}

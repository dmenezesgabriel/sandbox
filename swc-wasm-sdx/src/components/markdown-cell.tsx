import { useNotebooks } from "../contexts/notebooks-context";
import type { Cell } from "../types";
import styles from "./cell.module.css";
import { remark } from "remark";
import remarkHtml from "remark-html";
import { useEffect, useRef } from "react";
import type { VFile } from "vfile";

interface MarkdownCellProps {
  notebookId: string;
  cell: Cell;
}

export function MarkdownCell({ notebookId, cell }: MarkdownCellProps) {
  const { updateNotebookCell } = useNotebooks();
  const outputRef = useRef<HTMLDivElement>(null);

  function handleMarkdownChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    updateNotebookCell(notebookId, { ...cell, source: event.target.value });
  }

  useEffect(() => {
    if (!outputRef.current) return;
    remark()
      .use(remarkHtml)
      .process(cell.source)
      .then((file: VFile) => {
        outputRef.current!.innerHTML = String(file.value ?? "");
      });
  }, [cell.source]);

  return (
    <div className={styles.cell}>
      <textarea
        className={styles.cell__textarea}
        value={cell.source}
        onChange={handleMarkdownChange}
        rows={6}
      />
      <div className={styles.cell__output} ref={outputRef} />
    </div>
  );
}

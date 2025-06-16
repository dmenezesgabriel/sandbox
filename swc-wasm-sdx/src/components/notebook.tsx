import { CodeCell, CodeCellHandle } from "./code-cell";
import { MarkdownCell } from "./markdown-cell";
import { useNotebooks } from "../contexts/notebooks-context";
import { RuntimeContextProvider } from "../contexts/runtime-context";
import type { Notebook, Cell } from "../types";
import styles from "./notebook.module.css";
import { FC, useRef } from "react";
import React from "react";
import { AddCellControls } from "./add-cell-controls";

interface NotebookProps {
  notebook: Notebook;
}

const cellComponentMap: Record<
  string,
  FC<{ notebookId: string; cell: Cell }>
> = {
  code: CodeCell,
  markdown: MarkdownCell,
};

export function Notebook({ notebook }: NotebookProps) {
  const { addNotebookCell } = useNotebooks();
  const cellRefs = useRef(new Map<string, React.RefObject<CodeCellHandle>>());

  function renderNotebookCell(
    cell: Cell,
    notebookId: string
  ): React.JSX.Element {
    const CellComponent = cellComponentMap[cell.cellType] || CodeCell;

    if (cell.cellType === "code") {
      if (!cellRefs.current.has(cell.id)) {
        cellRefs.current.set(cell.id, React.createRef<CodeCellHandle>());
      }
      const ref = cellRefs.current.get(cell.id)!;
      return (
        <CodeCell key={cell.id} ref={ref} notebookId={notebookId} cell={cell} />
      );
    }

    return <CellComponent key={cell.id} notebookId={notebookId} cell={cell} />;
  }

  const handleRunAll = () => {
    notebook.cells
      .filter((cell) => cell.cellType === "code")
      .forEach((cell) => {
        const ref = cellRefs.current.get(cell.id);
        ref?.current?.execute();
      });
  };

  return (
    <RuntimeContextProvider>
      <div className={styles.notebook}>
        <div className={styles.notebook__title}>{notebook.title}</div>
        <div className={styles.notebook__toolbar}>
          <button
            className={styles.notebook__toolbar_button}
            onClick={handleRunAll}
          >
            Run All
          </button>
        </div>
        <div className={styles.notebook__cell_list}>
          {notebook.cells.map((cell) => renderNotebookCell(cell, notebook.id))}
        </div>
        <AddCellControls
          notebookId={notebook.id}
          cells={notebook.cells}
          onAddCell={addNotebookCell}
        />
      </div>
    </RuntimeContextProvider>
  );
}

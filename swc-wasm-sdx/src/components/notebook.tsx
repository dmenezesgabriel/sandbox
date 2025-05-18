import { CodeCell } from "./code-cell";
import { MarkdownCell } from "./markdown-cell";
import { useNotebooks } from "../contexts/notebooks-context";
import { RuntimeContextProvider } from "../contexts/runtime-context";
import type { Notebook, Cell } from "../types";
import styles from "./notebook.module.css";
import { FC } from "react";
import React from "react";

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

  function handleAddCell() {
    const newCell: Cell = {
      id: `cell-${notebook.cells.length + 1}`,
      cellType: "code",
      source: "",
    };
    addNotebookCell(notebook.id, newCell);
  }

  function renderNotebookCell(
    cell: Cell,
    notebookId: string
  ): React.JSX.Element {
    const CellComponent = cellComponentMap[cell.cellType] || CodeCell;

    return <CellComponent key={cell.id} notebookId={notebookId} cell={cell} />;
  }

  return (
    <RuntimeContextProvider>
      <div className={styles.notebook}>
        <div className={styles.notebook__title}>{notebook.title}</div>
        <button
          className={styles.notebook__add_cell_button}
          onClick={handleAddCell}
        >
          Add Cell
        </button>
        <div className={styles.notebook__cell_list}>
          {notebook.cells.map((cell) => renderNotebookCell(cell, notebook.id))}
        </div>
      </div>
    </RuntimeContextProvider>
  );
}

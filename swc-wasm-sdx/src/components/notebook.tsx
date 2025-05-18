import { Cell } from "../components/cell";
import { useNotebooks } from "../contexts/notebooks-context";
import { RuntimeContextProvider } from "../contexts/runtime-context";
import type { Notebook } from "../types";
import styles from "./notebook.module.css";

interface NotebookProps {
  notebook: Notebook;
}

export function Notebook({ notebook }: NotebookProps) {
  const { addNotebookCell } = useNotebooks();

  function handleAddCell() {
    const newCell = {
      id: `cell-${notebook.cells.length + 1}`,
      cellType: "code",
      source: "",
      type: "code",
    };

    addNotebookCell(notebook.id, newCell);
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
          {notebook.cells.map((cell) => (
            <Cell key={cell.id} notebookId={notebook.id} cell={cell} />
          ))}
        </div>
      </div>
    </RuntimeContextProvider>
  );
}

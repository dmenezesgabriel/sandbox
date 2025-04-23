import { Cell } from "../components/cell";
import { useNotebooks } from "../contexts/notebooks-context";
import { RuntimeContextProvider } from "../contexts/runtime-context";
import type { Notebook } from "../types";

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
      <div>{notebook.title}</div>
      <button onClick={handleAddCell}>Add Cell</button>
      {notebook.cells.map((cell) => (
        <Cell key={cell.id} notebookId={notebook.id} cell={cell} />
      ))}
    </RuntimeContextProvider>
  );
}

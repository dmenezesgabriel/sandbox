import { createContext, useContext, useReducer } from "react";
import type { ReactNode } from "react";
import type { Cell, Notebook } from "../types";
import { notebooksReducer } from "../reducers/notebooks/reducer";
import {
  addNotebookAction,
  removeNotebookAction,
  updateNotebookTitleAction,
  addNotebookCellAction,
  removeNotebookCellAction,
  updateNotebookCellAction,
} from "../reducers/notebooks/actions";

interface NotebooksContextType {
  notebooks: Notebook[];
  addNotebook: (notebook: Notebook) => void;
  updateNotebookTitle: (id: string, title: string) => void;
  removeNotebook: (id: string) => void;
  addNotebookCell: (id: string, cell: Cell) => void;
  updateNotebookCell: (id: string, cell: Cell) => void;
  removeNotebookCell: (id: string, cellId: string) => void;
}

const NotebooksContext = createContext({} as NotebooksContextType);

export function NotebooksContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notebooks, dispatch] = useReducer(notebooksReducer, []);

  function addNotebook(notebook: Notebook) {
    dispatch(addNotebookAction(notebook));
  }

  function removeNotebook(id: string) {
    dispatch(removeNotebookAction(id));
  }

  function updateNotebookTitle(id: string, title: string) {
    dispatch(updateNotebookTitleAction(id, title));
  }

  function addNotebookCell(id: string, cell: Cell) {
    dispatch(addNotebookCellAction(id, cell));
  }

  function updateNotebookCell(id: string, cell: Cell) {
    dispatch(updateNotebookCellAction(id, cell));
  }

  function removeNotebookCell(id: string, cellId: string) {
    dispatch(removeNotebookCellAction(id, cellId));
  }

  const value = {
    notebooks,
    addNotebook,
    removeNotebook,
    updateNotebookTitle,
    addNotebookCell,
    updateNotebookCell,
    removeNotebookCell,
  };

  return (
    <NotebooksContext.Provider value={value}>
      {children}
    </NotebooksContext.Provider>
  );
}

export function useNotebooks() {
  return useContext(NotebooksContext);
}

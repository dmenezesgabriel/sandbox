import type { Notebook, Cell } from "../../types";

export enum NotebookActions {
  ADD_NOTEBOOK = "ADD_NOTEBOOK",
  UPDATE_NOTEBOOK_TITLE = "UPDATE_NOTEBOOK_TITLE",
  REMOVE_NOTEBOOK = "REMOVE_NOTEBOOK",
  ADD_NOTEBOOK_CELL = "ADD_NOTEBOOK_CELL",
  UPDATE_NOTEBOOK_CELL = "UPDATE_NOTEBOOK_CELL",
  REMOVE_NOTEBOOK_CELL = "REMOVE_NOTEBOOK_CELL",
}

export interface AddNotebookAction {
  type: NotebookActions.ADD_NOTEBOOK;
  payload: {
    notebook: Notebook;
  };
}

export interface UpdateNotebookTitleAction {
  type: NotebookActions.UPDATE_NOTEBOOK_TITLE;
  payload: {
    id: string;
    title: string;
  };
}

export interface RemoveNotebookAction {
  type: NotebookActions.REMOVE_NOTEBOOK;
  payload: {
    id: string;
  };
}

export interface AddNotebookCellAction {
  type: NotebookActions.ADD_NOTEBOOK_CELL;
  payload: {
    id: string;
    cell: Cell;
  };
}

export interface UpdateNotebookCellAction {
  type: NotebookActions.UPDATE_NOTEBOOK_CELL;
  payload: {
    id: string;
    cell: Cell;
  };
}

export interface RemoveNotebookCellAction {
  type: NotebookActions.REMOVE_NOTEBOOK_CELL;
  payload: {
    id: string;
    cellId: string;
  };
}

export type NotebookAction =
  | AddNotebookAction
  | UpdateNotebookTitleAction
  | RemoveNotebookAction
  | AddNotebookCellAction
  | UpdateNotebookCellAction
  | RemoveNotebookCellAction;

export function addNotebookAction(notebook: Notebook): AddNotebookAction {
  return {
    type: NotebookActions.ADD_NOTEBOOK,
    payload: {
      notebook,
    },
  };
}

export function updateNotebookTitleAction(
  id: string,
  title: string
): UpdateNotebookTitleAction {
  return {
    type: NotebookActions.UPDATE_NOTEBOOK_TITLE,
    payload: {
      id,
      title,
    },
  };
}

export function removeNotebookAction(id: string): RemoveNotebookAction {
  return {
    type: NotebookActions.REMOVE_NOTEBOOK,
    payload: {
      id,
    },
  };
}

export function addNotebookCellAction(
  id: string,
  cell: Cell
): AddNotebookCellAction {
  return {
    type: NotebookActions.ADD_NOTEBOOK_CELL,
    payload: {
      id,
      cell,
    },
  };
}
export function updateNotebookCellAction(
  id: string,
  cell: Cell
): UpdateNotebookCellAction {
  return {
    type: NotebookActions.UPDATE_NOTEBOOK_CELL,
    payload: {
      id,
      cell,
    },
  };
}
export function removeNotebookCellAction(
  id: string,
  cellId: string
): RemoveNotebookCellAction {
  return {
    type: NotebookActions.REMOVE_NOTEBOOK_CELL,
    payload: {
      id,
      cellId,
    },
  };
}

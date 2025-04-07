import type { Notebook } from "../../types";
import { produce } from "immer";
import { NotebookActions, type NotebookAction } from "./actions";

export function notebooksReducer(state: Notebook[], action: NotebookAction) {
  switch (action.type) {
    case NotebookActions.ADD_NOTEBOOK:
      return produce(state, (draft) => {
        const notebook = draft.find(
          (notebook) => notebook.id === action.payload.notebook.id
        );

        if (notebook) {
          return;
        }

        draft.push(action.payload.notebook);
      });
    case NotebookActions.UPDATE_NOTEBOOK_TITLE:
      return produce(state, (draft) => {
        const notebook = draft.find(
          (notebook) => notebook.id === action.payload.id
        );

        if (!notebook) {
          return;
        }

        notebook.title = action.payload.title;
      });
    case NotebookActions.REMOVE_NOTEBOOK:
      return produce(state, (draft) => {
        const index = draft.findIndex(
          (notebook) => notebook.id === action.payload.id
        );

        if (index === -1) {
          return;
        }

        draft.splice(index, 1);
      });
    case NotebookActions.ADD_NOTEBOOK_CELL:
      return produce(state, (draft) => {
        const notebook = draft.find(
          (notebook) => notebook.id === action.payload.id
        );

        if (!notebook) {
          return;
        }
        const cell = notebook.cells.find(
          (cell) => cell.id === action.payload.cell.id
        );

        if (cell) {
          return;
        }

        notebook.cells.push(action.payload.cell);
      });
    case NotebookActions.UPDATE_NOTEBOOK_CELL:
      return produce(state, (draft) => {
        const notebook = draft.find(
          (notebook) => notebook.id === action.payload.id
        );

        if (!notebook) {
          return;
        }

        const cell = notebook.cells.find(
          (cell) => cell.id === action.payload.cell.id
        );

        if (!cell) {
          return;
        }

        Object.assign(cell, action.payload.cell);
      });
    case NotebookActions.REMOVE_NOTEBOOK_CELL:
      return produce(state, (draft) => {
        const notebook = draft.find(
          (notebook) => notebook.id === action.payload.id
        );

        if (!notebook) {
          return;
        }

        const index = notebook.cells.findIndex(
          (cell) => cell.id === action.payload.cellId
        );

        if (index === -1) {
          return;
        }

        notebook.cells.splice(index, 1);
      });
  }
}

import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export const selectTasks = (state: RootState) => state.taskbox.tasks;

export const selectVisibleTasks = createSelector([selectTasks], (tasks) => {
  const tasksInOrder = [
    ...tasks.filter((t) => t.state === "TASK_PINNED"),
    ...tasks.filter((t) => t.state !== "TASK_PINNED"),
  ];
  return tasksInOrder.filter(
    (t) => t.state === "TASK_INBOX" || t.state === "TASK_PINNED"
  );
});

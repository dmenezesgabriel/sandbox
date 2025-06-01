import { Task, TaskStatus } from "./task.types";

export const defaultTasks: Task[] = [
  {
    id: 1,
    title: "Complete project proposal",
    status: TaskStatus.DONE,
  },
  {
    id: 2,
    title: "Review design mockups",
    status: TaskStatus.DONE,
  },
  {
    id: 3,
    title: "Prepare presentation slides",
    status: TaskStatus.DONE,
  },
  {
    id: 4,
    title: "send meeting notes email",
    status: TaskStatus.DONE,
  },
  {
    id: 5,
    title: "Review Uli's pull request",
    status: TaskStatus.DONE,
  },
];

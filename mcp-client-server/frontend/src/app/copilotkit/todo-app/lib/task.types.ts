export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
}

export enum TaskStatus {
  TODO = "todo",
  DONE = "done",
}

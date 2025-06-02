import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { createContext, ReactNode, useContext, useState } from "react";

import { defaultTasks } from "../default-tasks";
import { Task, TaskStatus } from "../task.types";

let nextId = defaultTasks.length + 1;

interface TasksContextType {
  tasks: Task[];
  addTask: (title: string) => void;
  setTaskStatus: (id: number, status: TaskStatus) => void;
  deleteTask: (id: number) => void;
}

const TaskContext = createContext<TasksContextType | undefined>(undefined);

export const TasksProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);

  useCopilotReadable({
    description: "The state of the todo list",
    value: JSON.stringify(tasks),
  }); // provide context to Copilot

  useCopilotAction({
    name: "addTask",
    description: "Adds a task to the todo list",
    parameters: [
      {
        name: "title",
        type: "string",
        description: "The title of the task to add",
        required: true,
      },
    ],
    handler: ({ title }) => {
      addTask(title);
    },
  });

  useCopilotAction({
    name: "deleteTask",
    description: "Deletes a task from the todo list",
    parameters: [
      {
        name: "id",
        type: "number",
        description: "The ID of the task to delete",
        required: true,
      },
    ],
    handler: ({ id }) => {
      deleteTask(id);
    },
  });

  useCopilotAction({
    name: "setTaskStatus",
    description: "Sets the status of a task",
    parameters: [
      {
        name: "id",
        type: "number",
        description: "The ID of the task to update",
        required: true,
      },
      {
        name: "status",
        type: "string",
        description: "The new status of the task (TODO, DONE)",
        required: true,
      },
    ],
    handler: ({ id, status }) => {
      setTaskStatus(id, status as TaskStatus);
    },
  });

  function addTask(title: string) {
    setTasks([...tasks, { id: nextId++, title, status: TaskStatus.TODO }]);
  }

  function setTaskStatus(id: number, status: TaskStatus) {
    setTasks(
      tasks.map((task) => (task.id === id ? { ...task, status } : task))
    );
  }

  function deleteTask(id: number) {
    setTasks(tasks.filter((task) => task.id !== id));
  }

  return (
    <TaskContext.Provider value={{ tasks, addTask, setTaskStatus, deleteTask }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return context;
};

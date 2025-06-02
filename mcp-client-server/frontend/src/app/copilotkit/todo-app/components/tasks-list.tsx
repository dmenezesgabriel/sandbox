"use client";

import { AnimatePresence } from "framer-motion";

import { useTasks } from "../../lib/hooks/use-tasks";
import { TaskStatus } from "../../lib/task.types";
import { AddTodo } from "./add-todo";
import { Task } from "./task";

export function TasksList() {
  const { tasks } = useTasks();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 md:p-24">
      <div className="flex flex-col gap-4 min-w-full md:min-w-[500px]">
        <h1 className="text-2xl font-bold"> My Todos</h1>

        <AddTodo />
        <AnimatePresence>
          {tasks
            .sort((a, b) => {
              if (a.status === b.status) {
                return a.id - b.id;
              }
              return a.status === TaskStatus.TODO ? -1 : 1;
            })
            .map((task) => (
              <Task key={task.id} task={task} />
            ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

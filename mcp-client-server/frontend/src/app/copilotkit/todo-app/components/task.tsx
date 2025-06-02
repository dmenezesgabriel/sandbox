import { motion } from "framer-motion";
import { TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useTasks } from "../../lib/hooks/use-tasks";
import { type Task, TaskStatus } from "../../lib/task.types";

export function Task({ task: { id, title, status } }: { task: Task }) {
  const { setTaskStatus, deleteTask } = useTasks();

  return (
    <motion.div
      key={`${id}_${status}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex items-center gap-4 p-2 rounded-md bg-muted"
    >
      <Checkbox
        id={`task_${id}`}
        onClick={() =>
          setTaskStatus(
            id,
            status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE
          )
        }
        checked={status === TaskStatus.DONE}
      />
      <div className="text-sm text-neutral-500 font-medium">TASK-{id}</div>
      <Label
        htmlFor={`task_${id}`}
        className={cn(
          "flex-1 text-sm text-muted-foreground",
          status === TaskStatus.DONE && "line-through"
        )}
      >
        {title}
      </Label>
      <Button variant="ghost" size="sm" onClick={() => deleteTask(id)}>
        <TrashIcon className="w-4 h-4" />
        <span className="sr-only">Delete</span>
      </Button>
    </motion.div>
  );
}

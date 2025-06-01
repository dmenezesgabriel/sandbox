"use client";

import { useEffect, useState } from "react";
import { TasksList } from "./components/tasks-list";
import { TasksProvider } from "./lib/hooks/use-tasks";
import { CopilotPopup } from "@copilotkit/react-ui";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <>
      <TasksProvider>
        <TasksList />
      </TasksProvider>
      <CopilotPopup />
    </>
  );
}

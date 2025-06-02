"use client";

import "@copilotkit/react-ui/styles.css";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { ReactNode, Suspense } from "react";
import { useEffect, useState } from "react";

import { TasksProvider } from "./lib/hooks/use-tasks";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="agent">
      <Suspense>
        <TasksProvider>{children}</TasksProvider>
        <CopilotSidebar />
      </Suspense>
    </CopilotKit>
  );
}

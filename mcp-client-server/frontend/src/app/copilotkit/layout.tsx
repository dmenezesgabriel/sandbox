"use client";

import { ReactNode, Suspense } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { TasksProvider } from "./lib/hooks/use-tasks";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useState } from "react";

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

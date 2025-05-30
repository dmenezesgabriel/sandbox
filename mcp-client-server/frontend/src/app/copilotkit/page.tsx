"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import {
  useCopilotAction,
  useLangGraphInterrupt,
  useCoAgent,
} from "@copilotkit/react-core";
import { Suspense, useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useCoAgent({
    name: "agent",
  });

  useLangGraphInterrupt({
    render: ({ event, resolve }) => {
      return (
        <div className="p-4 bg-gray-100 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Interrupt</h2>
          <p>{JSON.stringify(event)}</p>
          <button
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => resolve(JSON.stringify({ action: "continue" }))}
          >
            Resolve
          </button>
        </div>
      );
    },
  });

  if (!mounted) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <CopilotSidebar
      instructions={
        "You are assisting the user as best as you can. Answer in the best way possible given the data you have."
      }
      labels={{
        title: "Popup Assistant",
        initial: "Need any help?",
      }}
      defaultOpen={true}
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Welcome</h1>
        <p>
          This is your main content area. The assistant is available in the
          sidebar.
        </p>
      </div>
    </CopilotSidebar>
  );
}

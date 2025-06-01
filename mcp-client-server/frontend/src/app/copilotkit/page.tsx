"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import {
  useCopilotAction,
  useLangGraphInterrupt,
  useCoAgent,
} from "@copilotkit/react-core";
import { useEffect, useState } from "react";
import { InterruptForm } from "./interrupt-form";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { state, running, threadId, nodeName } = useCoAgent({
    name: "agent",
  });

  useCopilotAction({
    name: "sayHello",
    description: "Say hello to the user",
    available: "remote",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "The name of the user to say hello to",
        required: true,
      },
    ],
    handler: async ({ name }) => {
      alert(`Hello, ${name}!`);
    },
  });

  useCopilotAction({
    name: "add",
    description: "Add two numbers together",
    available: "disabled", // Don't allow the agent or UI to call this tool as its only for rendering
    render({ result, args, status }) {
      return (
        <div className="p-4 bg-gray-100 rounded shadow">
          <h2 className="text-lg font-bold">Add Result</h2>
          <p>
            {status === "complete"
              ? `The result of adding ${args.a} and ${args.b} is ${result}.`
              : "This tool is not available for use."}
          </p>
        </div>
      );
    },
  });

  useLangGraphInterrupt({
    enabled: ({ eventValue }) => eventValue.type === "human_review",
    render: ({ event, resolve }) => {
      const { question, tool_call } = event.value;

      return (
        <InterruptForm
          question={question}
          tool_call={tool_call}
          onConfirm={(data) => resolve(data)}
        />
      );
    },
  });

  if (!mounted) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <CopilotSidebar
      clickOutsideToClose={false}
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
        <p>Thread ID: {threadId}</p>
        <p>Node Name: {nodeName}</p>
        <p>Running: {running ? "Yes" : "No"}</p>
        <p>{JSON.stringify(state, null, 2)}</p>
      </div>
    </CopilotSidebar>
  );
}

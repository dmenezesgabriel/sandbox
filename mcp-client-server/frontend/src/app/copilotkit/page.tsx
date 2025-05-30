"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useState } from "react";
import { useLangGraphInterrupt } from "@copilotkit/react-core";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  // useLangGraphInterrupt({
  //   render: ({ event, resolve }) => (
  //     <div className="p-4 border rounded">
  //       <h3>Interrupt Event:</h3>
  //       <pre>{JSON.stringify(event, null, 2)}</pre>
  //       <button onClick={() => resolve()}>Continue</button>
  //     </div>
  //   ),
  // });

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

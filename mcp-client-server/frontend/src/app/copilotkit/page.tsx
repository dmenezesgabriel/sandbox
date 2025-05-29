"use client";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <CopilotPopup
      instructions={
        "You are assisting the user as best as you can. Answer in the best way possible given the data you have."
      }
      labels={{
        title: "Popup Assistant",
        initial: "Need any help?",
      }}
    />
  );
}

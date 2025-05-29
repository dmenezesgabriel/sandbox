import { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="agent">
      {children}
    </CopilotKit>
  );
}

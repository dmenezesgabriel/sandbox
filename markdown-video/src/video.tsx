import { MarkdownToReact } from "./lib/markdown-to-react";

export function Video({ markdown }: { markdown: string }) {
  return (
    <div
      style={{
        backgroundColor: "#1e1e1e",
        color: "#fff",
        fontSize: 28,
        padding: 40,
        fontFamily: "JetBrains Mono, monospace",
        height: "100%",
        width: "100%",
      }}
    >
      <MarkdownToReact markdown={markdown} />
    </div>
  );
}

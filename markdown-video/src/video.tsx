import { MarkdownToReact } from "./lib/markdown-to-react";
import { useCurrentFrame } from "remotion";

function splitMarkdownSections(markdown: string) {
  // Split by '## ' headings, keep headings
  const parts = markdown.split(/^## /gm);
  // The first part is before the first heading (title/intro)
  if (parts.length <= 1) return [markdown];
  const intro = parts[0];
  const sections = parts.slice(1).map((s) => "## " + s);
  return [intro, ...sections];
}

export function Video({ markdown }: { markdown: string }) {
  const frame = useCurrentFrame();
  const sections = splitMarkdownSections(markdown);

  // Show only the current section based on frame
  const currentIndex = Math.min(Math.floor(frame / 30), sections.length - 1);
  const visibleMarkdown = sections[currentIndex];

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
      <MarkdownToReact markdown={visibleMarkdown} />
    </div>
  );
}

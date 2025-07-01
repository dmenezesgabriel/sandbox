import { useEffect, useState } from "react";
import { Composition } from "remotion";
import { Video } from "./video";

export const RemotionRoot = () => {
  const [markdown, setMarkdown] = useState<string>("");

  useEffect(() => {
    fetch(new URL("./content.md", import.meta.url))
      .then((res) => res.text())
      .then(setMarkdown);
  }, []);

  return (
    <Composition
      id="MarkdownVideo"
      component={Video}
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        markdown: markdown || "# Loading...",
      }}
    />
  );
};

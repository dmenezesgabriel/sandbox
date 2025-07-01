import { useEffect, useState } from "react";
import type { JSX } from "react";
import { highlight } from "../lib/shared";

export function CodeBlock({
  code,
  lang = "ts",
  initial,
}: {
  code: string;
  lang?: string;
  initial?: JSX.Element;
}) {
  const [nodes, setNodes] = useState(initial);

  useEffect(() => {
    highlight(code, lang).then(setNodes);
  }, [code, lang]);

  return nodes ?? <p>Loading code...</p>;
}

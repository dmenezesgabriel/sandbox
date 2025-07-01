import { useEffect, useState } from "react";
import type { JSX } from "react";
import { highlight } from "../lib/shared";

// Module-level cache: persists across remounts
const highlightCache = new Map<string, JSX.Element>();

export function CodeBlock({
  code,
  lang = "ts",
  initial,
}: {
  code: string;
  lang?: string;
  initial?: JSX.Element;
}) {
  const [nodes, setNodes] = useState<JSX.Element | undefined>(
    () => highlightCache.get(`${lang}:${code}`) ?? initial
  );

  useEffect(() => {
    const cacheKey = `${lang}:${code}`;
    if (highlightCache.has(cacheKey)) {
      setNodes(highlightCache.get(cacheKey));
      return;
    }
    highlight(code, lang).then((result) => {
      highlightCache.set(cacheKey, result);
      setNodes(result);
    });
  }, [code, lang]);

  return nodes ?? <p>Loading code...</p>;
}

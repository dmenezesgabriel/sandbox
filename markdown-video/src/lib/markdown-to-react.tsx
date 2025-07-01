import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeReact from "rehype-react";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { CodeBlock } from "../components/code-block";
import type { HTMLAttributes, ReactNode } from "react";

export function MarkdownToReact({ markdown }: { markdown: string }) {
  const result = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeReact, {
      createElement,
      ...jsxRuntime, // Pass jsx/jsxs/jsxDEV and Fragment
      components: {
        code: (
          props: HTMLAttributes<HTMLElement> & { children: ReactNode }
        ) => {
          const langMatch = props.className?.match(/language-(\w+)/);
          const lang = langMatch ? langMatch[1] : "ts";
          const code =
            typeof props.children === "string"
              ? props.children
              : Array.isArray(props.children)
              ? props.children.join("")
              : String(props.children ?? "");
          return <CodeBlock code={code} lang={lang} />;
        },
      },
    })
    .processSync(markdown).result;

  return <div>{result}</div>;
}

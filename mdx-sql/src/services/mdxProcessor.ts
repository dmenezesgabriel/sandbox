import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import type { Code } from "mdast";

export interface SqlBlock {
  id: string;
  sql: string;
  meta: string;
}

const parseMeta = (meta: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!meta) return result;

  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(meta))) {
    result[match[1]] = match[2];
  }

  return result;
};

export const extractSqlBlocks = (mdxContent: string): SqlBlock[] => {
  const sqlBlocks: SqlBlock[] = [];

  const ast = unified().use(remarkParse).use(remarkMdx).parse(mdxContent);

  visit(ast, "code", (node: Code) => {
    if (node.lang === "sql") {
      const metaInfo = parseMeta(node.meta!);
      const id = metaInfo.id;

      sqlBlocks.push({
        id,
        sql: node.value.trim(),
        meta: node.meta!,
      });
    }
  });

  return sqlBlocks;
};

export const processMdxContent = async (
  content: string
): Promise<{ Content: React.ComponentType; sqlBlocks: SqlBlock[] }> => {
  try {
    const sqlBlocks = extractSqlBlocks(content);
    let processedContent = content;
    const { default: Content } = await evaluate(processedContent, {
      ...runtime,
    });

    return { Content, sqlBlocks };
  } catch (error) {
    throw new Error(
      `MDX processing failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

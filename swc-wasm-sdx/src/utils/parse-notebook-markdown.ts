import { unified } from "unified";
import remarkParse from "remark-parse";
import { parse as parseYaml } from "yaml";
import type { Notebook, Cell } from "../types";

interface NotebookMarkdownFrontmatter {
  id: string;
  title: string;
  kernel: string;
}

function extractFrontmatter(markdown: string): {
  frontmatter: string;
  content: string;
} {
  if (!markdown.startsWith("---")) {
    return { frontmatter: "", content: markdown };
  }

  const end = markdown.indexOf("---", 3);
  if (end === -1) {
    return { frontmatter: "", content: markdown };
  }

  const frontmatter = markdown.slice(3, end).trim();
  const content = markdown.slice(end + 3).trimStart();
  return { frontmatter, content };
}

export async function parseNotebookMarkdownToJson(
  markdown: string
): Promise<Notebook> {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const data = parseYaml(frontmatter) as NotebookMarkdownFrontmatter;
  const tree = unified().use(remarkParse).parse(content);

  const cells: Cell[] = [];
  let cellIndex = 1;

  for (const node of tree.children) {
    if (node.type === "code") {
      cells.push({
        id: `cell-${cellIndex++}`,
        cellType: "code",
        source: node.value,
      });
      continue;
    }

    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "list"
    ) {
      const { unified } = await import("unified");
      const { default: remarkStringify } = await import("remark-stringify");
      const md = unified()
        .use(remarkStringify)
        .stringify({ type: "root", children: [node] });

      cells.push({
        id: `cell-${cellIndex++}`,
        cellType: "markdown",
        source: md,
      });
    }
  }

  return {
    id: data.id,
    title: data.title,
    metadata: {
      kernelSpec: {
        language: data.kernel,
        name: data.kernel,
      },
    },
    cells,
  };
}

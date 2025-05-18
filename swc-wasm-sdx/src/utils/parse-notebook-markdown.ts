import { fromMarkdown } from "mdast-util-from-markdown";
import { parse as parseYaml } from "yaml";
import type { Notebook, Cell } from "../types";
import type {
  Root,
  RootContent,
  Heading,
  Paragraph,
  Blockquote,
  List,
  ListItem,
  Text,
  Strong,
  Emphasis,
  Code,
} from "mdast";

interface NotebookMarkdownFrontmatter {
  id: string;
  title: string;
  kernel: string;
}

class FrontmatterExtractor {
  extract(markdown: string): { frontmatter: string; content: string } {
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
}

interface MarkdownNodeStringify {
  canHandle(node: RootContent): boolean;
  stringify(node: RootContent): string;
}

class HeadingStringify implements MarkdownNodeStringify {
  canHandle(node: RootContent): boolean {
    return node.type === "heading";
  }
  stringify(node: RootContent): string {
    const heading = node as Heading;
    let result = "#".repeat(heading.depth) + " ";
    heading.children.forEach((child: RootContent) => {
      if (child.type === "text") result += (child as Text).value;
    });
    return result + "\n\n";
  }
}

class ParagraphStringify implements MarkdownNodeStringify {
  canHandle(node: RootContent): boolean {
    return node.type === "paragraph";
  }
  stringify(node: RootContent): string {
    const paragraph = node as Paragraph;
    let result = "";
    paragraph.children.forEach((child: RootContent) => {
      if (child.type === "text") result += (child as Text).value;
      if (child.type === "strong") {
        const strong = child as Strong;
        result += `**${strong.children
          .map((c: RootContent) => (c.type === "text" ? (c as Text).value : ""))
          .join("")}`;
      }
      if (child.type === "emphasis") {
        const emphasis = child as Emphasis;
        result += `*${emphasis.children
          .map((c: RootContent) => (c.type === "text" ? (c as Text).value : ""))
          .join("")}*`;
      }
    });
    return result + "\n\n";
  }
}

class BlockquoteStringify implements MarkdownNodeStringify {
  canHandle(node: RootContent): boolean {
    return node.type === "blockquote";
  }
  stringify(node: RootContent): string {
    const blockquote = node as Blockquote;
    return (
      blockquote.children
        .map(
          (child: RootContent) =>
            "> " + MarkdownStringifyFactory.stringifyNode(child)
        )
        .join("") + "\n"
    );
  }
}

class ListStringify implements MarkdownNodeStringify {
  canHandle(node: RootContent): boolean {
    return node.type === "list";
  }
  stringify(node: RootContent): string {
    const list = node as List;
    let result = "";
    list.children.forEach((item: RootContent) => {
      if (item.type === "listItem") {
        const listItem = item as ListItem;
        result +=
          (list.ordered ? "1. " : "- ") +
          MarkdownStringifyFactory.stringifyNodes(listItem.children) +
          "\n";
      }
    });
    return result + "\n";
  }
}

class FallbackStringify implements MarkdownNodeStringify {
  canHandle(): boolean {
    return true;
  }
  stringify(node: RootContent): string {
    return JSON.stringify(node) + "\n";
  }
}

class MarkdownStringifyFactory {
  private static stringifys: MarkdownNodeStringify[] = [
    new HeadingStringify(),
    new ParagraphStringify(),
    new BlockquoteStringify(),
    new ListStringify(),
    new FallbackStringify(),
  ];

  static stringifyNode(node: RootContent): string {
    const stringify = this.stringifys.find((s) => s.canHandle(node));
    return stringify ? stringify.stringify(node) : "";
  }

  static stringifyNodes(nodes: RootContent[]): string {
    return nodes.map((node) => this.stringifyNode(node)).join("");
  }
}

class NotebookCellExtractor {
  extractCells(tree: Root): Cell[] {
    const cells: Cell[] = [];
    let cellIndex = 1;
    let markdownBuffer: RootContent[] = [];

    for (const node of tree.children) {
      if (node.type === "code") {
        if (markdownBuffer.length > 0) {
          const md = MarkdownStringifyFactory.stringifyNodes(markdownBuffer);
          cells.push({
            id: `cell-${cellIndex++}`,
            cellType: "markdown",
            source: md,
          });
          markdownBuffer = [];
        }
        cells.push({
          id: `cell-${cellIndex++}`,
          cellType: "code",
          source: (node as Code).value,
        });
        continue;
      }
      if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "blockquote" ||
        node.type === "list"
      ) {
        markdownBuffer.push(node);
        continue;
      }
      if (markdownBuffer.length > 0) {
        const md = MarkdownStringifyFactory.stringifyNodes(markdownBuffer);
        cells.push({
          id: `cell-${cellIndex++}`,
          cellType: "markdown",
          source: md,
        });
        markdownBuffer = [];
      }
    }
    if (markdownBuffer.length > 0) {
      const md = MarkdownStringifyFactory.stringifyNodes(markdownBuffer);
      cells.push({
        id: `cell-${cellIndex++}`,
        cellType: "markdown",
        source: md,
      });
    }
    return cells;
  }
}

class NotebookMarkdownParser {
  private frontmatterExtractor: FrontmatterExtractor;
  private cellExtractor: NotebookCellExtractor;

  constructor() {
    this.frontmatterExtractor = new FrontmatterExtractor();
    this.cellExtractor = new NotebookCellExtractor();
  }

  async parse(markdown: string): Promise<Notebook> {
    const { frontmatter, content } =
      this.frontmatterExtractor.extract(markdown);
    const data = parseYaml(frontmatter) as NotebookMarkdownFrontmatter;
    const tree: Root = fromMarkdown(content);
    const cells = this.cellExtractor.extractCells(tree);
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
}

export const parseNotebookMarkdownToJson = async (
  markdown: string
): Promise<Notebook> => {
  const parser = new NotebookMarkdownParser();
  return parser.parse(markdown);
};

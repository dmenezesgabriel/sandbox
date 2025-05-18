import { useEffect, useState } from "react";
import { Notebook } from "../components/notebook";
import { useNotebooks } from "../contexts/notebooks-context";
import type { Notebook as NotebookType } from "../types";
import { parseNotebookMarkdownToJson } from "../utils/parse-notebook-markdown";

export function Home() {
  const { notebooks, addNotebook } = useNotebooks();
  const [notebook, setNotebook] = useState<NotebookType | null>(null);

  useEffect(() => {
    fetch("/src/data/notebook.md")
      .then((res) => res.text())
      .then(async (md) => {
        const parsed = await parseNotebookMarkdownToJson(md);
        setNotebook(parsed);
        addNotebook(parsed);
      });
  }, [addNotebook]);

  if (!notebook) {
    return <div>Loading notebook...</div>;
  }

  return (
    <div>
      {notebooks.length > 0 ? (
        <Notebook notebook={notebooks[0]} />
      ) : (
        <div>No Notebooks</div>
      )}
    </div>
  );
}

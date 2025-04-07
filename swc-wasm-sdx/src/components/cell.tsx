import { useState } from "react";
import { compile } from "../lib/swc";
import { Iframe } from "./iframe";
import type { Cell } from "../types";
import { useNotebooks } from "../contexts/notebooks-context";

interface CellProps {
  notebookId: string;
  cell: Cell;
}

export function Cell({ notebookId, cell }: CellProps) {
  const { updateNotebookCell } = useNotebooks();
  const [output, setOutput] = useState<string[]>([]);

  const [moduleUrl, setModuleUrl] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newSource = event.target.value;

    updateNotebookCell(notebookId, { ...cell, source: newSource });
  }

  function handleClick() {
    setOutput([]);

    const compiled = compile(cell.source);

    const blob = new Blob([compiled.code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    setModuleUrl(url);
  }

  function handleConsoleLog(...args: unknown[]) {
    setOutput((prev) => [...prev, args.join(" ")]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <button onClick={handleClick}>execute</button>
      <textarea
        value={cell.source}
        cols={10}
        rows={15}
        onChange={handleChange}
      />

      <Iframe scriptUrl={moduleUrl} onConsoleLog={handleConsoleLog} />

      <div style={{ border: "1px solid #cecece" }}>
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

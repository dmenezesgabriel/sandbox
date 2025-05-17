import { useCallback, useState } from "react";
import { compile } from "../lib/swc";
import { Iframe } from "./iframe";
import type { Cell } from "../types";
import { useNotebooks } from "../contexts/notebooks-context";
import { useRuntime } from "../contexts/runtime-context";

interface CellProps {
  notebookId: string;
  cell: Cell;
}

export function Cell({ notebookId, cell }: CellProps) {
  const { updateNotebookCell } = useNotebooks();
  const { runtime } = useRuntime();
  const [output, setOutput] = useState<string[]>([]);
  const [moduleUrl, setModuleUrl] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newSource = event.target.value;

    updateNotebookCell(notebookId, { ...cell, source: newSource });
  }

  function handleClick() {
    setOutput([]);

    const compiled = compile(cell.source);
    const module = runtime.module;

    compiled.declarations.forEach((decl) => {
      module.addDeclaration(decl);
    });

    const blob = new Blob([compiled.code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    setModuleUrl(url);
  }

  const handleConsoleLog = useCallback((...args: unknown[]) => {
    setOutput((prev) => [...prev, args.join(" ")]);
  }, []);

  const handleIframeLoad = useCallback(
    (iframe: HTMLIFrameElement) => {
      const iframeWindow = iframe.contentWindow;
      const module = runtime.module;

      module.assignObjects(iframeWindow!);
    },
    [runtime.module]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <button onClick={handleClick}>execute</button>
      <textarea
        value={cell.source}
        cols={10}
        rows={15}
        onChange={handleChange}
      />

      <Iframe
        scriptUrl={moduleUrl}
        onConsoleLog={handleConsoleLog}
        onIframeLoad={handleIframeLoad}
      />

      <div style={{ border: "1px solid #cecece" }}>
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

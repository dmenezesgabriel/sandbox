import { useCallback, useState } from "react";
import { compile } from "../lib/swc";
import { Iframe } from "./iframe";
import { CodeEditor } from "./code-editor";
import type { Cell } from "../types";
import { useNotebooks } from "../contexts/notebooks-context";
import { useRuntime } from "../contexts/runtime-context";
import styles from "./cell.module.css";

interface CodeCellProps {
  notebookId: string;
  cell: Cell;
}

export function CodeCell({ notebookId, cell }: CodeCellProps) {
  const { updateNotebookCell } = useNotebooks();
  const { runtime } = useRuntime();
  const [output, setOutput] = useState<string[]>([]);
  const [moduleUrl, setModuleUrl] = useState<string | null>(null);

  function handleCodeChange(newSource: string) {
    updateNotebookCell(notebookId, { ...cell, source: newSource });
  }

  function handleClick() {
    setOutput([]);

    const compiled = compile(cell.source);
    const module = runtime.module;

    compiled.declarations.forEach((decl) => {
      module.addDeclaration(cell.id, decl);
    });

    const fullCode = module.generateModuleCode(compiled.code, cell.id);
    const blob = new Blob([fullCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    setModuleUrl(url);

    console.log(module.declarations[cell.id]);
  }

  const handleConsoleLog = useCallback((...args: unknown[]) => {
    setOutput((prev) => [...prev, args.join(" ")]);
  }, []);

  return (
    <div className={styles.cell}>
      <button className={styles.cell__button} onClick={handleClick}>
        execute
      </button>

      <CodeEditor
        value={cell.source}
        language={"typescript"}
        onChange={handleCodeChange}
        wordWrap={true}
        maxHeight="300px"
      />

      <Iframe scriptUrl={moduleUrl} onConsoleLog={handleConsoleLog} />

      <div className={styles.cell__output}>
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

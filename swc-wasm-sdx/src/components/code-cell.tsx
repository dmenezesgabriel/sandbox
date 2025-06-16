import { useCallback, useState, forwardRef, useImperativeHandle } from "react";
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

export interface CodeCellHandle {
  execute: () => void;
}

export const CodeCell = forwardRef<CodeCellHandle, CodeCellProps>(
  ({ notebookId, cell }, ref) => {
    const { updateNotebookCell } = useNotebooks();
    const { runtime } = useRuntime();
    const [output, setOutput] = useState<string[]>([]);
    const [moduleUrl, setModuleUrl] = useState<string | null>(null);

    function handleCodeChange(newSource: string) {
      updateNotebookCell(notebookId, { ...cell, source: newSource });
    }

    function execute() {
      setOutput([]);

      const compiled = compile(cell.source);
      const module = runtime.module;

      compiled.declarations.forEach((decl) => {
        module.addDeclaration(cell.id, decl);
      });

      module.addStatements(cell.id, compiled.statements);

      const fullCode = module.generateModuleCode(cell.id);
      const blob = new Blob([fullCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);

      setModuleUrl(url);
    }

    useImperativeHandle(ref, () => ({
      execute,
    }));

    const handleConsoleLog = useCallback((...args: unknown[]) => {
      setOutput((prev) => [...prev, args.join(" ")]);
    }, []);

    return (
      <div className={styles.cell}>
        <button className={styles.cell__button} onClick={execute}>
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
);

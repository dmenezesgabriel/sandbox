import { FC, useCallback } from "react";
import { Cell } from "../types";
import styles from "./add-cell-controls.module.css";

export interface AddCellControlsProps {
  notebookId: string;
  cells: Cell[];
  onAddCell: (notebookId: string, cell: Cell) => void;
}

export const AddCellControls: FC<AddCellControlsProps> = ({
  notebookId,
  cells,
  onAddCell,
}) => {
  const getNextCellId = useCallback((): string => {
    const ids = cells.map((cell) => {
      const match = cell.id.match(/cell-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    return `cell-${Math.max(0, ...ids) + 1}`;
  }, [cells]);

  const handleAddCell = useCallback(
    (cellType: "code" | "markdown") => {
      const newCell: Cell = {
        id: getNextCellId(),
        cellType,
        source: "",
      };
      onAddCell(notebookId, newCell);
    },
    [getNextCellId, notebookId, onAddCell]
  );

  return (
    <div className={styles.addCellDivider}>
      <span className={styles.dividerLineSmall} />
      <button
        className={styles.addCellButton}
        onClick={() => handleAddCell("code")}
        type="button"
      >
        + code cell
      </button>
      <span className={styles.dividerLineSmall} />
      <button
        className={styles.addCellButton}
        onClick={() => handleAddCell("markdown")}
        type="button"
      >
        + markdown cell
      </button>
      <span className={styles.dividerLineSmall} />
    </div>
  );
};

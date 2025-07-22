import React from "react";
import { useQueryContext } from "../context/QueryContext";

interface DataTableProps {
  queryId: string;
  title?: string;
  maxRows?: number;
}

export const DataTable: React.FC<DataTableProps> = React.memo(
  ({ queryId, title, maxRows = 10 }) => {
    const { getQueryResult } = useQueryContext();
    const result = getQueryResult(queryId);

    if (!result) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-500">
            No data available for query: {queryId}
          </p>
        </div>
      );
    }

    const displayRows = result.rows.slice(0, maxRows);
    const hasMoreRows = result.rows.length > maxRows;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden my-4">
        {title && (
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">
              {result.rowCount} rows{" "}
              {hasMoreRows && `(showing first ${maxRows})`}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {result.columns.map((column, index) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {cell !== null && cell !== undefined ? String(cell) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

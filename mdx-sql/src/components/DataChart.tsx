import React from "react";
import { useQueryContext } from "../context/QueryContext";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";

interface DataChartProps {
  queryId: string;
  type: "bar" | "line";
  xField: string;
  yField: string;
  title?: string;
  height?: number;
}

export const DataChart: React.FC<DataChartProps> = React.memo(
  ({ queryId, type, xField, yField, title, height = 300 }) => {
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

    // Transform data for recharts
    const data = result.rows.map((row) => {
      const item: Record<string, number | string | null> = {};
      result.columns.forEach((column, index) => {
        const value = row[index];
        if (value !== null && value !== undefined) {
          const numValue = Number(value);
          if (!isNaN(numValue) && isFinite(numValue)) {
            item[column] = numValue;
          } else {
            item[column] = value;
          }
        } else {
          item[column] = null;
        }
      });
      return item;
    });

    if (!result.columns.includes(xField) || !result.columns.includes(yField)) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">
            Invalid fields: {xField} or {yField} not found in query results
          </p>
          <p className="text-sm text-red-500 mt-1">
            Available fields: {result.columns.join(", ")}
          </p>
          <p className="text-sm text-red-500 mt-1">
            Sample data: {JSON.stringify(data.slice(0, 2), null, 2)}
          </p>
        </div>
      );
    }

    // Debug: Log the transformed data
    console.log("Chart data for", queryId, ":", data);
    console.log("X field:", xField, "Y field:", yField);
    console.log(
      "Sample Y values:",
      data
        .slice(0, 3)
        .map((d) => ({ value: d[yField], type: typeof d[yField] }))
    );

    return type === "bar" ? (
      <BarChart
        data={data}
        xField={xField}
        yField={yField}
        height={height}
        title={title}
      />
    ) : (
      <LineChart
        data={data}
        xField={xField}
        yField={yField}
        height={height}
        title={title}
      />
    );
  }
);

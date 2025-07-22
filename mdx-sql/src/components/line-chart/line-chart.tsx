import React from "react";
import {
  LineChart as LineChartBase,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LineChartProps {
  data: Array<Record<string, number | string | null>>;
  xField: string;
  yField: string;
  height: number;
  title?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  xField,
  yField,
  height,
  title,
}) => (
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 my-4">
    {title && (
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    )}
    <ResponsiveContainer width="100%" height={height}>
      <LineChartBase data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} type="category" />
        <YAxis type="number" domain={["dataMin", "dataMax"]} />
        <Tooltip />
        <Legend />
        <Line
          dataKey={yField}
          stroke="#3b82f6"
          fill="#3b82f6"
          strokeWidth={2}
          type="monotone"
        />
      </LineChartBase>
    </ResponsiveContainer>
  </div>
);

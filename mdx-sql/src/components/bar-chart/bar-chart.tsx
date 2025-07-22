import React from "react";
import {
  BarChart as BarChartBase,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BarChartProps {
  data: Array<Record<string, number | string | null>>;
  xField: string;
  yField: string;
  height: number;
  title?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
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
      <BarChartBase data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} type="category" />
        <YAxis type="number" domain={["dataMin", "dataMax"]} />
        <Tooltip />
        <Legend />
        <Bar dataKey={yField} stroke="#3b82f6" fill="#3b82f6" />
      </BarChartBase>
    </ResponsiveContainer>
  </div>
);

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "./bar-chart";
import React from "react";

const meta = {
  title: "Components/BarChart",
  component: BarChart,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ width: "100%", maxWidth: "800px" }}>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
  argTypes: {
    data: { control: "object" },
    xField: { control: "text" },
    yField: { control: "text" },
    height: { control: "number" },
    title: { control: "text" },
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { month: "Jan", sales: 4000 },
      { month: "Feb", sales: 3000 },
      { month: "Mar", sales: 2000 },
      { month: "Apr", sales: 2780 },
      { month: "May", sales: 1890 },
      { month: "Jun", sales: 2390 },
    ],
    xField: "month",
    yField: "sales",
    height: 400,
    title: "Monthly Sales",
  },
};

export const WithoutTitle: Story = {
  args: {
    data: [
      { month: "Jan", sales: 4000 },
      { month: "Feb", sales: 3000 },
      { month: "Mar", sales: 2000 },
      { month: "Apr", sales: 2780 },
      { month: "May", sales: 1890 },
      { month: "Jun", sales: 2390 },
    ],
    xField: "month",
    yField: "sales",
    height: 400,
  },
};

export const CustomHeight: Story = {
  args: {
    data: [
      { month: "Jan", sales: 4000 },
      { month: "Feb", sales: 3000 },
      { month: "Mar", sales: 2000 },
      { month: "Apr", sales: 2780 },
      { month: "May", sales: 1890 },
      { month: "Jun", sales: 2390 },
    ],
    xField: "month",
    yField: "sales",
    height: 200,
    title: "Compact View",
  },
};

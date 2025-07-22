import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart } from "./line-chart";
import React from "react";

const meta = {
  title: "Components/LineChart",
  component: LineChart,
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
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { month: "Jan", value: 1000 },
      { month: "Feb", value: 2000 },
      { month: "Mar", value: 1500 },
      { month: "Apr", value: 3000 },
      { month: "May", value: 2500 },
      { month: "Jun", value: 4000 },
    ],
    xField: "month",
    yField: "value",
    height: 400,
    title: "Monthly Trend",
  },
};

export const WithoutTitle: Story = {
  args: {
    data: [
      { month: "Jan", value: 1000 },
      { month: "Feb", value: 2000 },
      { month: "Mar", value: 1500 },
      { month: "Apr", value: 3000 },
      { month: "May", value: 2500 },
      { month: "Jun", value: 4000 },
    ],
    xField: "month",
    yField: "value",
    height: 400,
  },
};

export const CustomHeight: Story = {
  args: {
    data: [
      { month: "Jan", value: 1000 },
      { month: "Feb", value: 2000 },
      { month: "Mar", value: 1500 },
      { month: "Apr", value: 3000 },
      { month: "May", value: 2500 },
      { month: "Jun", value: 4000 },
    ],
    xField: "month",
    yField: "value",
    height: 200,
    title: "Compact View",
  },
};

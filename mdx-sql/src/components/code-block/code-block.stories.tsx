import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./code-block";
import React from "react";

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
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
    code: { control: "text" },
    lang: { control: "text" },
    initial: { control: "text" },
    defaultOpen: { control: "boolean" },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    code: `SELECT * FROM users WHERE age > 30;`,
    lang: "sql",
    initial: <span>Loading...</span>,
    defaultOpen: true,
  },
};

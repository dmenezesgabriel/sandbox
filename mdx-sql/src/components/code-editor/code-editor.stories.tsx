import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeEditor } from "./code-editor";
import React from "react";

const meta = {
  title: "Components/CodeEditor",
  component: CodeEditor,
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
    value: { control: "text" },
    onChange: { action: "changed" },
    wordWrap: { control: "boolean" },
    maxHeight: { control: "text" },
    theme: { control: "select", options: ["light", "dark"] },
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: `# Hello, World!
    `,
    wordWrap: true,
    onChange: (value) => console.log(value),
    maxHeight: "500px",
    theme: "dark",
  },
};

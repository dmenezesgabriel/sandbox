import type { Meta, StoryObj } from "@storybook/react";

import { fn } from "@storybook/test";
import { Task } from "./task";

export const ActionsData = {
  onArchiveTask: fn(),
  onPinTask: fn(),
};

const meta = {
  component: Task, // the component itself
  title: "Task", // how to group or categorize the component in the Storybook sidebar
  tags: ["autodocs"], // to automatically generate documentation for our components
  excludeStories: /.*Data$/, // additional information required by the story but should not be rendered in Storybook
  args: {
    ...ActionsData, // define the action args that the component expects to mock out the custom events
  },
} satisfies Meta<typeof Task>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    task: {
      id: "1",
      title: "Test Task",
      state: "TASK_INBOX",
    },
  },
};

export const Pinned: Story = {
  args: {
    task: {
      ...Default.args.task,
      state: "TASK_PINNED",
    },
  },
};

export const Archived: Story = {
  args: {
    task: {
      ...Default.args.task,
      state: "TASK_ARCHIVED",
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react";

import { InboxScreen } from "./inbox-screen";

import { store } from "../../lib/store";

import { Provider } from "react-redux";

import {
  fireEvent,
  waitFor,
  within,
  waitForElementToBeRemoved,
} from "@storybook/test";
import {
  getTodosErrorHandler,
  getTodosSuccessHandler,
} from "../../mocks/handlers";

const meta = {
  component: InboxScreen,
  title: "InboxScreen",
  decorators: [(story) => <Provider store={store}>{story()}</Provider>],
  // tags: ["autodocs"], // Storybook Docs leak msw handlers between stories on docs
} satisfies Meta<typeof InboxScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [getTodosSuccessHandler()],
    },
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitForElementToBeRemoved(await canvas.findAllByTestId("loading"));

    await waitFor(async () => {
      await fireEvent.click(canvas.getByLabelText("pinTask-1"));
      await fireEvent.click(canvas.getByLabelText("pinTask-3"));
    });
  },
};

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [getTodosErrorHandler()],
    },
  },
};

import {
  screen,
  render,
  waitFor,
  cleanup,
  // within,
  // fireEvent,
} from "@testing-library/react";
import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
// import { axe } from "vitest-axe";
import { composeStories } from "@storybook/react";
import { server } from "../../mocks/server";

import * as stories from "./inbox-screen.stories";

import {
  getTodosErrorHandler,
  getTodosSuccessHandler,
} from "../../mocks/handlers";

describe("InboxScreen", () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  const { Default, Error } = composeStories(stories);

  it("should render without crashing", async () => {
    server.use(getTodosSuccessHandler());

    render(<Default />);

    await waitFor(() => {
      expect(screen.getByText("Taskbox")).toBeInTheDocument();
    });
  });

  it("should display error state when API fails", async () => {
    server.use(getTodosErrorHandler());

    render(<Error />);

    await waitFor(() => {
      expect(screen.getByText("Oh no!")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});

import * as matchers from "vitest-axe/matchers";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

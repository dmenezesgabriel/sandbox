import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  core: {
    disableTelemetry: true,
  },
  staticDirs: ["../public"],
  addons: [
    "@storybook/addon-essentials",
    // "@storybook/addon-onboarding",
    "@chromatic-com/storybook",
    // "@storybook/experimental-addon-test",
    "@storybook/addon-interactions",
    "@storybook/addon-links",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: (config) => {
    config.optimizeDeps = {
      ...(config.optimizeDeps || {}),
      exclude: ["@storybook/addon-docs"],
    };

    return config;
  },
};

export default config;

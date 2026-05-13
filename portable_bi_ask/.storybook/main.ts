import { fileURLToPath, URL } from 'node:url';
import type { StorybookConfig } from '@storybook/web-components-vite';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/web-components-vite',
  viteFinal: async (config) => {
    config.resolve ??= {};
    const existingAliases = Array.isArray(config.resolve.alias)
      ? config.resolve.alias
      : Object.entries((config.resolve.alias as Record<string, string>) ?? {}).map(
          ([find, replacement]) => ({ find, replacement }),
        );
    config.resolve.alias = [
      ...existingAliases,
      { find: 'chrono-node/en', replacement: root('../src/shims/chrono-node/en.ts') },
      { find: 'chrono-node/pt', replacement: root('../src/shims/chrono-node/pt.ts') },
    ];
    // Suppress "unable to find package.json" warnings for packages that ship
    // non-standard layouts or are only used in tests/server code.
    config.optimizeDeps ??= {};
    config.optimizeDeps.exclude = [
      ...(config.optimizeDeps.exclude ?? []),
      'chrono-node',
      'apache-arrow',
    ];
    return config;
  },
};
export default config;

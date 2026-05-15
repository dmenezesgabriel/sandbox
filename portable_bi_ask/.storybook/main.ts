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
      { find: 'chrono-node/en', replacement: root('../src/infra/shims/chrono-node/en.ts') },
      { find: 'chrono-node/pt', replacement: root('../src/infra/shims/chrono-node/pt.ts') },
    ];
    // Suppress "unable to find package.json" warnings for packages that ship
    // non-standard layouts or are only used in tests/server code.
    config.optimizeDeps ??= {};
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include ?? []),
      'lit/directives/if-defined.js',
      // dayjs and its plugins ship only CJS; force pre-bundling so Vite converts them to ESM.
      // chrono-node's ESM build does `import default from "dayjs/plugin/quarterOfYear.js"`, which
      // fails if the plugin is served raw as CJS (no `export default`).
      'dayjs',
      'dayjs/plugin/quarterOfYear',
      'dayjs/plugin/quarterOfYear.js',
    ];
    config.optimizeDeps.exclude = [
      ...(config.optimizeDeps.exclude ?? []),
      'chrono-node',
      'apache-arrow',
    ];
    return config;
  },
};
export default config;

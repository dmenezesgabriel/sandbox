import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/components/**/*.ts'],
      exclude: ['**/*.stories.ts', '**/index.ts'],
      watermarks: {
        statements: [50, 80],
        branches: [50, 80],
        functions: [50, 80],
        lines: [50, 80],
      },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: 'node',
          include: ['src/**/*.spec.ts', 'tests/integration/**/*.test.ts'],
          exclude: ['src/components/**/*.spec.ts'],
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['src/components/**/*.spec.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});

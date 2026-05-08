import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'chrono-node/en': root('./node_modules/chrono-node/dist/esm/locales/en/index.js'),
      'chrono-node/pt': root('./node_modules/chrono-node/dist/esm/locales/pt/index.js'),
    },
  },
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
});

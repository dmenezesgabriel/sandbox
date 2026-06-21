import { defineConfig } from 'vite'
import { resolve } from 'path'

// Minimal browser shims for packages that import node: built-ins
// (memfs internals pull in these — we intercept so the Worker bundle stays self-contained)
const nodeBuiltinShims: Record<string, string> = {
  'node:buffer': resolve(__dirname, 'src/shim-stubs/buffer.ts'),
  'node:path': resolve(__dirname, 'src/shim-stubs/path-stub.ts'),
  'node:events': resolve(__dirname, 'src/shim-stubs/events-stub.ts'),
  'node:stream': resolve(__dirname, 'src/shim-stubs/stream-stub.ts'),
  'node:process': resolve(__dirname, 'src/shim-stubs/process-stub.ts'),
  'node:url': resolve(__dirname, 'src/shim-stubs/url-stub.ts'),
  'node:fs': resolve(__dirname, 'src/shim-stubs/empty.ts'),
  'node:crypto': resolve(__dirname, 'src/shim-stubs/empty.ts'),
  'node:util': resolve(__dirname, 'src/shim-stubs/empty.ts'),
  url: resolve(__dirname, 'src/shim-stubs/url-stub.ts'),
  process: resolve(__dirname, 'src/shim-stubs/process-stub.ts'),
}

export default defineConfig({
  root: '.',
  resolve: { alias: nodeBuiltinShims },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: 'src/sw/index.ts',
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['esbuild-wasm'],
  },
})

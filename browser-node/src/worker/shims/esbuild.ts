// esbuild shim backed by esbuild-wasm — intercepts require('esbuild') from Vite
// so Vite's transform/bundling calls go through the WASM build instead of native binary.
import { initBuild } from '../build'
import * as esbuildWasm from 'esbuild-wasm'

export const version: string = (esbuildWasm as unknown as Record<string, unknown>).version as string ?? '0.21.5'

let _init: Promise<void> | null = null
function ensureInit(): Promise<void> {
  if (!_init) _init = initBuild()
  return _init
}

export async function transform(
  input: string,
  options?: Record<string, unknown>
): Promise<{ code: string; map: string; warnings: unknown[] }> {
  await ensureInit()
  const result = await esbuildWasm.transform(input, options as Parameters<typeof esbuildWasm.transform>[1])
  return result
}

export async function build(
  options?: Record<string, unknown>
): Promise<{ errors: unknown[]; warnings: unknown[]; outputFiles?: unknown[]; metafile?: unknown }> {
  await ensureInit()
  const result = await esbuildWasm.build(options as Parameters<typeof esbuildWasm.build>[0])
  return result as unknown as { errors: unknown[]; warnings: unknown[]; outputFiles?: unknown[]; metafile?: unknown }
}

export async function context(options?: Record<string, unknown>) {
  await ensureInit()
  if (typeof (esbuildWasm as unknown as Record<string, unknown>).context === 'function') {
    return (esbuildWasm as unknown as Record<string, (...a: unknown[]) => unknown>).context(options)
  }
  // Fallback for older esbuild-wasm builds
  return {
    rebuild: () => build(options),
    watch: async () => {},
    dispose: async () => {},
    cancel: async () => {},
    serve: async () => ({ host: 'localhost', port: 0, stop: () => {} }),
  }
}

export function stop(): void {}

export const formatMessages = (msgs: unknown[], opts: unknown) =>
  Promise.resolve((msgs as string[]).map(String))

export const analyzeMetafile = (_meta: unknown, _opts?: unknown) =>
  Promise.resolve('')

export const initialize = async (opts?: unknown) => {
  await ensureInit()
}

// CommonJS-style default export shape so `const esbuild = require('esbuild')` works
const esbuildShim = {
  version,
  transform,
  build,
  context,
  stop,
  formatMessages,
  analyzeMetafile,
  initialize,
  default: undefined as unknown,
}
esbuildShim.default = esbuildShim
export default esbuildShim

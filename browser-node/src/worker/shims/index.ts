import { Buffer } from 'buffer'
import { process } from './process'
import { path } from './path'
import { EventEmitter } from './events'
import { Readable, Writable, Transform, PassThrough, Stream } from './stream'
import defaultStream from './stream'
import { util } from './util'
import { os } from './os'
import { crypto } from './crypto'
import { http, https } from './http'
import { fs, fsPromises } from './fs'
import esbuildShim from './esbuild'
import chokidarShim from './chokidar'
import connectDefault, { createServer as connectCreateServer } from './connect'
import sirvDefault from './sirv'
export { process } from './process'
export { path } from './path'
export { EventEmitter } from './events'
export { Readable, Writable, Transform, PassThrough, Stream } from './stream'
export { util } from './util'
export { os } from './os'
export { crypto } from './crypto'
export { http, https } from './http'
export { getServer } from './http'
export { fs, fsPromises } from './fs'

function _fileURLToPath(url: string | URL): string {
  const u = typeof url === 'string' ? new URL(url) : url
  if (u.protocol !== 'file:') throw new TypeError(`Not a file URL: ${u.href}`)
  return decodeURIComponent(u.pathname)
}
function _pathToFileURL(p: string): URL {
  return new URL('file://' + (p.startsWith('/') ? p : '/' + p))
}
const _url = {
  URL,
  URLSearchParams,
  parse: (u: string) => new URL(u),
  format: (u: URL | string) => typeof u === 'string' ? u : u.href,
  fileURLToPath: _fileURLToPath,
  pathToFileURL: _pathToFileURL,
}
const _buffer = { Buffer, default: Buffer }
const _events = { EventEmitter, default: EventEmitter }
const _querystring = {
  stringify: (obj: Record<string, string>) => new URLSearchParams(obj).toString(),
  parse: (s: string) => Object.fromEntries(new URLSearchParams(s)),
}
const _assert = {
  default: (val: unknown, msg?: string) => { if (!val) throw new Error(msg ?? 'Assertion failed') },
  strictEqual: (a: unknown, b: unknown, msg?: string) => { if (a !== b) throw new Error(msg ?? `${a} !== ${b}`) },
  deepStrictEqual: (a: unknown, b: unknown, msg?: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg ?? 'Not deep equal') },
  ok: (val: unknown, msg?: string) => { if (!val) throw new Error(msg ?? 'Assertion failed') },
  throws: (fn: () => void, msg?: string) => { try { fn(); throw new Error(msg ?? 'Expected to throw') } catch {} },
}
const _timers = { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate: (fn: () => void) => setTimeout(fn, 0) }
const _childProcess = {
  exec: (_cmd: string, cb?: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    cb?.(new Error('child_process.exec not supported in browser'))
    return { on: () => {}, kill: () => {}, stdin: null, stdout: null, stderr: null }
  },
  execFile: (_file: string, _args?: unknown, _opts?: unknown, cb?: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    const callback = typeof _opts === 'function' ? _opts as typeof cb : typeof _args === 'function' ? _args as typeof cb : cb
    callback?.(new Error('child_process.execFile not supported in browser'))
    return { on: () => {}, kill: () => {}, stdin: null, stdout: null, stderr: null }
  },
  execSync: (_cmd: string) => { throw new Error('child_process.execSync not supported in browser') },
  spawn: (_cmd: string, _args?: string[], _opts?: unknown) => {
    const ee = { on: () => ee, emit: () => false, stdout: { on: () => {} }, stderr: { on: () => {} }, stdin: { write: () => {}, end: () => {} }, kill: () => {} }
    return ee
  },
  spawnSync: (_cmd: string) => ({ status: 1, stdout: '', stderr: 'not supported', error: new Error('not supported') }),
  fork: () => { throw new Error('child_process.fork not supported in browser') },
}
const _net = {
  createServer: () => ({ listen: () => {}, close: () => {}, on: () => {} }),
  connect: () => { throw new Error('net.connect not supported in browser') },
  Socket: class Socket { on() { return this } write() {} end() {} destroy() {} },
  isIP: () => 0,
  isIPv4: () => false,
  isIPv6: () => false,
}
const _tty = {
  isatty: () => false,
  ReadStream: class {},
  WriteStream: class { columns = 80; rows = 24; isTTY = false },
}
const _readline = {
  createInterface: () => ({ on: () => {}, close: () => {}, question: (_q: string, cb: (a: string) => void) => cb('') }),
}
const _zlib = {
  gzip: (_buf: Uint8Array, cb: (e: Error | null, r?: Uint8Array) => void) => cb(null, _buf),
  gunzip: (_buf: Uint8Array, cb: (e: Error | null, r?: Uint8Array) => void) => cb(null, _buf),
  createGzip: () => ({ on: () => {}, pipe: (d: unknown) => d }),
  createGunzip: () => ({ on: () => {}, pipe: (d: unknown) => d }),
}
const _dns = {
  lookup: (_host: string, cb: (err: null, addr: string) => void) => cb(null, '127.0.0.1'),
  resolve: (_host: string, cb: (err: null, addrs: string[]) => void) => cb(null, ['127.0.0.1']),
  promises: {
    lookup: (_host: string) => Promise.resolve({ address: '127.0.0.1', family: 4 }),
    resolve: (_host: string) => Promise.resolve(['127.0.0.1']),
    resolve4: (_host: string) => Promise.resolve(['127.0.0.1']),
    resolve6: (_host: string) => Promise.resolve([]),
  },
}
const _workerThreads = {
  isMainThread: true,
  Worker: class { constructor() { throw new Error('worker_threads not supported') } },
  MessageChannel: class {
    port1: { postMessage: () => {}, on: () => {}, off: () => {}, close: () => {}, addEventListener: () => {}, removeEventListener: () => {}, start: () => {} }
    port2: { postMessage: () => {}, on: () => {}, off: () => {}, close: () => {}, addEventListener: () => {}, removeEventListener: () => {}, start: () => {} }
    constructor() {
      this.port1 = { postMessage: () => {}, on: () => {}, off: () => {}, close: () => {}, addEventListener: () => {}, removeEventListener: () => {}, start: () => {} }
      this.port2 = { postMessage: () => {}, on: () => {}, off: () => {}, close: () => {}, addEventListener: () => {}, removeEventListener: () => {}, start: () => {} }
    }
  },
  receiveMessageOnPort: () => undefined,
  parentPort: null,
  workerData: null,
  threadId: 0,
  SHARE_ENV: Symbol('SHARE_ENV'),
}

// v8 stub — only startupSnapshot.isBuildingSnapshot() is called in Vite
const _v8 = {
  startupSnapshot: { isBuildingSnapshot: () => false, addSerializeCallback: () => {}, addDeserializeCallback: () => {}, setDeserializeMainFunction: () => {} },
  getHeapStatistics: () => ({ total_heap_size: 0, used_heap_size: 0 }),
  writeHeapSnapshot: () => '',
  default: undefined as unknown,
}
_v8.default = _v8

// rolldown subpath stubs — build-only APIs; dev server doesn't invoke them at startup
const _notSupported = (name: string) => () => { throw new Error(`${name} is not supported in browser; use vite dev server only`) }
const _asyncNotSupported = (name: string) => () => Promise.reject(new Error(`${name} is not supported in browser`))
const _rolldownParseAst = {
  parseAst: _notSupported('parseAst'),
  parseAstAsync: _asyncNotSupported('parseAstAsync'),
  default: undefined as unknown,
}
_rolldownParseAst.default = _rolldownParseAst

class _TsconfigCache { constructor() {} }
class _Visitor { constructor() {} }
const _rolldownUtils = {
  TsconfigCache: _TsconfigCache,
  Visitor: _Visitor,
  minify: _asyncNotSupported('rolldown/utils.minify'),
  minifySync: _notSupported('rolldown/utils.minifySync'),
  parse: _notSupported('rolldown/utils.parse'),
  parseSync: _notSupported('rolldown/utils.parseSync'),
  transformSync: _notSupported('rolldown/utils.transformSync'),
  transform: _asyncNotSupported('rolldown/utils.transform'),
  resolveTsconfig: _notSupported('rolldown/utils.resolveTsconfig'),
  default: undefined as unknown,
}
_rolldownUtils.default = _rolldownUtils

const _pluginStub = () => ({ name: 'stub-plugin', transform: undefined, resolveId: undefined })
const _rolldownPlugins = {
  esmExternalRequirePlugin: _pluginStub,
  default: undefined as unknown,
}
_rolldownPlugins.default = _rolldownPlugins

const _rolldownFilter = {
  exactRegex: (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  prefixRegex: (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  makeIdFiltersToMatchWithQuery: () => ({ include: undefined, exclude: undefined }),
  withFilter: (_plugin: unknown, _filter: unknown) => _plugin,
  default: undefined as unknown,
}
_rolldownFilter.default = _rolldownFilter

const _experimentalPluginStub = (name: string) => () => ({ name, transform: undefined })
const _rolldownExperimental = {
  dev: _experimentalPluginStub('rolldown-dev'),
  oxcRuntimePlugin: _experimentalPluginStub('oxc-runtime'),
  resolveTsconfig: _notSupported('rolldown/experimental.resolveTsconfig'),
  scan: _experimentalPluginStub('rolldown-scan'),
  viteAliasPlugin: _experimentalPluginStub('vite-alias'),
  viteBuildImportAnalysisPlugin: _experimentalPluginStub('vite-build-import-analysis'),
  viteDynamicImportVarsPlugin: _experimentalPluginStub('vite-dynamic-import-vars'),
  viteImportGlobPlugin: _experimentalPluginStub('vite-import-glob'),
  viteJsonPlugin: _experimentalPluginStub('vite-json'),
  viteLoadFallbackPlugin: _experimentalPluginStub('vite-load-fallback'),
  viteManifestPlugin: _experimentalPluginStub('vite-manifest'),
  viteModulePreloadPolyfillPlugin: _experimentalPluginStub('vite-module-preload-polyfill'),
  viteReporterPlugin: _experimentalPluginStub('vite-reporter'),
  viteResolvePlugin: _experimentalPluginStub('vite-resolve'),
  viteTransformPlugin: _experimentalPluginStub('vite-transform'),
  viteWasmFallbackPlugin: _experimentalPluginStub('vite-wasm-fallback'),
  viteWebWorkerPostPlugin: _experimentalPluginStub('vite-web-worker-post'),
  default: undefined as unknown,
}
_rolldownExperimental.default = _rolldownExperimental

// rollup/rolldown stub — allows Vite to import them at startup without crashing.
// Actual bundling (vite build) will throw; the dev server does not use rollup/rolldown.
const _notSupportedBundle = () => Promise.reject(new Error('bundler is not supported in browser; use vite dev server only'))
const _rollupBundle = {
  rollup: _notSupportedBundle,
  rolldown: _notSupportedBundle,
  watch: () => { throw new Error('rollup/rolldown.watch is not supported in browser') },
  defineConfig: (cfg: unknown) => cfg,
  VERSION: '4.34.0',
  version: '4.34.0',
  default: undefined as unknown,
}
_rollupBundle.default = _rollupBundle

// picocolors stub for packages that import it outside Vite's bundle
const _picocolors = {
  isColorSupported: false,
  reset: (s: string) => s, bold: (s: string) => s, dim: (s: string) => s,
  italic: (s: string) => s, underline: (s: string) => s, inverse: (s: string) => s,
  hidden: (s: string) => s, strikethrough: (s: string) => s,
  black: (s: string) => s, red: (s: string) => s, green: (s: string) => s,
  yellow: (s: string) => s, blue: (s: string) => s, magenta: (s: string) => s,
  cyan: (s: string) => s, white: (s: string) => s, gray: (s: string) => s,
  bgBlack: (s: string) => s, bgRed: (s: string) => s, bgGreen: (s: string) => s,
  bgYellow: (s: string) => s, bgBlue: (s: string) => s, bgMagenta: (s: string) => s,
  bgCyan: (s: string) => s, bgWhite: (s: string) => s,
  default: undefined as unknown,
}
_picocolors.default = _picocolors

// connect's default export IS the factory function; attach extra props so named imports work
const _connectFn = connectDefault as typeof connectDefault & { default: unknown; createServer: typeof connectCreateServer }
_connectFn.default = _connectFn
_connectFn.createServer = connectCreateServer
const _connectShim = _connectFn

// sirv's default export is the middleware factory; attach named export alias
const _sirvFn = sirvDefault as typeof sirvDefault & { default: unknown; sirv: typeof sirvDefault }
_sirvFn.default = _sirvFn
_sirvFn.sirv = _sirvFn
const _sirvShim = _sirvFn

// Late-bound reference to requireSync (set by worker/index.ts to avoid circular deps)
let _requireSync: (spec: string, fromDir: string) => unknown = () => undefined

export function bindRequireSync(fn: (spec: string, fromDir: string) => unknown) {
  _requireSync = fn
}

const _builtinModules = [
  'fs', 'path', 'http', 'https', 'events', 'stream', 'util', 'os', 'crypto',
  'buffer', 'url', 'querystring', 'assert', 'timers', 'readline', 'zlib',
  'dns', 'net', 'tty', 'child_process', 'worker_threads', 'string_decoder',
  'perf_hooks', 'cluster', 'module',
]

class _Module {
  id: string; filename: string; exports: Record<string, unknown>
  constructor(id: string) { this.id = id; this.filename = id; this.exports = {} }
  static _resolveFilename(id: string) { return id }
  static _extensions: Record<string, unknown> = {}
  static _cache: Record<string, unknown> = {}
  static builtinModules = _builtinModules
  static createRequire(base: string) { return _moduleShim.createRequire(base) }
}

const _moduleShim = {
  createRequire: (base: string) => {
    const fromDir = typeof base === 'string' && base.startsWith('file://')
      ? decodeURIComponent(new URL(base).pathname).replace(/\/[^/]+$/, '')
      : typeof base === 'string'
      ? base.replace(/\/[^/]+$/, '')
      : '/app'
    const req = (spec: string) => _requireSync(spec, fromDir)
    req.resolve = (spec: string) => spec
    req.cache = {} as Record<string, unknown>
    req.extensions = {} as Record<string, unknown>
    req.main = undefined
    return req
  },
  Module: _Module,
  builtinModules: _builtinModules,
  default: undefined as unknown,
  isBuiltin: (id: string) => _builtinModules.includes(id.replace(/^node:/, '')),
}
_moduleShim.default = _moduleShim

// Synchronous shim registry — also includes node: prefixed variants for packages
// that use require('node:fs') etc.
export const shimMap: Record<string, unknown> = {
  process,
  path,
  events: _events,
  stream: defaultStream,
  util,
  os,
  crypto,
  http,
  https,
  fs,
  'fs/promises': fsPromises,
  buffer: _buffer,
  url: _url,
  querystring: _querystring,
  assert: _assert,
  timers: _timers,
  'timers/promises': {
    setTimeout: (ms: number) => new Promise(r => setTimeout(r, ms)),
    setImmediate: () => new Promise(r => setTimeout(r, 0)),
  },
  perf_hooks: { performance },
  child_process: _childProcess,
  net: _net,
  tty: _tty,
  readline: _readline,
  zlib: _zlib,
  dns: _dns,
  module: _moduleShim,
  cluster: { isMaster: true, isWorker: false, fork: () => { throw new Error('cluster not supported') } },
  'worker_threads': _workerThreads,
  'string_decoder': {
    StringDecoder: class {
      encoding: string
      constructor(enc = 'utf8') { this.encoding = enc }
      write(buf: Uint8Array) { return new TextDecoder(this.encoding).decode(buf) }
      end() { return '' }
    }
  },
  // node: prefixed aliases — required for packages that use require('node:events') etc.
  'node:module': _moduleShim,
  'node:process': process,
  'node:path': path,
  'node:events': _events,
  'node:stream': defaultStream,
  'node:util': util,
  'node:os': os,
  'node:crypto': crypto,
  'node:http': http,
  'node:https': https,
  'node:fs': fs,
  'node:fs/promises': fsPromises,
  'node:buffer': _buffer,
  'node:url': _url,
  'node:querystring': _querystring,
  'node:assert': _assert,
  'node:timers': _timers,
  'node:timers/promises': {
    setTimeout: (ms: number) => new Promise(r => setTimeout(r, ms)),
    setImmediate: () => new Promise(r => setTimeout(r, 0)),
  },
  'node:perf_hooks': { performance },
  'node:child_process': _childProcess,
  'node:net': _net,
  'node:tty': _tty,
  'node:readline': _readline,
  'node:zlib': _zlib,
  'node:dns': _dns,
  'node:v8': _v8,
  'v8': _v8,
  'node:worker_threads': _workerThreads,
  'node:string_decoder': {
    StringDecoder: class {
      encoding: string
      constructor(enc = 'utf8') { this.encoding = enc }
      write(buf: Uint8Array) { return new TextDecoder(this.encoding).decode(buf) }
      end() { return '' }
    }
  },

  // rolldown subpath stubs — intercepted so native WASM bindings are never loaded
  'rolldown': _rollupBundle,
  'rolldown/parseAst': _rolldownParseAst,
  'rolldown/plugins': _rolldownPlugins,
  'rolldown/utils': _rolldownUtils,
  'rolldown/filter': _rolldownFilter,
  'rolldown/experimental': _rolldownExperimental,

  // Third-party shims intercepted before npm packages so native-binary deps never run
  'esbuild': esbuildShim,
  'rollup': _rollupBundle,
  'chokidar': chokidarShim,
  'connect': _connectShim,
  'sirv': _sirvShim,
  'picocolors': _picocolors,
  // Stub out native rollup platform bindings — rollup catches the require() error itself
  '@rollup/rollup-linux-x64-gnu': null,
  '@rollup/rollup-linux-x64-musl': null,
  '@rollup/rollup-linux-arm64-gnu': null,
  '@rollup/rollup-linux-arm64-musl': null,
  '@rollup/rollup-darwin-x64': null,
  '@rollup/rollup-darwin-arm64': null,
  '@rollup/rollup-win32-x64-msvc': null,
  // Stub out native esbuild platform bindings
  '@esbuild/linux-x64': null,
  '@esbuild/linux-arm64': null,
  '@esbuild/darwin-x64': null,
  '@esbuild/darwin-arm64': null,
  '@esbuild/win32-x64': null,
}

import { path } from './path'
import { EventEmitter } from './events'
import { Readable, Writable, Transform, PassThrough, Stream } from './stream'
import { util } from './util'
import { os } from './os'
import { crypto } from './crypto'
import { http, https } from './http'
import { fs, fsPromises } from './fs'
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

// Synchronous shim registry (no dynamic imports — avoids bundler warnings)
export const shimMap: Record<string, unknown> = {
  path,
  events: { EventEmitter, default: EventEmitter },
  stream: Stream,
  util,
  os,
  crypto,
  http,
  https,
  fs,
  'fs/promises': fsPromises,
  buffer: { Buffer },
  url: { URL, URLSearchParams, parse: (u: string) => new URL(u) },
  querystring: {
    stringify: (obj: Record<string, string>) => new URLSearchParams(obj).toString(),
    parse: (s: string) => Object.fromEntries(new URLSearchParams(s)),
  },
  assert: {
    default: (val: unknown, msg?: string) => { if (!val) throw new Error(msg ?? 'Assertion failed') },
    strictEqual: (a: unknown, b: unknown, msg?: string) => { if (a !== b) throw new Error(msg ?? `${a} !== ${b}`) },
    ok: (val: unknown, msg?: string) => { if (!val) throw new Error(msg ?? 'Assertion failed') },
  },
  timers: { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate: (fn: () => void) => setTimeout(fn, 0) },
  'timers/promises': {
    setTimeout: (ms: number) => new Promise(r => setTimeout(r, ms)),
    setImmediate: () => new Promise(r => setTimeout(r, 0)),
  },
  perf_hooks: { performance },
  child_process: {
    exec: (_cmd: string, cb: (err: Error | null) => void) => cb(new Error('child_process not supported in browser')),
    spawn: () => { throw new Error('child_process not supported in browser') },
  },
}

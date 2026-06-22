// Delegates to the shared memfs instance
import { memfsInstance } from '../vfs'

// Convert a path argument that may be a URL object or file:// string to a plain path string.
function toPath(p: unknown): string {
  if (typeof p === 'string') {
    // file:// URL strings
    if (p.startsWith('file://')) {
      try { return decodeURIComponent(new URL(p).pathname) } catch {}
    }
    return p
  }
  if (p instanceof URL) return decodeURIComponent(p.pathname)
  // Let memfs handle Buffers/Uint8Arrays
  return p as string
}

// Re-export the memfs fs object as the Node fs shim
export const fs = memfsInstance as unknown as typeof import('fs')

// Patch watch/watchFile — memfs has no real FS events; return stub watchers.
// Vite uses these for HMR file change detection. Without real watching, HMR
// won't fire automatically, but the dev server will still serve transformed files.
const _fs = fs as unknown as Record<string, unknown>

// Wrap core fs methods to handle URL objects as path arguments (Node.js 12+ feature)
const _wrap = <T extends (...args: unknown[]) => unknown>(fn: T): T =>
  ((...args: unknown[]) => { args[0] = toPath(args[0]); return fn(...args) }) as T

const _wrapSync = (name: string) => {
  if (typeof _fs[name] === 'function') _fs[name] = _wrap(_fs[name] as (...args: unknown[]) => unknown)
}
for (const m of ['readFileSync','writeFileSync','statSync','lstatSync','existsSync','readdirSync',
                  'mkdirSync','rmdirSync','unlinkSync','accessSync','renameSync','createReadStream','createWriteStream',
                  'openSync','chmodSync','copyFileSync','linkSync','symlinkSync','readlinkSync','realpathSync']) {
  _wrapSync(m)
}

class FsWatcher {
  private _listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map()
  close() { this._listeners.clear() }
  on(event: string, fn: (...args: unknown[]) => void) {
    const arr = this._listeners.get(event) ?? []
    arr.push(fn)
    this._listeners.set(event, arr)
    return this
  }
  off(event: string, fn: (...args: unknown[]) => void) {
    const arr = this._listeners.get(event)?.filter(l => l !== fn)
    if (arr) this._listeners.set(event, arr)
    return this
  }
}

if (!_fs.constants) {
  _fs.constants = FS_CONSTANTS
}

if (!_fs.watch) {
  _fs.watch = (_path: string, _opts?: unknown, _listener?: unknown): FsWatcher => new FsWatcher()
}
if (!_fs.watchFile) {
  _fs.watchFile = (_path: string, _opts?: unknown, _listener?: unknown): void => {}
}
if (!_fs.unwatchFile) {
  _fs.unwatchFile = (_path: string, _listener?: unknown): void => {}
}

export const FS_CONSTANTS = {
  O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128, O_TRUNC: 512, O_APPEND: 1024,
  F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
  COPYFILE_EXCL: 1, COPYFILE_FICLONE: 2, COPYFILE_FICLONE_FORCE: 4,
}

export const fsPromises = {
  constants: FS_CONSTANTS,
  readFile:   (p: unknown, opts?: unknown) => Promise.resolve(memfsInstance.readFileSync(toPath(p), opts as string) as Buffer),
  writeFile:  (p: unknown, data: string | Uint8Array) => { memfsInstance.writeFileSync(toPath(p), data); return Promise.resolve() },
  mkdir:      (p: unknown, opts?: unknown) => { try { memfsInstance.mkdirSync(toPath(p), opts as object) } catch {} return Promise.resolve() },
  readdir:    (p: unknown, opts?: unknown) => {
    const entries = memfsInstance.readdirSync(toPath(p), opts as object) as string[]
    return Promise.resolve(entries)
  },
  stat:       (p: unknown) => Promise.resolve(memfsInstance.statSync(toPath(p))),
  lstat:      (p: unknown) => Promise.resolve(memfsInstance.statSync(toPath(p))),
  unlink:     (p: unknown) => { memfsInstance.unlinkSync(toPath(p)); return Promise.resolve() },
  rm:         (p: unknown, opts?: unknown) => {
    const resolved = toPath(p)
    try { memfsInstance.unlinkSync(resolved) } catch {
      try { (memfsInstance as unknown as Record<string, (...a: unknown[]) => unknown>).rmdirSync?.(resolved, opts) } catch {}
    }
    return Promise.resolve()
  },
  rename:     (from: unknown, to: unknown) => { memfsInstance.renameSync(toPath(from), toPath(to)); return Promise.resolve() },
  access:     (p: unknown) => { try { memfsInstance.accessSync(toPath(p)); return Promise.resolve() } catch(e) { return Promise.reject(e) } },
  copyFile:   (src: unknown, dst: unknown) => { memfsInstance.writeFileSync(toPath(dst), memfsInstance.readFileSync(toPath(src))); return Promise.resolve() },
  realpath:   (p: unknown) => Promise.resolve(toPath(p)),
  open:       (p: unknown, _flags: string) => Promise.resolve({ read: () => Promise.resolve({ bytesRead: 0 }), close: () => Promise.resolve(), fd: 1 }),
  readlink:   (p: unknown) => Promise.resolve(toPath(p)),
  symlink:    (_target: unknown, _path: unknown) => Promise.resolve(),
  chmod:      (_p: unknown, _mode: number) => Promise.resolve(),
  watch:      (_p: unknown, _opts?: unknown) => ({ close: () => {}, [Symbol.asyncIterator]: async function*() {} }),
}


// Delegates to the shared memfs instance
import { memfsInstance } from '../vfs'

// Re-export the memfs fs object as the Node fs shim
export const fs = memfsInstance as unknown as typeof import('fs')

// Patch watch/watchFile — memfs has no real FS events; return stub watchers.
// Vite uses these for HMR file change detection. Without real watching, HMR
// won't fire automatically, but the dev server will still serve transformed files.
const _fs = fs as unknown as Record<string, unknown>

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
  readFile:   (p: string, opts?: unknown) => Promise.resolve(memfsInstance.readFileSync(p, opts as string) as Buffer),
  writeFile:  (p: string, data: string | Uint8Array) => { memfsInstance.writeFileSync(p, data); return Promise.resolve() },
  mkdir:      (p: string, opts?: unknown) => { try { memfsInstance.mkdirSync(p, opts as object) } catch {} return Promise.resolve() },
  readdir:    (p: string, opts?: unknown) => {
    const entries = memfsInstance.readdirSync(p, opts as object) as string[]
    return Promise.resolve(entries)
  },
  stat:       (p: string) => Promise.resolve(memfsInstance.statSync(p)),
  lstat:      (p: string) => Promise.resolve(memfsInstance.statSync(p)),
  unlink:     (p: string) => { memfsInstance.unlinkSync(p); return Promise.resolve() },
  rm:         (p: string, opts?: unknown) => {
    try { memfsInstance.unlinkSync(p) } catch {
      try { (memfsInstance as unknown as Record<string, (...a: unknown[]) => unknown>).rmdirSync?.(p, opts) } catch {}
    }
    return Promise.resolve()
  },
  rename:     (from: string, to: string) => { memfsInstance.renameSync(from, to); return Promise.resolve() },
  access:     (p: string) => { memfsInstance.accessSync(p); return Promise.resolve() },
  copyFile:   (src: string, dst: string) => { memfsInstance.writeFileSync(dst, memfsInstance.readFileSync(src)); return Promise.resolve() },
  realpath:   (p: string) => Promise.resolve(p),
  open:       (p: string, _flags: string) => Promise.resolve({ read: () => Promise.resolve({ bytesRead: 0 }), close: () => Promise.resolve(), fd: 1 }),
  readlink:   (p: string) => Promise.resolve(p),
  symlink:    (_target: string, _path: string) => Promise.resolve(),
  chmod:      (_p: string, _mode: number) => Promise.resolve(),
  watch:      (_p: string, _opts?: unknown) => ({ close: () => {}, [Symbol.asyncIterator]: async function*() {} }),
}


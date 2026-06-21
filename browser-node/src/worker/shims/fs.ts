// Delegates to the shared memfs instance
import { memfsInstance } from '../vfs'

// Re-export the memfs fs object as the Node fs shim
export const fs = memfsInstance as unknown as typeof import('fs')

export const fsPromises = {
  readFile:   (path: string, opts?: unknown) => Promise.resolve(memfsInstance.readFileSync(path, opts as string) as Buffer),
  writeFile:  (path: string, data: string | Uint8Array) => { memfsInstance.writeFileSync(path, data); return Promise.resolve() },
  mkdir:      (path: string, opts?: unknown) => { memfsInstance.mkdirSync(path, opts as object); return Promise.resolve() },
  readdir:    (path: string) => Promise.resolve(memfsInstance.readdirSync(path) as string[]),
  stat:       (path: string) => Promise.resolve(memfsInstance.statSync(path)),
  unlink:     (path: string) => { memfsInstance.unlinkSync(path); return Promise.resolve() },
  rm:         (path: string) => { try { memfsInstance.unlinkSync(path) } catch { memfsInstance.rmdirSync(path) }; return Promise.resolve() },
  rename:     (from: string, to: string) => { memfsInstance.renameSync(from, to); return Promise.resolve() },
  access:     (path: string) => { memfsInstance.accessSync(path); return Promise.resolve() },
  copyFile:   (src: string, dst: string) => { memfsInstance.writeFileSync(dst, memfsInstance.readFileSync(src)); return Promise.resolve() },
}

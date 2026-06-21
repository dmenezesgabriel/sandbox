// Minimal path stub for packages that import node:path — real shim lives in shims/path.ts
const sep = '/'
const delimiter = ':'
const join = (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
const dirname = (p: string) => p.split('/').slice(0, -1).join('/') || '/'
const basename = (p: string) => p.split('/').pop() ?? ''
const extname = (p: string) => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : '' }
const resolve = (...parts: string[]) => join(...parts)
const normalize = (p: string) => p
const isAbsolute = (p: string) => p.startsWith('/')

export default { sep, delimiter, join, dirname, basename, extname, resolve, normalize, isAbsolute }
export { sep, delimiter, join, dirname, basename, extname, resolve, normalize, isAbsolute }

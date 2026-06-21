import { memfsInstance, existsInVfs, isFileInVfs } from './vfs'
import { shimMap } from './shims/index'
import { path } from './shims/path'

// Cache of resolved modules
const moduleCache = new Map<string, { exports: unknown }>()

// Resolve the CJS entry point from a package.json exports field.
// Handles nested patterns: string | { require: string | { default: string } | ... }
function resolveExportsMain(exportsRoot: unknown): string | undefined {
  if (typeof exportsRoot === 'string') return exportsRoot
  if (typeof exportsRoot !== 'object' || exportsRoot === null) return undefined
  const obj = exportsRoot as Record<string, unknown>
  // Prefer 'require' condition (CJS)
  const req = obj.require
  if (typeof req === 'string') return req
  if (typeof req === 'object' && req !== null) {
    const r = req as Record<string, unknown>
    if (typeof r.default === 'string') return r.default
    if (typeof r.node === 'string') return r.node
    // pick first string value
    for (const v of Object.values(r)) if (typeof v === 'string') return v
  }
  // Fall back to 'node' condition
  const node = obj.node
  if (typeof node === 'string') return node
  if (typeof node === 'object' && node !== null) {
    const n = node as Record<string, unknown>
    if (typeof n.require === 'string') return n.require
    if (typeof n.default === 'string') return n.default
  }
  // Fall back to 'default' condition
  const def = obj.default
  if (typeof def === 'string') return def
  if (typeof def === 'object' && def !== null) {
    const d = def as Record<string, unknown>
    if (typeof d.default === 'string') return d.default
    for (const v of Object.values(d)) if (typeof v === 'string') return v
  }
  return undefined
}

// shimMap is already synchronous — just expose it as shimCache
const shimCache = shimMap

export async function preloadShims() {
  // shimMap is populated at import time; nothing async to do
}

function resolveModule(specifier: string, fromDir: string): string | null {
  // Built-in shims
  if (specifier in shimCache) return `__shim__:${specifier}`

  // Relative or absolute path
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const abs = specifier.startsWith('/') ? specifier : path.join(fromDir, specifier)
    for (const ext of ['', '.js', '.cjs', '.mjs', '.json', '/index.js', '/index.cjs', '/index.mjs']) {
      const candidate = abs + ext
      if (isFileInVfs(candidate)) return candidate
    }
    return null
  }

  // node_modules lookup — walk up from fromDir
  const parts = specifier.split('/')
  const pkgName = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  const subpath = parts[0].startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/')

  let dir = fromDir
  while (true) {
    const nmDir = path.join(dir, 'node_modules', pkgName)
    if (existsInVfs(nmDir)) {
      // Try package.json exports field first (covers both '.' and subpath cases)
      const pkgJsonPath = path.join(nmDir, 'package.json')
      let pkg: Record<string, unknown> | null = null
      if (isFileInVfs(pkgJsonPath)) {
        try { pkg = JSON.parse(memfsInstance.readFileSync(pkgJsonPath, 'utf8') as string) } catch {}
      }

      if (subpath) {
        // Try exports field subpath first
        if (pkg?.exports) {
          const subpathKey = `./${subpath}`
          const exportsEntry = (pkg.exports as Record<string, unknown>)[subpathKey]
          const resolved = resolveExportsMain(exportsEntry)
          if (resolved) {
            const resolvedPath = path.join(nmDir, resolved)
            for (const ext of ['', '.js', '.cjs', '.mjs']) {
              if (isFileInVfs(resolvedPath + ext)) return resolvedPath + ext
            }
          }
        }
        // Direct file path fallback
        const candidate = path.join(nmDir, subpath)
        for (const ext of ['', '.js', '.cjs', '.mjs', '/index.js', '/index.cjs']) {
          if (isFileInVfs(candidate + ext)) return candidate + ext
        }
      } else {
        // Root package — use exports['.'] then main
        if (pkg) {
          const exportsRoot = (pkg.exports as Record<string, unknown>)?.['.'] ?? pkg.exports
          const mainStr = resolveExportsMain(exportsRoot) ?? (pkg.main as string | undefined) ?? 'index.js'
          const mainPath = path.join(nmDir, mainStr)
          for (const ext of ['', '.js', '.cjs', '.mjs']) {
            if (isFileInVfs(mainPath + ext)) return mainPath + ext
          }
        }
        // Fallback to index files
        for (const idx of ['/index.js', '/index.cjs', '/index.mjs']) {
          if (isFileInVfs(nmDir + idx)) return nmDir + idx
        }
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return null
}

function executeModule(filePath: string, fromDir: string): { exports: unknown } {
  if (moduleCache.has(filePath)) return moduleCache.get(filePath)!

  const mod = { exports: {} as Record<string, unknown> }
  moduleCache.set(filePath, mod) // set before execution to handle circular deps

  const source = memfsInstance.readFileSync(filePath, 'utf8') as string
  const dir = path.dirname(filePath)

  if (filePath.endsWith('.json')) {
    mod.exports = JSON.parse(source)
    return mod
  }

  const requireFn = Object.assign(
    (specifier: string) => requireSync(specifier, dir),
    {
      resolve: (spec: string) => {
        const r = resolveModule(spec, dir)
        if (!r || r.startsWith('__shim__:')) return spec
        return r
      },
      cache: moduleCache,
      main: undefined,
      extensions: { '.js': true, '.cjs': true, '.mjs': true, '.json': true },
    }
  )
  const code = `(function(require, module, exports, __dirname, __filename, process, Buffer, global) {\n${source}\n})`

  try {
    // Indirect eval so the function executes in global scope, not module scope
    const fn = (0, eval)(code)
    fn(
      requireFn,
      mod,
      mod.exports,
      dir,
      filePath,
      shimCache['process'] ?? self,
      Buffer,
      self,
    )
  } catch (e) {
    moduleCache.delete(filePath)
    throw e
  }

  return mod
}

export function requireSync(specifier: string, fromDir = '/app'): unknown {
  // Built-in shim
  if (specifier in shimCache) return shimCache[specifier]

  const resolved = resolveModule(specifier, fromDir)

  if (!resolved) {
    throw new Error(`Cannot find module '${specifier}' from '${fromDir}'`)
  }

  if (resolved.startsWith('__shim__:')) {
    return shimCache[resolved.slice(9)]
  }

  return executeModule(resolved, fromDir).exports
}

export function clearModuleCache() {
  moduleCache.clear()
}

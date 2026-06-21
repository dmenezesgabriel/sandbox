import { memfsInstance, existsInVfs } from './vfs'
import { shimMap } from './shims/index'
import { path } from './shims/path'

// Cache of resolved modules
const moduleCache = new Map<string, { exports: unknown }>()

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
    for (const ext of ['', '.js', '.cjs', '.json', '/index.js', '/index.cjs']) {
      const candidate = abs + ext
      if (existsInVfs(candidate)) return candidate
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
      if (subpath) {
        const candidate = path.join(nmDir, subpath)
        for (const ext of ['', '.js', '.cjs', '/index.js']) {
          if (existsInVfs(candidate + ext)) return candidate + ext
        }
      }
      // Resolve via package.json main field
      const pkgJsonPath = path.join(nmDir, 'package.json')
      if (existsInVfs(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(memfsInstance.readFileSync(pkgJsonPath, 'utf8') as string)
          const main = pkg.main || pkg.exports?.['.']?.require || pkg.exports?.['.'] || 'index.js'
          const mainStr = typeof main === 'string' ? main : (main?.default ?? 'index.js')
          const mainPath = path.join(nmDir, mainStr)
          for (const ext of ['', '.js', '.cjs']) {
            if (existsInVfs(mainPath + ext)) return mainPath + ext
          }
        } catch {}
      }
      // Fallback
      for (const idx of ['/index.js', '/index.cjs']) {
        if (existsInVfs(nmDir + idx)) return nmDir + idx
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

  const requireFn = (specifier: string) => requireSync(specifier, dir)
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

import { memfsInstance, existsInVfs, isFileInVfs } from './vfs'
import { shimMap } from './shims/index'
import { path } from './shims/path'

// Cache of resolved modules
const moduleCache = new Map<string, { exports: unknown }>()

// Detect whether a source file uses ESM syntax at the module level.
function isEsmSource(source: string): boolean {
  // Line-start import (with or without space — minified: import{X}from"mod")
  if (/^import[\s{*"'`]/m.test(source)) return true
  // Line-start export
  if (/^export\s/m.test(source)) return true
  // Mid-line static imports in minified files (after ;)
  if (/;\s*import[\s{*"'`]/m.test(source)) return true
  return false
}

// Transform ESM source to CJS so it can be eval()'d in our synchronous loader.
// This handles the patterns emitted by modern bundlers (rolldown/rollup CJS chunks).
function esmToCjs(source: string, filePath: string): string {
  const dir = path.dirname(filePath)
  let result = source
  let _ctr = 0

  // Replace import.meta.* references before any other transforms
  result = result.replace(/\bimport\.meta\.url\b/g, `'file://${filePath}'`)
  result = result.replace(/\bimport\.meta\.dirname\b/g, `'${dir}'`)
  result = result.replace(/\bimport\.meta\.filename\b/g, `'${filePath}'`)
  result = result.replace(/\bimport\.meta\b/g, `({ url: 'file://${filePath}', dirname: '${dir}', filename: '${filePath}', env: {} })`)

  // Drop const/let redeclarations of runtime-injected CJS globals (__dirname/__filename
  // are already provided as function parameters in our eval wrapper, and const/let can't
  // redeclare an existing binding — convert them to plain assignments).
  result = result.replace(/\b(const|let)\s+(__dirname|__filename)\s*=/g, '$2 =')

  // Helper to build import replacers (handles both line-start and mid-line after ;)
  // Returns a function that takes prefix ('' or '; ') and returns the CJS replacement
  const _mkNamedReplace = (pre: string, names: string, mod: string) => {
    const mapped = names.trim().split(',').filter(Boolean).map((n: string) => {
      const [src, dst] = n.trim().split(/\s+as\s+/)
      return dst ? `${src.trim()}: ${dst.trim()}` : src.trim()
    }).join(', ')
    return `${pre}const { ${mapped} } = require('${mod}')`
  }
  const _mkDefaultReplace = (pre: string, name: string, mod: string) =>
    `${pre}const ${name} = ((_m) => _m && _m.__esModule && _m.default !== undefined ? _m.default : _m)(require('${mod}'))`
  const _mkCombinedReplace = (pre: string, defaultName: string, names: string, mod: string) => {
    const tmp = `_esm${_ctr++}`
    const mapped = names.trim().split(',').filter(Boolean).map((n: string) => {
      const [src, dst] = n.trim().split(/\s+as\s+/)
      return dst ? `${src.trim()}: ${dst.trim()}` : src.trim()
    }).join(', ')
    return `${pre}const ${tmp} = require('${mod}'); const ${defaultName} = ((_m) => _m && _m.__esModule && _m.default !== undefined ? _m.default : _m)(${tmp}); const { ${mapped} } = ${tmp}`
  }

  // import X, { Y, Z } from 'mod'  →  combined default + named (must come before single-form patterns)
  result = result.replace(
    /^import\s+([$\w]+)\s*,\s*\{([^{}]*?)\}\s*from\s*(['"`])(.*?)\3[ \t]*;?[ \t]*/gm,
    (_, dn, ns, __, mod) => _mkCombinedReplace('', dn, ns, mod)
  )
  // mid-line variant: ; import X, { Y } from 'mod'
  result = result.replace(
    /;[ \t]*import\s+([$\w]+)\s*,\s*\{([^{}]*?)\}\s*from\s*(['"`])(.*?)\3[ \t]*;?[ \t]*/g,
    (_, dn, ns, __, mod) => _mkCombinedReplace('; ', dn, ns, mod)
  )

  // import { X as Y, Z } from 'mod'  →  const { X: Y, Z } = require('mod')
  result = result.replace(
    /^import\s*\{([^{}]*?)\}\s*from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/gm,
    (_, names, __, mod) => _mkNamedReplace('', names, mod)
  )
  // mid-line variant: ; import { X } from 'mod'
  result = result.replace(
    /;[ \t]*import\s*\{([^{}]*?)\}\s*from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/g,
    (_, names, __, mod) => _mkNamedReplace('; ', names, mod)
  )

  // import X from 'mod'  →  const X = (m => m?.__esModule ? m.default : m)(require('mod'))
  result = result.replace(
    /^import\s+([$\w]+)\s+from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/gm,
    (_, name, __, mod) => _mkDefaultReplace('', name, mod)
  )
  // mid-line variant: ; import X from 'mod'
  result = result.replace(
    /;[ \t]*import\s+([$\w]+)\s+from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/g,
    (_, name, __, mod) => _mkDefaultReplace('; ', name, mod)
  )

  // import * as X from 'mod'  →  const X = require('mod')
  result = result.replace(
    /^import\s*\*\s*as\s+([$\w]+)\s+from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/gm,
    (_, name, __, mod) => `const ${name} = require('${mod}')`
  )
  // mid-line variant: ; import * as X from 'mod'
  result = result.replace(
    /;[ \t]*import\s*\*\s*as\s+([$\w]+)\s+from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/g,
    (_, name, __, mod) => `; const ${name} = require('${mod}')`
  )

  // import 'mod' (side effect)  →  require('mod')
  result = result.replace(
    /^import\s*(['"`])(.*?)\1[ \t]*;?[ \t]*/gm,
    (_, __, mod) => `require('${mod}')`
  )
  // mid-line variant: ; import 'mod'
  result = result.replace(
    /;[ \t]*import\s*(['"`])(.*?)\1[ \t]*;?[ \t]*/g,
    (_, __, mod) => `; require('${mod}')`
  )

  // Dynamic import(expr) → Promise.resolve(require(expr))
  // Must run after all static import transforms so only genuine dynamic calls remain.
  // (?<!\.) prevents matching obj.import(...) method calls (property access).
  // (?<!async\s) prevents matching async class method declarations: `async import(url) {}`.
  result = result.replace(/(?<!\.)\b(?<!async\s)import\s*\(/g, '((__dynArg)=>Promise.resolve(require(__dynArg)))(')

  // export * from 'mod'  →  Object.assign(exports, require('mod'))
  result = result.replace(
    /^export\s+\*\s+from\s*(['"`])(.*?)\1[ \t]*;?[ \t]*/gm,
    (_, __, mod) => `Object.assign(exports, require('${mod}'))`
  )

  // export * as X from 'mod'  →  exports.X = require('mod')
  result = result.replace(
    /^export\s+\*\s+as\s+([$\w]+)\s+from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/gm,
    (_, name, __, mod) => `exports.${name} = require('${mod}')`
  )

  // export { X as Y, Z } from 'mod'  →  (re-export)
  result = result.replace(
    /^export\s+\{([^{}]*?)\}\s*from\s*(['"`])(.*?)\2[ \t]*;?[ \t]*/gm,
    (_, names, __, mod) => {
      return names.trim().split(',').filter(Boolean).map((n: string) => {
        const [src, dst] = n.trim().split(/\s+as\s+/)
        const s = src.trim(), d = (dst || src).trim()
        return `exports.${d} = require('${mod}').${s}`
      }).join('; ')
    }
  )

  // export { X as Y, Z }  →  exports.Y = X; exports.Z = Z
  result = result.replace(
    /^export\s+\{([^{}]*?)\}[ \t]*;?[ \t]*/gm,
    (_, names) => {
      return names.trim().split(',').filter(Boolean).map((n: string) => {
        const [src, dst] = n.trim().split(/\s+as\s+/)
        const s = src.trim(), d = (dst || src).trim()
        return `exports.${d} = ${s}`
      }).join('; ')
    }
  )

  // export default EXPR  →  exports.default = module.exports.default = EXPR
  result = result.replace(
    /^export\s+default\s+/gm,
    'exports.default = module.exports.default = '
  )

  // export function foo  →  function foo  +  exports.foo = foo  (appended)
  const exportedFns: string[] = []
  result = result.replace(
    /^export\s+(function|class|async\s+function)\s+([$\w]+)/gm,
    (_, kw, name) => { exportedFns.push(name); return `${kw} ${name}` }
  )

  // export const/let/var X = ...  →  const X = ...  +  exports.X = X
  const exportedVars: string[] = []
  result = result.replace(
    /^export\s+(const|let|var)\s+([$\w]+)/gm,
    (_, kw, name) => { exportedVars.push(name); return `${kw} ${name}` }
  )

  // Append deferred exports at the end
  const deferred = [...exportedFns, ...exportedVars].map(n => `exports.${n} = ${n}`).join('; ')
  if (deferred) result += `\n;${deferred};`

  // Mark as ESM-compat CJS
  result = `'use strict'; Object.defineProperty(exports, '__esModule', { value: true });\n` + result

  return result
}

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

// Resolve a package.json #imports condition entry to a file path string.
// Prefers 'require' → 'node' → 'default' conditions; skips 'import'/'browser'.
function resolveImportsCondition(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry
  if (typeof entry !== 'object' || entry === null) return undefined
  const obj = entry as Record<string, unknown>
  for (const cond of ['require', 'node', 'default']) {
    const v = obj[cond]
    if (typeof v === 'string') return v
    if (typeof v === 'object' && v !== null) {
      const r = resolveImportsCondition(v)
      if (r) return r
    }
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

  // Package #imports (private package imports — e.g. "#module-sync-enabled")
  if (specifier.startsWith('#')) {
    let dir = fromDir
    while (true) {
      const pkgJsonPath = path.join(dir, 'package.json')
      if (isFileInVfs(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(memfsInstance.readFileSync(pkgJsonPath, 'utf8') as string) as Record<string, unknown>
          const imports = pkg.imports as Record<string, unknown> | undefined
          if (imports && specifier in imports) {
            const entry = imports[specifier]
            const resolved = resolveImportsCondition(entry)
            if (resolved) {
              const abs = path.join(dir, resolved)
              for (const ext of ['', '.js', '.cjs', '.mjs']) {
                if (isFileInVfs(abs + ext)) return abs + ext
              }
            }
          }
        } catch {}
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

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

// Walk up from filePath to find the nearest package.json and check if type === 'module'
function isInModulePackage(filePath: string): boolean {
  let dir = path.dirname(filePath)
  while (true) {
    const pkgPath = path.join(dir, 'package.json')
    if (isFileInVfs(pkgPath)) {
      try {
        const pkg = JSON.parse(memfsInstance.readFileSync(pkgPath, 'utf8') as string) as Record<string, unknown>
        return pkg.type === 'module'
      } catch {}
      return false
    }
    const parent = path.dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

function executeModule(filePath: string, fromDir: string): { exports: unknown } {
  if (moduleCache.has(filePath)) return moduleCache.get(filePath)!

  const mod = { exports: {} as Record<string, unknown> }
  moduleCache.set(filePath, mod) // set before execution to handle circular deps

  let source = memfsInstance.readFileSync(filePath, 'utf8') as string
  const dir = path.dirname(filePath)

  if (filePath.endsWith('.json')) {
    mod.exports = JSON.parse(source)
    return mod
  }

  // Transpile ESM to CJS if needed (handles Vite 8.x+ which ships ESM-only dist)
  // Treat .mjs files as ESM regardless of content, and .js files in "type":"module" packages
  const originalSource = source
  const isMjs = filePath.endsWith('.mjs')
  const isModulePackage = !isMjs && filePath.endsWith('.js') && isInModulePackage(filePath)
  if (isMjs || isModulePackage || isEsmSource(source)) {
    source = esmToCjs(source, filePath)
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
  const execSource = (src: string) => {
    const wrapped = `(function(require, module, exports, __dirname, __filename, process, global) {\n${src}\n})`
    // Indirect eval so the function executes in global scope, not module scope
    const fn = (0, eval)(wrapped)
    fn(requireFn, mod, mod.exports, dir, filePath, shimCache['process'] ?? self, self)
  }

  try {
    execSource(source)
  } catch (e) {
    // If eval fails with SyntaxError, always retry with fresh ESM→CJS on the original.
    // Needed when esmToCjs already ran but missed some patterns (e.g. minified bundles).
    if (e instanceof SyntaxError) {
      try {
        execSource(esmToCjs(originalSource, filePath))
        return mod
      } catch {
        // Retry also failed — fall through to throw original error
      }
    }
    moduleCache.delete(filePath)
    throw e
  }

  return mod
}

export function requireSync(specifier: string, fromDir = '/app'): unknown {
  // Virtual module IDs (rolldown/rollup internal) — return empty object
  if (specifier.startsWith('\0')) return {}

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

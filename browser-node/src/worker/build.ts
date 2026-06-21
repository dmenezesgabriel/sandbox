import * as esbuild from 'esbuild-wasm'
import { memfsInstance, existsInVfs } from './vfs'
import { path } from './shims/path'

let initialized = false

export async function initBuild() {
  if (initialized) return
  await esbuild.initialize({
    wasmURL: '/node_modules/esbuild-wasm/esbuild.wasm',
    worker: false, // We're already in a Worker
  })
  initialized = true
}

// Bundle a file from the VFS using esbuild
export async function bundle(
  entryPoint: string,
  opts: { format?: 'cjs' | 'esm' | 'iife'; platform?: 'browser' | 'node'; minify?: boolean } = {}
): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: opts.format ?? 'cjs',
    platform: opts.platform ?? 'node',
    minify: opts.minify ?? false,
    plugins: [vfsPlugin()],
    define: {
      'process.env.NODE_ENV': '"development"',
    },
  })

  if (result.errors.length) {
    throw new Error(result.errors.map(e => e.text).join('\n'))
  }

  return new TextDecoder().decode(result.outputFiles[0].contents)
}

// Transform a single file (no bundling — just transpile TS/JSX)
export async function transform(
  source: string,
  opts: { loader?: 'ts' | 'tsx' | 'js' | 'jsx'; format?: 'cjs' | 'esm' } = {}
): Promise<string> {
  const result = await esbuild.transform(source, {
    loader: opts.loader ?? 'ts',
    format: opts.format ?? 'cjs',
    target: 'es2022',
  })
  return result.code
}

// esbuild plugin that reads from the VFS
function vfsPlugin(): esbuild.Plugin {
  return {
    name: 'vfs',
    setup(build) {
      // Resolve all imports through the VFS
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('node:')) {
          return { path: args.path.replace('node:', ''), namespace: 'shim' }
        }

        // Relative path
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          const abs = args.path.startsWith('/')
            ? args.path
            : path.join(args.resolveDir || '/', args.path)

          for (const ext of ['', '.js', '.ts', '.jsx', '.tsx', '.cjs', '.json', '/index.js', '/index.ts']) {
            if (existsInVfs(abs + ext)) return { path: abs + ext, namespace: 'vfs' }
          }
          return { errors: [{ text: `Cannot resolve ${args.path} from ${args.resolveDir}` }] }
        }

        // node_modules
        const parts = args.path.split('/')
        const pkgName = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
        const subpath = parts[0].startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/')
        const nmPath = path.join('/node_modules', pkgName)

        if (existsInVfs(nmPath)) {
          if (subpath) {
            const candidate = path.join(nmPath, subpath)
            for (const ext of ['', '.js', '.cjs', '/index.js']) {
              if (existsInVfs(candidate + ext)) return { path: candidate + ext, namespace: 'vfs' }
            }
          }
          const pkgJsonPath = path.join(nmPath, 'package.json')
          if (existsInVfs(pkgJsonPath)) {
            const pkg = JSON.parse(memfsInstance.readFileSync(pkgJsonPath, 'utf8') as string)
            const main = pkg.main || pkg.exports?.['.']?.require || 'index.js'
            const mainStr = typeof main === 'string' ? main : 'index.js'
            const mainPath = path.join(nmPath, mainStr)
            for (const ext of ['', '.js', '.cjs']) {
              if (existsInVfs(mainPath + ext)) return { path: mainPath + ext, namespace: 'vfs' }
            }
          }
        }

        return { path: args.path, namespace: 'shim' }
      })

      // Load from VFS
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
        const content = memfsInstance.readFileSync(args.path, 'utf8') as string
        const ext = path.extname(args.path).slice(1)
        const loader = (['ts', 'tsx', 'jsx', 'json', 'css'] as const).find(e => e === ext) ?? 'js' as esbuild.Loader
        return { contents: content, loader }
      })

      // Shims — return empty for browser-irrelevant node built-ins
      build.onLoad({ filter: /.*/, namespace: 'shim' }, (args) => {
        return { contents: `// shim: ${args.path}`, loader: 'js' }
      })
    },
  }
}

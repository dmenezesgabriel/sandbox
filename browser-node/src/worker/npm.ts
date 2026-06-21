import { gunzipSync } from 'fflate'
import { satisfies, maxSatisfying, validRange, clean } from 'semver'
import { writeFileToVfs, existsInVfs, mkdirpSync, memfsInstance } from './vfs'
import { path } from './shims/path'

// In dev the Vite proxy rewrites /_npm → registry.npmjs.org (avoids browser TLS issues).
// In production (static deploy) we hit the registry directly — CORS is supported.
const REGISTRY = import.meta.env.DEV ? '/_npm' : 'https://registry.npmjs.org'

type PackageMeta = {
  name: string
  versions: Record<string, { dist: { tarball: string }; dependencies?: Record<string, string> }>
  'dist-tags': { latest: string }
}

const metaCache = new Map<string, PackageMeta>()

function log(msg: string) {
  self.postMessage({ type: 'stdout', text: msg + '\n' })
}

async function fetchMeta(name: string): Promise<PackageMeta> {
  if (metaCache.has(name)) return metaCache.get(name)!
  const res = await fetch(`${REGISTRY}/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`npm: package not found: ${name} (${res.status})`)
  const meta = await res.json() as PackageMeta
  metaCache.set(name, meta)
  return meta
}

function resolveVersion(meta: PackageMeta, range: string): string {
  if (range === 'latest' || range === '*' || range === '') {
    return meta['dist-tags'].latest
  }
  const exact = clean(range)
  if (exact && meta.versions[exact]) return exact
  const versions = Object.keys(meta.versions)
  const best = maxSatisfying(versions, validRange(range) ?? range)
  if (!best) throw new Error(`npm: no version of ${meta.name} satisfies ${range}`)
  return best
}

// Simple synchronous tar parser (POSIX.1-1988 / ustar format)
function* parseTar(buf: Uint8Array): Generator<{ name: string; isFile: boolean; data: Uint8Array }> {
  const str = (start: number, len: number) => {
    let end = start
    while (end < start + len && buf[end] !== 0) end++
    return new TextDecoder().decode(buf.slice(start, end))
  }
  let offset = 0
  while (offset + 512 <= buf.length) {
    if (buf[offset] === 0) break // end-of-archive marker
    const name = str(offset, 100)
    const type = String.fromCharCode(buf[offset + 156])
    const size = parseInt(str(offset + 124, 12).trim(), 8) || 0
    offset += 512
    const data = buf.slice(offset, offset + size)
    if (name) yield { name, isFile: type === '0' || type === '', data }
    offset += Math.ceil(size / 512) * 512
  }
}

function rewriteUrl(url: string): string {
  if (import.meta.env.DEV) {
    return url.replace('https://registry.npmjs.org', '/_npm')
  }
  return url
}

async function extractTarball(tarball: string, destDir: string) {
  const res = await fetch(rewriteUrl(tarball))
  const buf = new Uint8Array(await res.arrayBuffer())
  const tar = gunzipSync(buf)
  for (const entry of parseTar(tar)) {
    if (!entry.isFile) continue
    // npm tarballs have a leading "package/" prefix
    const relPath = entry.name.replace(/^package\//, '')
    const fullPath = path.join(destDir, relPath)
    writeFileToVfs(fullPath, entry.data)
  }
}

type DepTree = Map<string, string> // name → resolved version

export async function install(
  packages: Record<string, string>,
  rootNmDir = '/node_modules'
): Promise<void> {
  const queue: { name: string; range: string; dest: string }[] = Object.entries(packages).map(
    ([name, range]) => ({ name, range, dest: rootNmDir })
  )
  const installed = new Set<string>()

  while (queue.length) {
    const { name, range, dest } = queue.shift()!
    let meta: PackageMeta
    try { meta = await fetchMeta(name) } catch (e) {
      log(`npm WARN ${String(e)}`)
      continue
    }

    const version = resolveVersion(meta, range)
    const key = `${name}@${version}`
    if (installed.has(key)) continue
    installed.add(key)

    const pkgDir = path.join(dest, name)
    const alreadyExtracted = existsInVfs(path.join(pkgDir, 'package.json'))
    if (!alreadyExtracted) {
      log(`npm  installing  ${name}@${version}`)
      mkdirpSync(pkgDir)
      await extractTarball(meta.versions[version].dist.tarball, pkgDir)
    }

    const deps = meta.versions[version].dependencies ?? {}
    for (const [depName, depRange] of Object.entries(deps)) {
      // Try to use already-installed version; otherwise install into package's own node_modules
      let resolved: string | null = null
      try {
        const depMeta = await fetchMeta(depName)
        resolved = resolveVersion(depMeta, depRange)
      } catch {}

      const globalInstalled = existsInVfs(path.join(rootNmDir, depName, 'package.json'))
      if (!globalInstalled) {
        // check if already queued
        const alreadyQueued = queue.some(q => q.name === depName)
        if (!alreadyQueued) {
          queue.push({ name: depName, range: depRange, dest: rootNmDir })
        }
      } else if (resolved) {
        // Verify version compatibility; hoist if ok, nest if not
        try {
          const pkgJsonRaw = memfsInstance.readFileSync(path.join(rootNmDir, depName, 'package.json'), 'utf8') as string
          const { version: installedVersion } = JSON.parse(pkgJsonRaw)
          if (!satisfies(installedVersion, depRange)) {
            // Nest inside the dependent's node_modules
            queue.push({ name: depName, range: depRange, dest: path.join(pkgDir, 'node_modules') })
          }
        } catch {}
      }
    }
  }

  log(`\nnpm  done. ${installed.size} package(s) installed.\n`)
}

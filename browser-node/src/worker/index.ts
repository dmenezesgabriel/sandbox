/// <reference lib="webworker" />
// Bootstrap Node.js globals FIRST so packages that rely on them as globals find them.
import * as _bufMod from 'buffer'
import { process as _process } from './shims/process'
const _g = globalThis as unknown as Record<string, unknown>
_g.Buffer = _bufMod.Buffer
_g.process = _process
// Node.js globals not present in browsers
_g.setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) => setTimeout(() => fn(...args), 0)
_g.clearImmediate = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)

// Redirect console output to the shell terminal so npm/Vite logs are visible
const _fmtArgs = (...args: unknown[]) => args.map(a => typeof a === 'string' ? a : (a instanceof Error ? a.stack ?? a.message : JSON.stringify(a, null, 2))).join(' ') + '\n'
console.log = (...args: unknown[]) => self.postMessage({ type: 'stdout', text: _fmtArgs(...args) })
console.info = console.log
console.warn = (...args: unknown[]) => self.postMessage({ type: 'stderr', text: _fmtArgs(...args) })
console.error = (...args: unknown[]) => self.postMessage({ type: 'stderr', text: _fmtArgs(...args) })
console.debug = console.log

import { preloadShims, requireSync, clearModuleCache } from './loader'
import { bindRequireSync } from './shims/index'
import { install } from './npm'
import { writeFileToVfs, dumpVfs } from './vfs'
import { getServer } from './shims/http'

// Wire up createRequire in the node:module shim (can't import requireSync there — circular)
bindRequireSync(requireSync)

function log(text: string) { self.postMessage({ type: 'stdout', text }) }
function err(text: string) { self.postMessage({ type: 'stderr', text }) }

async function init() {
  log('[runtime] Initializing shims...\n')
  await preloadShims()
  log('[runtime] Ready.\n')
  self.postMessage({ type: 'ready' })
}

// Set up a MessagePort from the shell so the SW can send HTTP requests here
function attachSwPort(port: MessagePort) {
  port.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data
    if (msg?.type !== 'http-request') return
    const server = getServer(msg.listenPort ?? 3000)
    if (!server) {
      msg.replyPort.postMessage({
        status: 503,
        headers: { 'content-type': 'text/html' },
        body: `<p>No server on port ${msg.listenPort}. Run your code first.</p>`,
      })
      return
    }
    server.handleRequest({
      method: msg.method,
      url: msg.url,
      headers: msg.headers ?? {},
      body: msg.body,
      replyPort: msg.replyPort,
    })
  })
  port.start()
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, ...payload } = e.data ?? {}

  if (type === 'register-server-port') {
    // Shell gives us a MessagePort per registered server; SW sends requests through it
    attachSwPort(payload.workerPort as MessagePort)
    return
  }

  if (type === 'run') {
    const { code, filename = '/app/index.js' } = payload
    clearModuleCache()
    log('\n')
    try {
      writeFileToVfs(filename, code)
      requireSync(filename, '/app')
    } catch (e) {
      err(`\n[error] ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
    }
    return
  }

  if (type === 'npm-install') {
    const { packages } = payload as { packages: Record<string, string> }
    try {
      await install(packages)
    } catch (e) {
      err(`\n[npm error] ${String(e)}\n`)
    }
    self.postMessage({ type: 'npm-done' })
    return
  }

  if (type === 'write-file') {
    writeFileToVfs(payload.path, payload.content)
    return
  }

  if (type === 'vfs-dump') {
    self.postMessage({ type: 'vfs-dump-result', tree: dumpVfs() })
    return
  }
})

init().catch(e => err(`[fatal] ${e}\n`))

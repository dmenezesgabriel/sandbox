/// <reference lib="webworker" />
import { preloadShims, requireSync, clearModuleCache } from './loader'
import { install } from './npm'
import { writeFileToVfs, dumpVfs } from './vfs'
import { getServer } from './shims/http'

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

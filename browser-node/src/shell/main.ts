const editor = document.getElementById('editor') as HTMLTextAreaElement
const terminal = document.getElementById('terminal') as HTMLDivElement
const preview = document.getElementById('preview') as HTMLIFrameElement
const btnRun = document.getElementById('btn-run') as HTMLButtonElement
const btnInstall = document.getElementById('btn-install') as HTMLButtonElement
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLSpanElement

// --- Service Worker registration ---
let swReady = false

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    appendLog('warn', '[shell] Service Worker not supported — HTTP server preview disabled.\n')
    return
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    swReady = true
    appendLog('ok', '[shell] Service Worker registered.\n')

    // Relay http-request messages FROM the Worker TO the SW (and back)
    navigator.serviceWorker.addEventListener('message', (e) => {
      // Not used in this direction; SW talks to Worker via the MessagePort
    })
  } catch (e) {
    appendLog('warn', `[shell] SW registration failed: ${e}\n`)
  }
}

// --- Web Worker ---
const runtimeWorker = new Worker(new URL('../worker/index.ts', import.meta.url), { type: 'module' })
let workerReady = false

// Channel used by the SW to forward HTTP requests to the Worker
const { port1: swToWorkerPort, port2: workerFromSwPort } = new MessageChannel()

runtimeWorker.addEventListener('message', (e: MessageEvent) => {
  const { type, ...payload } = e.data ?? {}

  if (type === 'ready') {
    workerReady = true
    setStatus('Ready')
    appendLog('ok', '[runtime] Worker ready.\n')
    // Transfer the SW→Worker port to the Worker
    runtimeWorker.postMessage({ type: 'set-sw-port', port: workerFromSwPort }, [workerFromSwPort])
    return
  }

  if (type === 'stdout') {
    appendLog('info', payload.text)
  } else if (type === 'stderr') {
    appendLog('error', payload.text)
  } else if (type === 'server-listen') {
    debouncedServerListen(payload.port)
  } else if (type === 'server-close') {
    unregisterServerWithSW(payload.port)
  } else if (type === 'npm-done') {
    setStatus('Ready')
    btnInstall.disabled = false
    btnRun.disabled = false
    appendLog('ok', '[npm] Install complete.\n')
  } else if (type === 'vfs-dump-result') {
    appendLog('info', payload.tree)
  }
})

runtimeWorker.addEventListener('error', (e) => {
  appendLog('error', `[worker error] ${e.message || e.filename || 'unknown'} (line ${e.lineno})\n`)
})
runtimeWorker.addEventListener('messageerror', (e) => {
  appendLog('error', `[worker messageerror] ${JSON.stringify(e.data)}\n`)
})

// Debounce server-listen events: Fastify's avvio lifecycle may emit multiple
// listen() calls in the same tick. Only process the last one per port.
const _listenTimers = new Map<number, ReturnType<typeof setTimeout>>()
function debouncedServerListen(port: number) {
  if (_listenTimers.has(port)) clearTimeout(_listenTimers.get(port)!)
  _listenTimers.set(port, setTimeout(() => {
    _listenTimers.delete(port)
    registerServerWithSW(port)
  }, 50))
}

// Tell the SW about a server port so it can route requests
function registerServerWithSW(port: number) {
  if (!swReady || !navigator.serviceWorker.controller) return
  // We give the SW a dedicated MessagePort to forward requests to the Worker
  const { port1: toWorker, port2: toSW } = new MessageChannel()
  // The worker will receive requests on toWorker
  runtimeWorker.postMessage({ type: 'register-server-port', port, workerPort: toWorker }, [toWorker])
  navigator.serviceWorker.controller.postMessage(
    { type: 'register-server', listenPort: port, port: toSW },
    [toSW]
  )
  appendLog('ok', `[server] Listening on http://localhost:${port}\n`)
  ;(document.getElementById('preview-url') as HTMLInputElement).value = `http://localhost:${port}/`
  // Chrome blocks SW responses for iframe navigation requests. Instead, fetch the content
  // via the SW (which works for fetch() sub-resource requests) and inject as srcdoc.
  setTimeout(() => loadPreviewViaSrcdoc(port, '/'), 300)
}

async function loadPreviewViaSrcdoc(port: number, path: string) {
  const proxyUrl = `${location.origin}/_proxy/${port}${path}`
  try {
    const resp = await fetch(proxyUrl)
    let html = await resp.text()
    // Skip empty responses — server may not be ready yet
    if (!html.trim()) return
    // Inject a <base> tag so relative sub-resource URLs resolve through the SW proxy.
    // Also patch fetch/XHR so JS API calls use absolute proxy URLs.
    const injection = `<base href="${location.origin}/_proxy/${port}${path}"><script>
;(function(){
  var _base='${location.origin}/_proxy/${port}';
  function _prx(u){return(typeof u==='string'&&u.startsWith('/')&&!u.startsWith('//'))?_base+u:u}
  var _f=window.fetch;window.fetch=function(u,o){return _f.call(this,_prx(u),o)};
  var _x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return _x.apply(this,[m,_prx(u)].concat([].slice.call(arguments,2)))};
})();
<\/script>`
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + injection)
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', '<html><head>' + injection + '</head>')
    } else {
      html = injection + html
    }
    preview.srcdoc = html
  } catch (e) {
    preview.srcdoc = `<html><body style="font-family:monospace;color:red;padding:1rem"><p>Preview error: ${e}</p></body></html>`
  }
}

function unregisterServerWithSW(port: number) {
  navigator.serviceWorker.controller?.postMessage({ type: 'unregister-server', listenPort: port })
}

// --- Terminal helpers ---
function appendLog(level: 'info' | 'ok' | 'warn' | 'error' | 'cmd', text: string) {
  const line = document.createElement('div')
  line.className = `log-line log-${level}`
  line.textContent = text
  terminal.appendChild(line)
  terminal.scrollTop = terminal.scrollHeight
}

function setStatus(msg: string) {
  statusEl.textContent = msg
}

// --- Tab key in editor ---
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = editor.selectionStart
    const end = editor.selectionEnd
    editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end)
    editor.selectionStart = editor.selectionEnd = start + 2
  }
})

// --- Button handlers ---
btnRun.addEventListener('click', () => {
  if (!workerReady) { appendLog('warn', 'Worker not ready yet.\n'); return }
  appendLog('cmd', '▶ Run\n')
  setStatus('Running...')
  runtimeWorker.postMessage({ type: 'run', code: editor.value, filename: '/app/index.js' })
})

btnInstall.addEventListener('click', async () => {
  const raw = prompt('Packages to install (e.g. "express@4 lodash")')
  if (!raw?.trim()) return

  const packages: Record<string, string> = {}
  for (const pkg of raw.trim().split(/\s+/)) {
    const atIdx = pkg.lastIndexOf('@')
    if (atIdx > 0) {
      packages[pkg.slice(0, atIdx)] = pkg.slice(atIdx + 1)
    } else {
      packages[pkg] = 'latest'
    }
  }

  appendLog('cmd', `npm install ${raw}\n`)
  setStatus('Installing...')
  btnInstall.disabled = true
  btnRun.disabled = true
  runtimeWorker.postMessage({ type: 'npm-install', packages })
})

btnClear.addEventListener('click', () => { terminal.innerHTML = '' })

btnRefresh.addEventListener('click', () => {
  const portStr = (document.getElementById('preview-url') as HTMLInputElement).value.match(/:(\d+)/)?.[1] ?? '3000'
  preview.srcdoc = ''
  loadPreviewViaSrcdoc(parseInt(portStr, 10), '/')
})

// --- Boot ---
setStatus('Initializing...')
appendLog('info', '[shell] Starting browser-node runtime...\n')
registerSW()

// Dev-only test hook — lets playwright-cli eval send messages to the worker
;(window as unknown as Record<string, unknown>)._sendToWorker = (msg: unknown) => runtimeWorker.postMessage(msg)

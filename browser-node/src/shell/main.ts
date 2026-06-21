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
    registerServerWithSW(payload.port)
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
  appendLog('error', `[worker error] ${e.message}\n`)
})

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
  preview.src = `http://localhost:${port}/`
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
  const url = (document.getElementById('preview-url') as HTMLInputElement).value
  preview.src = ''
  requestAnimationFrame(() => { preview.src = url })
})

// --- Boot ---
setStatus('Initializing...')
appendLog('info', '[shell] Starting browser-node runtime...\n')
registerSW()

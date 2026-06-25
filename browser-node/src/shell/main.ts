import { Editor } from './editor'
import { TerminalUI } from './terminal-ui'
import { FileExplorer } from './explorer'

// ── Web Worker ────────────────────────────────────────────────────────────────

const runtimeWorker = new Worker(new URL('../worker/index.ts', import.meta.url), { type: 'module' })
let workerReady = false

function send(msg: unknown, transfer?: Transferable[]) {
  runtimeWorker.postMessage(msg, transfer ?? [])
}

// ── Service Worker ────────────────────────────────────────────────────────────

let swReady = false

async function registerSW() {
  if (!('serviceWorker' in navigator)) return
  try {
    const base = import.meta.env.BASE_URL  // '/' in dev, '/sandbox/' in prod
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
    await navigator.serviceWorker.ready
    swReady = true
  } catch { /* SW optional — HTTP server preview disabled */ }
}

const _listenTimers = new Map<number, ReturnType<typeof setTimeout>>()

function registerServerWithSW(port: number) {
  if (!swReady || !navigator.serviceWorker.controller) return
  const { port1, port2 } = new MessageChannel()
  send({ type: 'register-server-port', port, workerPort: port1 }, [port1])
  navigator.serviceWorker.controller.postMessage({ type: 'register-server', listenPort: port, port: port2 }, [port2])
  const urlInput = document.getElementById('preview-url') as HTMLInputElement
  urlInput.value = `http://localhost:${port}/`
  setTimeout(() => loadPreview(port, '/'), 300)
}

function unregisterServerWithSW(port: number) {
  navigator.serviceWorker.controller?.postMessage({ type: 'unregister-server', listenPort: port })
}

async function loadPreview(port: number, path: string) {
  const base = import.meta.env.BASE_URL
  const proxyPrefix = base.endsWith('/') ? `${base}_proxy/` : `${base}/_proxy/`
  const proxyUrl = `${location.origin}${proxyPrefix}${port}${path}`
  try {
    const resp = await fetch(proxyUrl)
    let html = await resp.text()
    if (!html.trim()) return
    const injection = `<base href="${location.origin}${proxyPrefix}${port}${path}"><script>
;(function(){
  var _b='${location.origin}${proxyPrefix}${port}';
  function _p(u){return(typeof u==='string'&&u.startsWith('/')&&!u.startsWith('//'))?_b+u:u}
  var _f=window.fetch;window.fetch=function(u,o){return _f.call(this,_p(u),o)};
  var _x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return _x.apply(this,[m,_p(u)].concat([].slice.call(arguments,2)))};
})();
<\/script>`
    if (html.includes('<head>')) html = html.replace('<head>', '<head>' + injection)
    else html = injection + html
    previewFrame.srcdoc = html
  } catch { /* preview unavailable */ }
}

// ── Hidden test-interface log buffer ─────────────────────────────────────────

const _testLog = document.getElementById('terminal') as HTMLDivElement
let _cmdSeq = 0

function _appendTestLog(text: string) {
  _testLog.textContent = (_testLog.textContent ?? '') + text
}

// ── DOM refs ─────────────────────────────────────────────────────────────────

const sidebar         = document.getElementById('sidebar') as HTMLDivElement
const editorPanel     = document.getElementById('editor-panel') as HTMLDivElement
const previewPanel    = document.getElementById('preview-panel') as HTMLDivElement
const previewFrame    = document.getElementById('preview') as HTMLIFrameElement
const termPanel       = document.getElementById('terminal-panel') as HTMLDivElement
const termXterm       = document.getElementById('terminal-xterm') as HTMLDivElement
const termTopbarCwd   = document.getElementById('terminal-topbar-cwd') as HTMLSpanElement
const explorerEl      = document.getElementById('explorer') as HTMLDivElement
const workerStatusEl  = document.getElementById('worker-status') as HTMLDivElement
const btnSidebarTgl   = document.getElementById('btn-sidebar-toggle') as HTMLButtonElement
const btnEditor       = document.getElementById('btn-editor') as HTMLButtonElement
const btnPreview      = document.getElementById('btn-preview') as HTMLButtonElement
const btnRun          = document.getElementById('btn-run') as HTMLButtonElement
const btnNewFile      = document.getElementById('btn-new-file') as HTMLButtonElement
const btnNewFileTb    = document.getElementById('btn-new-file-tb') as HTMLButtonElement
const btnRefresh      = document.getElementById('btn-refresh') as HTMLButtonElement
const statusbarFile   = document.getElementById('statusbar-file') as HTMLSpanElement
const statusbarMsg    = document.getElementById('statusbar-msg') as HTMLSpanElement
const termDrag        = document.getElementById('terminal-drag') as HTMLDivElement

// ── UI components ─────────────────────────────────────────────────────────────

const editor = new Editor(editorPanel)
const terminalUI = new TerminalUI(termXterm, (cmd) => {
  send({ type: 'terminal-cmd', cmdline: cmd })
})
const explorer = new FileExplorer(
  explorerEl,
  (path) => { send({ type: 'vfs-read', path }) },
  (path) => { send({ type: 'vfs-list', path }) },
)

// ── Sidebar toggle ────────────────────────────────────────────────────────────

let sidebarOpen = window.innerWidth >= 640

function setSidebar(open: boolean) {
  sidebarOpen = open
  sidebar.classList.toggle('collapsed', !open)
  setTimeout(() => terminalUI.refit(), 150)
}

setSidebar(sidebarOpen)
btnSidebarTgl.addEventListener('click', () => setSidebar(!sidebarOpen))

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    setSidebar(!sidebarOpen)
  }
})

// ── Tab toggle ────────────────────────────────────────────────────────────────

function showTab(tab: 'editor' | 'preview') {
  const isEditor = tab === 'editor'
  editorPanel.classList.toggle('hidden', !isEditor)
  previewPanel.classList.toggle('visible', !isEditor)
  btnEditor.classList.toggle('active', isEditor)
  btnPreview.classList.toggle('active', !isEditor)
  if (isEditor) terminalUI.refit()
}

btnEditor.addEventListener('click', () => showTab('editor'))
btnPreview.addEventListener('click', () => showTab('preview'))
showTab('editor')

// ── Run button ────────────────────────────────────────────────────────────────

btnRun.addEventListener('click', () => {
  if (!workerReady) return
  const code = editor.value
  const filename = editor.filename
  send({ type: 'run', code, filename })
  terminalUI.write(`\x1b[35m▶ node ${filename}\x1b[0m\r\n`)
})

// ── New file ─────────────────────────────────────────────────────────────────

function promptNewFile() {
  const name = prompt('New file path (e.g. /examples/myapp/index.js):')
  if (!name?.trim()) return
  const path = name.trim().startsWith('/') ? name.trim() : '/examples/' + name.trim()
  send({ type: 'write-file', path, content: '' })
  send({ type: 'vfs-read', path })
  explorer.refresh()
}

btnNewFile.addEventListener('click', promptNewFile)
btnNewFileTb.addEventListener('click', promptNewFile)

// ── Preview refresh ───────────────────────────────────────────────────────────

btnRefresh.addEventListener('click', () => {
  const urlInput = document.getElementById('preview-url') as HTMLInputElement
  const port = parseInt(urlInput.value.match(/:(\d+)/)?.[1] ?? '3000', 10)
  previewFrame.srcdoc = ''
  loadPreview(port, '/')
})

// ── Terminal resize drag ──────────────────────────────────────────────────────

let _dragging = false
let _dragStartY = 0
let _dragStartH = 0

termDrag.addEventListener('mousedown', (e) => {
  _dragging = true
  _dragStartY = e.clientY
  _dragStartH = termPanel.offsetHeight
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
})

document.addEventListener('mousemove', (e) => {
  if (!_dragging) return
  const delta = _dragStartY - e.clientY
  const newH = Math.max(80, Math.min(window.innerHeight * 0.8, _dragStartH + delta))
  termPanel.style.height = newH + 'px'
  terminalUI.refit()
})

document.addEventListener('mouseup', () => {
  if (!_dragging) return
  _dragging = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

// ── Worker messages ───────────────────────────────────────────────────────────

function setWorkerStatus(state: 'loading' | 'ready' | 'busy' | 'error') {
  workerStatusEl.className = ''
  if (state !== 'loading') workerStatusEl.classList.add(state)
}

function setStatusMsg(msg: string) {
  statusbarMsg.textContent = msg
}

runtimeWorker.addEventListener('message', (e: MessageEvent) => {
  const { type, ...p } = e.data ?? {}

  if (type === 'ready') {
    workerReady = true
    btnRun.disabled = false
    setWorkerStatus('ready')
    setStatusMsg('Ready')
    _appendTestLog('[runtime] Worker ready.\n')
    // Transfer SW↔Worker MessageChannel port
    const { port1: toWorker, port2: toShell } = new MessageChannel()
    send({ type: 'set-sw-port', port: toWorker }, [toWorker])
    toShell.close()
    terminalUI.setReady('/examples')
    explorer.refresh()
    return
  }

  if (type === 'stdout') {
    _appendTestLog(p.text)
    terminalUI.write(p.text)
    return
  }
  if (type === 'stderr') {
    _appendTestLog(p.text)
    terminalUI.write(`\x1b[31m${p.text}\x1b[0m`)
    return
  }

  if (type === 'terminal-done') {
    if (p.exitCode === -1) terminalUI.clear()
    if (p.cwd) {
      terminalUI.setCwd(p.cwd)
      termTopbarCwd.textContent = p.cwd
    }
    terminalUI.showPrompt()
    setWorkerStatus('ready')
    _appendTestLog(`[cmd:${++_cmdSeq}:exit${p.exitCode ?? 0}]\n`)
    return
  }

  if (type === 'terminal-cwd') {
    terminalUI.setCwd(p.cwd)
    termTopbarCwd.textContent = p.cwd
    return
  }

  if (type === 'vfs-changed') {
    explorer.refresh()
    return
  }

  if (type === 'vfs-list-result') {
    explorer.updateDir(p.path, p.entries)
    return
  }

  if (type === 'vfs-read-result') {
    if (p.content !== null && p.content !== undefined) {
      editor.setContent(p.content, p.path)
      explorer.setActive(p.path)
      statusbarFile.textContent = p.path
      showTab('editor')
    }
    return
  }

  if (type === 'server-listen') {
    if (_listenTimers.has(p.port)) clearTimeout(_listenTimers.get(p.port)!)
    _listenTimers.set(p.port, setTimeout(() => {
      _listenTimers.delete(p.port)
      registerServerWithSW(p.port)
      setStatusMsg(`Server on :${p.port}`)
    }, 50))
    return
  }

  if (type === 'server-close') {
    unregisterServerWithSW(p.port)
    setStatusMsg('Ready')
    return
  }

  if (type === 'npm-done') {
    setWorkerStatus('ready')
    setStatusMsg('Ready')
    return
  }
})

runtimeWorker.addEventListener('error', (e) => {
  setWorkerStatus('error')
  terminalUI.write(`\x1b[31m[worker error] ${e.message}\x1b[0m\r\n`)
})

// ── Boot ──────────────────────────────────────────────────────────────────────

setStatusMsg('Initializing…')
registerSW()

// Playwright test hook
;(window as unknown as Record<string, unknown>)._sendToWorker = (msg: unknown) => runtimeWorker.postMessage(msg)

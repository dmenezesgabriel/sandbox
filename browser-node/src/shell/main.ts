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
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
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
  const proxyUrl = `${location.origin}/_proxy/${port}${path}`
  try {
    const resp = await fetch(proxyUrl)
    let html = await resp.text()
    if (!html.trim()) return
    const injection = `<base href="${location.origin}/_proxy/${port}${path}"><script>
;(function(){
  var _b='${location.origin}/_proxy/${port}';
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
// E2E tests (Playwright/Cucumber) check document.getElementById('terminal').textContent.
// xterm.js renders to canvas so tests can't read it — this hidden div shadows all output.

const _testLog = document.getElementById('terminal') as HTMLDivElement

function _appendTestLog(text: string) {
  _testLog.textContent = (_testLog.textContent ?? '') + text
}

// ── DOM refs ─────────────────────────────────────────────────────────────────

const editorPanel = document.getElementById('editor-panel') as HTMLDivElement
const previewPanel = document.getElementById('preview-panel') as HTMLDivElement
const previewFrame = document.getElementById('preview') as HTMLIFrameElement
const termPanel = document.getElementById('terminal-panel') as HTMLDivElement
const explorerEl = document.getElementById('explorer') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const btnEditor = document.getElementById('btn-editor') as HTMLButtonElement
const btnPreview = document.getElementById('btn-preview') as HTMLButtonElement
const btnRun = document.getElementById('btn-run') as HTMLButtonElement
const btnNewFile = document.getElementById('btn-new-file') as HTMLButtonElement
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement

// ── UI components ─────────────────────────────────────────────────────────────

const editor = new Editor(editorPanel)
const terminalUI = new TerminalUI(termPanel, (cmd) => {
  send({ type: 'terminal-cmd', cmdline: cmd })
})
const explorer = new FileExplorer(
  explorerEl,
  (path) => { send({ type: 'vfs-read', path }) },
  (path) => { send({ type: 'vfs-list', path }) },
)

// ── Tab toggle ────────────────────────────────────────────────────────────────

function showTab(tab: 'editor' | 'preview') {
  const isEditor = tab === 'editor'
  editorPanel.style.display = isEditor ? 'flex' : 'none'
  previewPanel.style.display = isEditor ? 'none' : 'flex'
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

btnNewFile.addEventListener('click', () => {
  const name = prompt('New file path (e.g. /app/index.js):')
  if (!name?.trim()) return
  const path = name.trim().startsWith('/') ? name.trim() : '/app/' + name.trim()
  send({ type: 'write-file', path, content: '' })
  send({ type: 'vfs-read', path })
  explorer.refresh()
})

// ── Preview refresh ───────────────────────────────────────────────────────────

btnRefresh.addEventListener('click', () => {
  const urlInput = document.getElementById('preview-url') as HTMLInputElement
  const port = parseInt(urlInput.value.match(/:(\d+)/)?.[1] ?? '3000', 10)
  previewFrame.srcdoc = ''
  loadPreview(port, '/')
})

// ── Worker messages ───────────────────────────────────────────────────────────

function setStatus(msg: string) { statusEl.textContent = msg }

runtimeWorker.addEventListener('message', (e: MessageEvent) => {
  const { type, ...p } = e.data ?? {}

  if (type === 'ready') {
    workerReady = true
    setStatus('Ready')
    _appendTestLog('[runtime] Worker ready.\n')
    // Transfer SW↔Worker MessageChannel port
    const { port1: toWorker, port2: toShell } = new MessageChannel()
    send({ type: 'set-sw-port', port: toWorker }, [toWorker])
    toShell.close()
    terminalUI.setReady('/')
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
    if (p.cwd) terminalUI.setCwd(p.cwd)
    terminalUI.showPrompt()
    return
  }

  if (type === 'terminal-cwd') {
    terminalUI.setCwd(p.cwd)
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
      showTab('editor')
      // Auto-save: wire future edits back to VFS
    }
    return
  }

  if (type === 'server-listen') {
    if (_listenTimers.has(p.port)) clearTimeout(_listenTimers.get(p.port)!)
    _listenTimers.set(p.port, setTimeout(() => {
      _listenTimers.delete(p.port)
      registerServerWithSW(p.port)
    }, 50))
    return
  }

  if (type === 'server-close') {
    unregisterServerWithSW(p.port)
    return
  }

  if (type === 'npm-done') {
    setStatus('Ready')
    return
  }
})

runtimeWorker.addEventListener('error', (e) => {
  terminalUI.write(`\x1b[31m[worker error] ${e.message}\x1b[0m\r\n`)
})

// ── Boot ──────────────────────────────────────────────────────────────────────

setStatus('Initializing…')
registerSW()

// Playwright test hook
;(window as unknown as Record<string, unknown>)._sendToWorker = (msg: unknown) => runtimeWorker.postMessage(msg)

/// <reference lib="webworker" />
// Service Worker: routes preview iframe requests to the in-Worker HTTP handler.
//
// Two routing modes:
//   1. Same-origin proxy path  /_proxy/<port>/<path>  (works in all Chrome versions)
//   2. Cross-origin localhost  http://localhost:<port>/<path>  (sub-resource fetches only)

const serverPorts = new Map()

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener('message', (e) => {
  const { type, port, listenPort } = e.data ?? {}
  if (type === 'register-server') {
    serverPorts.set(listenPort, port)
  } else if (type === 'unregister-server') {
    serverPorts.delete(listenPort)
  }
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Debug test: return a static response for /_sw-test
  if (url.pathname === '/_sw-test') {
    e.respondWith(new Response('<h1>SW Test OK</h1>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }))
    return
  }

  // Mode 1: same-origin proxy path
  const basePath = new URL(self.registration.scope).pathname
  const proxyPrefix = basePath.endsWith('/') ? basePath + '_proxy/' : basePath + '/_proxy/'

  if (url.pathname.startsWith(proxyPrefix)) {
    const parts = url.pathname.slice(proxyPrefix.length).split('/')
    const listenPort = parseInt(parts[0], 10)
    const workerPort = serverPorts.get(listenPort)
    if (workerPort) {
      const proxiedPath = '/' + parts.slice(1).join('/') + (url.search || '')
      e.respondWith(forwardToWorker(workerPort, e.request, proxiedPath, listenPort))
    }
    return
  }

  // Mode 2: cross-origin localhost (sub-resource requests from pages in SW scope)
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return
  const port = url.port ? parseInt(url.port, 10) : 80
  const workerPort = serverPorts.get(port)
  if (!workerPort) return
  e.respondWith(forwardToWorker(workerPort, e.request, url.pathname + url.search, port))
})

async function forwardToWorker(workerPort, request, path, listenPort) {
  const body = request.body ? await request.arrayBuffer() : null

  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel()

    // Safety timeout: if the Worker never responds, unblock the fetch.
    const timeout = setTimeout(() => {
      port1.close()
      resolve(new Response(`<pre>Timeout: Worker did not respond for port ${listenPort}</pre>`, {
        status: 408,
        headers: { 'content-type': 'text/html', 'Cross-Origin-Resource-Policy': 'cross-origin' }
      }))
    }, 8000)

    port1.onmessage = (e) => {
      clearTimeout(timeout)
      const { status, headers, body } = e.data
      // Add COEP-compatible headers so Chrome allows embedding in a COEP:credentialless page
      const responseHeaders = {
        ...headers,
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      }
      resolve(new Response(body, { status, headers: responseHeaders }))
      port1.close()
    }

    workerPort.postMessage(
      {
        type: 'http-request',
        listenPort,
        method: request.method,
        url: path,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        replyPort: port2,
      },
      body ? [port2, body] : [port2]
    )
  })
}

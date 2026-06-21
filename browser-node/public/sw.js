/// <reference lib="webworker" />
// Service Worker: intercepts localhost fetches from the preview iframe
// and routes them to the Express-compatible handler running in the Web Worker.

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
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return

  const port = url.port ? parseInt(url.port, 10) : 80
  const workerPort = serverPorts.get(port)

  if (!workerPort) {
    // No registered server on this port — let the request pass through normally.
    // This ensures the Vite dev server (port 5173) and other non-app ports work fine.
    return
  }

  e.respondWith(forwardToWorker(workerPort, e.request, url, port))
})

async function forwardToWorker(workerPort, request, url, listenPort) {
  const body = request.body ? await request.arrayBuffer() : null

  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel()

    port1.onmessage = (e) => {
      const { status, headers, body } = e.data
      resolve(new Response(body, { status, headers }))
      port1.close()
    }

    workerPort.postMessage(
      {
        type: 'http-request',
        listenPort,
        method: request.method,
        url: url.pathname + url.search,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        replyPort: port2,
      },
      body ? [port2, body] : [port2]
    )
  })
}

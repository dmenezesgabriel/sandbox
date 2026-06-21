/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

// Map of port → MessageChannel port connected to the Web Worker
const serverPorts = new Map<number, MessagePort>()

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// Shell sends us a MessageChannel port when a "server" starts listening
self.addEventListener('message', (e: ExtendableMessageEvent) => {
  const { type, port, listenPort } = e.data ?? {}
  if (type === 'register-server') {
    serverPorts.set(listenPort, port)
  } else if (type === 'unregister-server') {
    serverPorts.delete(listenPort)
  }
})

self.addEventListener('fetch', (e: FetchEvent) => {
  const url = new URL(e.request.url)

  // Only intercept localhost:<port> requests from the preview iframe
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return

  const port = url.port ? parseInt(url.port, 10) : 80
  const workerPort = serverPorts.get(port)

  if (!workerPort) {
    // No server registered on this port — return a helpful error page
    e.respondWith(
      new Response(
        `<html><body style="font-family:monospace;padding:20px;background:#1e1e1e;color:#f44747">
          <h2>No server on port ${port}</h2>
          <p>Run your code first to start a server.</p>
        </body></html>`,
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      )
    )
    return
  }

  e.respondWith(forwardToWorker(workerPort, e.request, url))
})

async function forwardToWorker(
  workerPort: MessagePort,
  request: Request,
  url: URL
): Promise<Response> {
  const body = request.body ? await request.arrayBuffer() : null

  return new Promise<Response>((resolve) => {
    const { port1, port2 } = new MessageChannel()

    port1.onmessage = (e) => {
      const { status, headers, body } = e.data
      resolve(new Response(body, { status, headers }))
      port1.close()
    }

    workerPort.postMessage(
      {
        type: 'http-request',
        listenPort: port,
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

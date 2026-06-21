import { EventEmitter } from './events'
import { Readable, Writable } from './stream'

// Registry of servers keyed by port, so the Worker can route SW requests
const servers = new Map<number, HttpServer>()

export function getServer(port: number): HttpServer | undefined {
  return servers.get(port)
}

export class IncomingMessage extends Readable {
  method: string
  url: string
  headers: Record<string, string>
  httpVersion = '1.1'
  socket = { remoteAddress: '127.0.0.1' }

  constructor(opts: { method: string; url: string; headers: Record<string, string>; body?: ArrayBuffer }) {
    super()
    this.method = opts.method
    this.url = opts.url
    this.headers = opts.headers
    if (opts.body) {
      queueMicrotask(() => {
        this.emit('data', new Uint8Array(opts.body!))
        this.emit('end')
      })
    } else {
      queueMicrotask(() => this.emit('end'))
    }
  }
}

export class ServerResponse extends Writable {
  statusCode = 200
  statusMessage = 'OK'
  headers: Record<string, string> = { 'content-type': 'text/html' }
  private _replyPort: MessagePort | null = null
  private _finished = false

  constructor(replyPort: MessagePort) {
    super()
    this._replyPort = replyPort
  }

  setHeader(name: string, value: string | number): void {
    this.headers[name.toLowerCase()] = String(value)
  }

  getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()]
  }

  removeHeader(name: string): void {
    delete this.headers[name.toLowerCase()]
  }

  writeHead(status: number, headers?: Record<string, string>): this {
    this.statusCode = status
    if (headers) Object.assign(this.headers, headers)
    return this
  }

  end(body?: string | Uint8Array, _enc?: string, cb?: () => void): this {
    if (this._finished) return this
    this._finished = true
    super.end(body)

    const bodyStr = this.getContents()
    this._replyPort?.postMessage({
      status: this.statusCode,
      headers: this.headers,
      body: bodyStr,
    })
    this._replyPort = null
    cb?.()
    return this
  }
}

export class HttpServer extends EventEmitter {
  private _handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null
  private _port = 0

  // Called by the SW-dispatch code in the worker (index.ts)
  handleRequest(msg: {
    method: string
    url: string
    headers: Record<string, string>
    body?: ArrayBuffer
    replyPort: MessagePort
  }) {
    const req = new IncomingMessage(msg)
    const res = new ServerResponse(msg.replyPort)
    this._handler?.(req, res)
  }

  listen(port: number, cb?: () => void): this {
    this._port = port
    servers.set(port, this)
    // Notify the main thread so it can tell the SW to register this port
    self.postMessage({ type: 'server-listen', port })
    cb?.()
    this.emit('listening')
    return this
  }

  close(cb?: () => void): this {
    servers.delete(this._port)
    self.postMessage({ type: 'server-close', port: this._port })
    cb?.()
    this.emit('close')
    return this
  }

  address() { return { port: this._port, address: '127.0.0.1', family: 'IPv4' } }
}

export function createServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): HttpServer {
  const server = new HttpServer()
  server.on('request' as string, handler as unknown as () => void)
  // Attach handler directly for easy call
  ;(server as unknown as { _handler: typeof handler })._handler = handler
  return server
}

export const http = { createServer, IncomingMessage, ServerResponse, HttpServer, STATUS_CODES: {} as Record<number, string> }
export const https = http

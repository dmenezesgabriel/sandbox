export function inherits(ctor: Function, superCtor: Function) {
  if (!superCtor || !superCtor.prototype) return
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
  Object.defineProperty(ctor.prototype, 'constructor', {
    value: ctor, enumerable: false, writable: true, configurable: true,
  })
}

export function promisify(fn: Function) {
  return (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      fn(...args, (err: Error | null, value: unknown) => {
        if (err) reject(err)
        else resolve(value)
      })
    })
}

export function callbackify(fn: (...args: unknown[]) => Promise<unknown>) {
  return (...args: unknown[]) => {
    const cb = args.pop() as (err: Error | null, value?: unknown) => void
    fn(...args).then((v) => cb(null, v), cb)
  }
}

export function deprecate<T extends Function>(fn: T, msg: string): T {
  let warned = false
  return ((...args: unknown[]) => {
    if (!warned) { warned = true; console.warn(`DeprecationWarning: ${msg}`) }
    return fn(...args)
  }) as unknown as T
}

export const types = {
  isPromise: (v: unknown): v is Promise<unknown> => v instanceof Promise,
  isRegExp: (v: unknown): v is RegExp => v instanceof RegExp,
  isDate: (v: unknown): v is Date => v instanceof Date,
  isError: (v: unknown): v is Error => v instanceof Error,
  isMap: (v: unknown): v is Map<unknown, unknown> => v instanceof Map,
  isSet: (v: unknown): v is Set<unknown> => v instanceof Set,
  isArrayBuffer: (v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer,
  isUint8Array: (v: unknown): v is Uint8Array => v instanceof Uint8Array,
}

export function format(fmt: unknown, ...args: unknown[]): string {
  if (typeof fmt !== 'string') return [fmt, ...args].map(inspect).join(' ')
  let i = 0
  const result = fmt.replace(/%[sdifjoO%]/g, (m) => {
    if (m === '%%') return '%'
    const arg = args[i++]
    if (m === '%s') return String(arg)
    if (m === '%d' || m === '%i') return String(Number(arg))
    if (m === '%f') return String(parseFloat(String(arg)))
    if (m === '%j') return JSON.stringify(arg)
    if (m === '%o' || m === '%O') return inspect(arg)
    return m
  })
  return i < args.length ? result + ' ' + args.slice(i).map(inspect).join(' ') : result
}

export function inspect(value: unknown, _opts?: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`
  if (Array.isArray(value)) return `[ ${value.map(v => inspect(v)).join(', ')} ]`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export const util = { inherits, promisify, callbackify, deprecate, types, format, inspect }

export const process = {
  env: { NODE_ENV: 'development' } as Record<string, string | undefined>,
  argv: ['node', 'script.js'],
  version: 'v22.0.0',
  versions: { node: '22.0.0', v8: '12.0.0' },
  platform: 'browser' as NodeJS.Platform,
  arch: 'wasm32',
  pid: 1,
  ppid: 0,
  exitCode: 0,
  cwd: () => '/',
  chdir: (_dir: string) => {},
  nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
    queueMicrotask(() => fn(...args))
  },
  hrtime: (time?: [number, number]): [number, number] => {
    const ns = BigInt(Math.round(performance.now() * 1e6))
    if (time) {
      const diff = ns - BigInt(time[0]) * 1_000_000_000n - BigInt(time[1])
      return [Number(diff / 1_000_000_000n), Number(diff % 1_000_000_000n)]
    }
    return [Number(ns / 1_000_000_000n), Number(ns % 1_000_000_000n)]
  },
  exit: (code = 0) => {
    throw new Error(`process.exit(${code})`)
  },
  stdout: {
    write: (s: string) => { self.postMessage({ type: 'stdout', text: s }); return true },
  },
  stderr: {
    write: (s: string) => { self.postMessage({ type: 'stderr', text: s }); return true },
  },
  on: (_event: string, _listener: unknown) => {},
  off: (_event: string, _listener: unknown) => {},
  emit: (_event: string, ..._args: unknown[]) => false,
}

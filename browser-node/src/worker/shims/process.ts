export const process = {
  env: {
    NODE_ENV: 'development',
    NODE_NO_WARNINGS: '1',
  } as Record<string, string | undefined>,
  argv: ['node', 'script.js'],
  version: 'v22.0.0',
  versions: { node: '22.0.0', v8: '12.0.0' },
  platform: 'linux' as NodeJS.Platform,
  arch: 'x64',
  pid: 1,
  ppid: 0,
  exitCode: 0,
  cwd: () => '/app',
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
    isTTY: false,
    columns: 80,
    rows: 24,
  },
  stderr: {
    write: (s: string) => { self.postMessage({ type: 'stderr', text: s }); return true },
    isTTY: false,
    columns: 80,
    rows: 24,
  },
  on: (_event: string, _listener: unknown) => process,
  off: (_event: string, _listener: unknown) => process,
  once: (_event: string, _listener: unknown) => process,
  emit: (_event: string, ..._args: unknown[]) => false,
  removeListener: (_event: string, _listener: unknown) => process,
  addListener: (_event: string, _listener: unknown) => process,
}

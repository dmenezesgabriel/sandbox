const proc = {
  env: { NODE_ENV: 'development' } as Record<string, string | undefined>,
  argv: ['node'],
  version: 'v22.0.0',
  versions: { node: '22.0.0' },
  platform: 'browser',
  cwd: () => '/',
  nextTick: (fn: () => void) => queueMicrotask(fn),
  exit: () => {},
  stdout: { write: () => true },
  stderr: { write: () => true },
  on: () => {},
}
export default proc
export const { env, argv, version, versions, platform, cwd, nextTick, exit, stdout, stderr } = proc

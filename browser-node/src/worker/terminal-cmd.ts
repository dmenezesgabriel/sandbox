import { memfsInstance, existsInVfs, writeFileToVfs } from './vfs'
import { path as pathMod } from './shims/path'

type RequireFn = (id: string, fromDir: string) => unknown
type InstallFn  = (packages: Record<string, string>) => Promise<void>

let _require: RequireFn | null = null
let _install: InstallFn | null = null

export function bindTerminalDeps(req: RequireFn, inst: InstallFn) {
  _require = req
  _install = inst
}

let _cwd = '/'
export function getCwd() { return _cwd }

function stdout(text: string) { self.postMessage({ type: 'stdout', text }) }
function stderr(text: string) { self.postMessage({ type: 'stderr', text }) }
function notifyVfsChanged() { self.postMessage({ type: 'vfs-changed' }) }

// ── Path helpers ────────────────────────────────────────────────────────────

function resolve(p: string): string {
  if (!p || p === '~') return '/home/user'
  if (p.startsWith('~/')) p = '/home/user' + p.slice(1)
  if (p.startsWith('/')) return normalize(p)
  return normalize(_cwd + '/' + p)
}

function normalize(p: string): string {
  const parts = p.split('/').filter(Boolean)
  const out: string[] = []
  for (const s of parts) {
    if (s === '..') { if (out.length) out.pop() }
    else if (s !== '.') out.push(s)
  }
  return '/' + out.join('/')
}

// ── Tokenizer (handles single/double quotes) ────────────────────────────────

function tokenize(line: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let q = ''
  for (const ch of line) {
    if (q) { if (ch === q) q = ''; else cur += ch }
    else if (ch === '"' || ch === "'") { q = ch }
    else if (ch === ' ' || ch === '\t') { if (cur) { tokens.push(cur); cur = '' } }
    else { cur += ch }
  }
  if (cur) tokens.push(cur)
  return tokens
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function runCommand(cmdline: string): Promise<number> {
  const tokens = tokenize(cmdline.trim())
  if (!tokens.length) return 0
  const [cmd, ...args] = tokens
  try {
    switch (cmd) {
      case 'ls':    case 'dir':  return cmdLs(args)
      case 'cd':                 return cmdCd(args)
      case 'pwd':                return cmdPwd()
      case 'mkdir':              return cmdMkdir(args)
      case 'rm':                 return cmdRm(args)
      case 'mv':                 return cmdMv(args)
      case 'cp':                 return cmdCp(args)
      case 'touch':              return cmdTouch(args)
      case 'cat':                return cmdCat(args)
      case 'echo':               return cmdEcho(args)
      case 'node':               return await cmdNode(args)
      case 'npm':                return await cmdNpm(args)
      case 'npx':                return await cmdNpx(args)
      case 'vite':               return await cmdVite(args)
      case 'which':              return cmdWhich(args)
      case 'env':                return cmdEnv()
      case 'export':             return cmdExport(args)
      case 'find':               return cmdFind(args)
      case 'head':               return cmdHead(args)
      case 'tail':               return cmdTail(args)
      case 'grep':               return cmdGrep(args)
      case 'clear':              return -1
      case 'help': case '?':     return cmdHelp()
      case 'exit': case 'quit':  return 0
      default:
        stderr(`\x1b[31m${cmd}: command not found\x1b[0m\n`)
        return 127
    }
  } catch (e) {
    stderr(`\x1b[31m${cmd}: ${(e as Error).message}\x1b[0m\n`)
    return 1
  }
}

// ── ls ───────────────────────────────────────────────────────────────────────

function cmdLs(args: string[]): number {
  const flags = args.filter(a => a.startsWith('-')).join('')
  const showHidden = flags.includes('a') || flags.includes('A')
  const longFmt = flags.includes('l')
  const targets = args.filter(a => !a.startsWith('-'))
  const dir = targets[0] ? resolve(targets[0]) : _cwd

  let entries: string[]
  try { entries = (memfsInstance.readdirSync(dir) as string[]).sort() }
  catch { stderr(`ls: cannot access '${dir}': No such file or directory\n`); return 1 }

  if (!showHidden) entries = entries.filter(e => !e.startsWith('.'))

  if (longFmt) {
    stdout('total ' + entries.length + '\n')
    for (const e of entries) {
      const fp = dir === '/' ? '/' + e : dir + '/' + e
      try {
        const st = memfsInstance.statSync(fp) as { isDirectory(): boolean; size: number }
        const isDir = st.isDirectory()
        const size = isDir ? 0 : st.size
        const sizeStr = String(size).padStart(8)
        const name = isDir ? `\x1b[34m${e}/\x1b[0m` : e
        stdout(`${isDir ? 'd' : '-'}rwxr-xr-x 1 user user ${sizeStr} Jan  1 00:00 ${name}\n`)
      } catch { stdout(e + '\n') }
    }
  } else {
    const colored = entries.map(e => {
      const fp = dir === '/' ? '/' + e : dir + '/' + e
      try {
        const isDir = (memfsInstance.statSync(fp) as { isDirectory(): boolean }).isDirectory()
        return isDir ? `\x1b[34m${e}/\x1b[0m` : e
      } catch { return e }
    })
    // Print in columns (up to 4 per row)
    const cols = 4
    const rows = Math.ceil(colored.length / cols)
    const colW = 20
    const lines: string[] = []
    for (let r = 0; r < rows; r++) {
      let line = ''
      for (let c = 0; c < cols; c++) {
        const item = colored[r + c * rows]
        if (item !== undefined) line += item.padEnd(colW + (item.length - stripAnsi(item).length))
      }
      lines.push(line.trimEnd())
    }
    stdout(lines.join('\n') + '\n')
  }
  return 0
}

function stripAnsi(s: string) { return s.replace(/\x1b\[[^m]*m/g, '') }

// ── cd ───────────────────────────────────────────────────────────────────────

function cmdCd(args: string[]): number {
  const target = resolve(args[0] ?? '/home/user')
  try {
    const st = memfsInstance.statSync(target) as { isDirectory(): boolean }
    if (!st.isDirectory()) { stderr(`cd: ${args[0]}: Not a directory\n`); return 1 }
    _cwd = target
    self.postMessage({ type: 'terminal-cwd', cwd: _cwd })
    return 0
  } catch { stderr(`cd: ${args[0] ?? ''}: No such file or directory\n`); return 1 }
}

// ── pwd ──────────────────────────────────────────────────────────────────────

function cmdPwd(): number { stdout(_cwd + '\n'); return 0 }

// ── mkdir ────────────────────────────────────────────────────────────────────

function cmdMkdir(args: string[]): number {
  const recursive = args.includes('-p')
  const paths = args.filter(a => !a.startsWith('-'))
  if (!paths.length) { stderr('mkdir: missing operand\n'); return 1 }
  for (const p of paths) {
    try {
      memfsInstance.mkdirSync(resolve(p), { recursive } as { recursive: boolean })
    } catch (e) { stderr(`mkdir: ${p}: ${(e as Error).message}\n`); return 1 }
  }
  notifyVfsChanged(); return 0
}

// ── rm ───────────────────────────────────────────────────────────────────────

function cmdRm(args: string[]): number {
  const flags = args.filter(a => a.startsWith('-')).join('')
  const rec = flags.includes('r') || flags.includes('R')
  const force = flags.includes('f')
  const paths = args.filter(a => !a.startsWith('-'))
  for (const p of paths) {
    const abs = resolve(p)
    try {
      const st = memfsInstance.statSync(abs) as { isDirectory(): boolean }
      if (st.isDirectory()) {
        if (!rec) { stderr(`rm: ${p}: Is a directory\n`); return 1 }
        rmDir(abs)
      } else {
        memfsInstance.unlinkSync(abs)
      }
    } catch (e) { if (!force) { stderr(`rm: ${p}: ${(e as Error).message}\n`); return 1 } }
  }
  notifyVfsChanged(); return 0
}

function rmDir(abs: string) {
  for (const e of memfsInstance.readdirSync(abs) as string[]) {
    const fp = abs + '/' + e
    const st = memfsInstance.statSync(fp) as { isDirectory(): boolean }
    if (st.isDirectory()) rmDir(fp)
    else memfsInstance.unlinkSync(fp)
  }
  memfsInstance.rmdirSync(abs)
}

// ── mv ───────────────────────────────────────────────────────────────────────

function cmdMv(args: string[]): number {
  const src = args[0]; const dest = args[1]
  if (!src || !dest) { stderr('mv: missing operand\n'); return 1 }
  try { memfsInstance.renameSync(resolve(src), resolve(dest)); notifyVfsChanged(); return 0 }
  catch (e) { stderr(`mv: ${(e as Error).message}\n`); return 1 }
}

// ── cp ───────────────────────────────────────────────────────────────────────

function cmdCp(args: string[]): number {
  const rec = args.includes('-r') || args.includes('-R') || args.includes('-a')
  const paths = args.filter(a => !a.startsWith('-'))
  const src = paths[0]; const dest = paths[1]
  if (!src || !dest) { stderr('cp: missing operand\n'); return 1 }
  try { cpEntry(resolve(src), resolve(dest), rec); notifyVfsChanged(); return 0 }
  catch (e) { stderr(`cp: ${(e as Error).message}\n`); return 1 }
}

function cpEntry(src: string, dst: string, rec: boolean) {
  const st = memfsInstance.statSync(src) as { isDirectory(): boolean }
  if (st.isDirectory()) {
    if (!rec) throw new Error(`'${src}' is a directory (use -r)`)
    memfsInstance.mkdirSync(dst, { recursive: true } as { recursive: boolean })
    for (const e of memfsInstance.readdirSync(src) as string[])
      cpEntry(src + '/' + e, dst + '/' + e, true)
  } else {
    const content = memfsInstance.readFileSync(src)
    writeFileToVfs(dst, content as unknown as string)
  }
}

// ── touch ────────────────────────────────────────────────────────────────────

function cmdTouch(args: string[]): number {
  for (const f of args.filter(a => !a.startsWith('-'))) {
    const abs = resolve(f)
    if (!existsInVfs(abs)) writeFileToVfs(abs, '')
  }
  notifyVfsChanged(); return 0
}

// ── cat ──────────────────────────────────────────────────────────────────────

function cmdCat(args: string[]): number {
  const files = args.filter(a => !a.startsWith('-'))
  if (!files.length) { stderr('cat: no files specified\n'); return 1 }
  for (const f of files) {
    try {
      const content = memfsInstance.readFileSync(resolve(f), 'utf-8') as string
      stdout(content.endsWith('\n') ? content : content + '\n')
    } catch { stderr(`cat: ${f}: No such file or directory\n`); return 1 }
  }
  return 0
}

// ── echo ─────────────────────────────────────────────────────────────────────

function cmdEcho(args: string[]): number {
  const noNl = args[0] === '-n'
  const text = (noNl ? args.slice(1) : args)
    .join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
  stdout(text + (noNl ? '' : '\n'))
  return 0
}

// ── node ─────────────────────────────────────────────────────────────────────

async function cmdNode(args: string[]): Promise<number> {
  if (!args.length) { stderr('usage: node <file.js>\n'); return 1 }
  const file = resolve(args[0])
  try {
    const code = memfsInstance.readFileSync(file, 'utf-8') as string
    if (!_require) { stderr('node: runtime not ready\n'); return 1 }
    // Re-use the existing run message path via direct require
    const fromDir = normalize(file.split('/').slice(0, -1).join('/') || '/')
    _require(file, fromDir)
    return 0
  } catch (e) { stderr(`node: ${(e as Error).message}\n`); return 1 }
}

// ── npm ──────────────────────────────────────────────────────────────────────

async function cmdNpm(args: string[]): Promise<number> {
  const sub = args[0]
  if (!sub) { stderr('usage: npm <install|run> [...]\n'); return 1 }

  if (sub === 'install' || sub === 'i' || sub === 'add') {
    const pkgArgs = args.slice(1).filter(a => !a.startsWith('-'))
    const packages: Record<string, string> = {}
    if (pkgArgs.length) {
      for (const raw of pkgArgs) {
        const at = raw.lastIndexOf('@')
        if (at > 0) { packages[raw.slice(0, at)] = raw.slice(at + 1) }
        else { packages[raw] = 'latest' }
      }
    } else {
      // Install from package.json
      const pkgPath = _cwd + '/package.json'
      try {
        const pkg = JSON.parse(memfsInstance.readFileSync(pkgPath, 'utf-8') as string)
        Object.assign(packages, pkg.dependencies ?? {}, pkg.devDependencies ?? {})
      } catch { stderr('npm: no package.json in current directory\n'); return 1 }
    }
    if (!Object.keys(packages).length) { stdout('Nothing to install.\n'); return 0 }
    if (_install) { await _install(packages); return 0 }
    stderr('npm: installer not ready\n'); return 1
  }

  if (sub === 'run') {
    const script = args[1]
    if (!script) { stderr('npm run: script name required\n'); return 1 }
    try {
      const pkg = JSON.parse(memfsInstance.readFileSync(_cwd + '/package.json', 'utf-8') as string)
      const cmd = pkg.scripts?.[script]
      if (!cmd) { stderr(`npm run: script "${script}" not found\n`); return 1 }
      stdout(`\n> ${script}\n> ${cmd}\n\n`)
      return await runCommand(cmd)
    } catch (e) { stderr(`npm run: ${(e as Error).message}\n`); return 1 }
  }

  stderr(`npm: unknown command: ${sub}\n`); return 1
}

// ── npx ──────────────────────────────────────────────────────────────────────

async function cmdNpx(args: string[]): Promise<number> {
  if (!args.length) { stderr('usage: npx <package> [...args]\n'); return 1 }
  // For now, treat as npm-install + run
  const pkg = args[0]
  if (_install) await _install({ [pkg]: 'latest' })
  stderr(`npx: '${pkg}' execution not yet supported — package installed\n`)
  return 0
}

// ── vite ─────────────────────────────────────────────────────────────────────

async function cmdVite(args: string[]): Promise<number> {
  if (!_require) { stderr('vite: runtime not ready\n'); return 1 }

  // Ensure vite is installed
  let vite: Record<string, unknown>
  try { vite = _require('vite', _cwd) as Record<string, unknown> }
  catch { stderr('vite: not installed — run: npm install vite\n'); return 1 }

  const sub = args[0]
  if (sub === 'build') {
    stdout('vite: build is not supported in browser environment\n')
    return 1
  }

  // Default: dev server
  const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '3000', 10)
  const root = resolve(args.find(a => !a.startsWith('-')) ?? '.')
  try {
    const { createServer } = vite as { createServer: (opts: unknown) => Promise<{ listen(): Promise<void> }> }
    stdout(`Starting Vite dev server in \x1b[36m${root}\x1b[0m on port \x1b[33m${port}\x1b[0m...\n`)
    const server = await createServer({ root, server: { port }, logLevel: 'info' })
    await server.listen()
    stdout(`\x1b[32m✓\x1b[0m Vite dev server running on \x1b[36mhttp://localhost:${port}\x1b[0m\n`)
    return 0
  } catch (e) { stderr(`vite: ${(e as Error).message}\n`); return 1 }
}

// ── which ────────────────────────────────────────────────────────────────────

function cmdWhich(args: string[]): number {
  const builtins = ['ls','cd','pwd','mkdir','rm','mv','cp','touch','cat','echo',
    'node','npm','npx','vite','which','env','export','find','head','tail','grep','help','clear']
  for (const cmd of args) {
    if (builtins.includes(cmd)) stdout(`${cmd}: shell built-in\n`)
    else { stderr(`which: ${cmd}: not found\n`); return 1 }
  }
  return 0
}

// ── env ──────────────────────────────────────────────────────────────────────

function cmdEnv(): number {
  const proc = (globalThis as unknown as { process?: { env?: Record<string,string> } }).process
  const env = proc?.env ?? {}
  for (const [k, v] of Object.entries(env)) stdout(`${k}=${v}\n`)
  return 0
}

// ── export ───────────────────────────────────────────────────────────────────

function cmdExport(args: string[]): number {
  const proc = (globalThis as unknown as { process?: { env?: Record<string,string> } }).process
  if (!proc?.env) return 0
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq > 0) {
      const key = arg.slice(0, eq)
      const val = arg.slice(eq + 1)
      proc.env[key] = val
    }
  }
  return 0
}

// ── find ─────────────────────────────────────────────────────────────────────

function cmdFind(args: string[]): number {
  const root = args[0] ? resolve(args[0]) : _cwd
  const nameFilter = args[args.indexOf('-name') + 1]
  const typeFilter = args[args.indexOf('-type') + 1] // 'f' or 'd'

  function walk(dir: string) {
    let entries: string[]
    try { entries = memfsInstance.readdirSync(dir) as string[] } catch { return }
    for (const e of entries) {
      const fp = dir === '/' ? '/' + e : dir + '/' + e
      let isDir = false
      try { isDir = (memfsInstance.statSync(fp) as { isDirectory(): boolean }).isDirectory() } catch { continue }
      const matchName = !nameFilter || matchGlob(e, nameFilter)
      const matchType = !typeFilter || (typeFilter === 'f' ? !isDir : typeFilter === 'd' ? isDir : true)
      if (matchName && matchType) stdout(fp + '\n')
      if (isDir) walk(fp)
    }
  }

  walk(root); return 0
}

function matchGlob(name: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return re.test(name)
}

// ── head / tail ───────────────────────────────────────────────────────────────

function cmdHead(args: string[]): number {
  const nIdx = args.indexOf('-n')
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 10
  const files = args.filter(a => !a.startsWith('-') && !/^\d+$/.test(a))
  const file = files[0]
  if (!file) { stderr('head: file required\n'); return 1 }
  try {
    const lines = (memfsInstance.readFileSync(resolve(file), 'utf-8') as string).split('\n')
    stdout(lines.slice(0, n).join('\n') + '\n')
  } catch (e) { stderr(`head: ${(e as Error).message}\n`); return 1 }
  return 0
}

function cmdTail(args: string[]): number {
  const nIdx = args.indexOf('-n')
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 10
  const files = args.filter(a => !a.startsWith('-') && !/^\d+$/.test(a))
  const file = files[0]
  if (!file) { stderr('tail: file required\n'); return 1 }
  try {
    const lines = (memfsInstance.readFileSync(resolve(file), 'utf-8') as string).split('\n')
    stdout(lines.slice(-n).join('\n') + '\n')
  } catch (e) { stderr(`tail: ${(e as Error).message}\n`); return 1 }
  return 0
}

// ── grep ─────────────────────────────────────────────────────────────────────

function cmdGrep(args: string[]): number {
  const ignoreCase = args.includes('-i')
  const showLine = args.includes('-n')
  const filtered = args.filter(a => !a.startsWith('-'))
  const [pattern, ...files] = filtered
  if (!pattern) { stderr('usage: grep [-in] <pattern> <file...>\n'); return 1 }
  const re = new RegExp(pattern, ignoreCase ? 'i' : '')
  let found = false
  for (const f of files) {
    try {
      const lines = (memfsInstance.readFileSync(resolve(f), 'utf-8') as string).split('\n')
      lines.forEach((line, i) => {
        if (re.test(line)) {
          const prefix = files.length > 1 ? `\x1b[35m${f}\x1b[0m:` : ''
          const num = showLine ? `\x1b[33m${i + 1}\x1b[0m:` : ''
          stdout(prefix + num + line + '\n')
          found = true
        }
      })
    } catch (e) { stderr(`grep: ${f}: ${(e as Error).message}\n`) }
  }
  return found ? 0 : 1
}

// ── help ─────────────────────────────────────────────────────────────────────

function cmdHelp(): number {
  stdout(`\x1b[1mBuilt-in commands:\x1b[0m
  \x1b[36mFile system:\x1b[0m  ls [-la]  cd  pwd  mkdir [-p]  rm [-rf]  mv  cp [-r]  touch  cat  find
  \x1b[36mText:\x1b[0m         echo  head [-n N]  tail [-n N]  grep [-in]
  \x1b[36mRuntime:\x1b[0m      node <file>  npm install [pkg]  npm run <script>  vite [--port=N]
  \x1b[36mShell:\x1b[0m        env  export KEY=VAL  which  clear  help

  \x1b[90mKeyboard:\x1b[0m  ↑↓ history · Ctrl+L clear · Ctrl+C cancel
`)
  return 0
}

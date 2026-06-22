import { writeFileToVfs, mkdirpSync } from './vfs'

export function initExamples() {
  mkdirpSync('/examples')

  // ── Express ──────────────────────────────────────────────────────────────────
  mkdirpSync('/examples/express')
  writeFileToVfs('/examples/express/package.json', JSON.stringify({
    name: 'express-example', version: '1.0.0', main: 'index.js',
    dependencies: { express: '^4.18.0' }
  }, null, 2))
  writeFileToVfs('/examples/express/index.js',
`'use strict'
const express = require('express')
const app = express()
const PORT = 3000

app.get('/', function(req, res) {
  res.send(
    '<!DOCTYPE html><html><head><title>Express</title>' +
    '<style>body{font-family:sans-serif;padding:48px;max-width:640px;margin:0 auto;background:#0f1117;color:#e6edf3}' +
    'h1{color:#58a6ff;margin-bottom:8px}p{color:#8b949e;line-height:1.6}' +
    'a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}' +
    '.badge{display:inline-block;padding:3px 10px;border-radius:20px;background:rgba(88,166,255,0.15);' +
    'border:1px solid rgba(88,166,255,0.3);color:#58a6ff;font-size:12px;margin-bottom:16px}' +
    '</style></head><body>' +
    '<span class="badge">browser-node</span>' +
    '<h1>Express.js</h1>' +
    '<p>This Express server is running entirely in your browser via a Web Worker.</p>' +
    '<p><a href="/api/hello">GET /api/hello</a> &rarr; JSON endpoint</p>' +
    '</body></html>'
  )
})

app.get('/api/hello', function(req, res) {
  res.json({ message: 'Hello from Express!', framework: 'express', runtime: 'browser-node' })
})

app.listen(PORT, function() {
  console.log('Express server running on http://localhost:' + PORT)
})
`)

  // ── Fastify ───────────────────────────────────────────────────────────────────
  mkdirpSync('/examples/fastify')
  writeFileToVfs('/examples/fastify/package.json', JSON.stringify({
    name: 'fastify-example', version: '1.0.0', main: 'index.js',
    dependencies: { fastify: '^4.0.0' }
  }, null, 2))
  writeFileToVfs('/examples/fastify/index.js',
`'use strict'
const fastify = require('fastify')({ logger: false })
const PORT = 3000

fastify.get('/', async function(req, reply) {
  reply.type('text/html')
  return (
    '<!DOCTYPE html><html><head><title>Fastify</title>' +
    '<style>body{font-family:sans-serif;padding:48px;max-width:640px;margin:0 auto;background:#0f1117;color:#e6edf3}' +
    'h1{color:#e879f9;margin-bottom:8px}p{color:#8b949e;line-height:1.6}' +
    'a{color:#e879f9;text-decoration:none}a:hover{text-decoration:underline}' +
    '.badge{display:inline-block;padding:3px 10px;border-radius:20px;background:rgba(232,121,249,0.15);' +
    'border:1px solid rgba(232,121,249,0.3);color:#e879f9;font-size:12px;margin-bottom:16px}' +
    '</style></head><body>' +
    '<span class="badge">browser-node</span>' +
    '<h1>Fastify</h1>' +
    '<p>This Fastify server is running entirely in your browser via a Web Worker.</p>' +
    '<p><a href="/api/hello">GET /api/hello</a> &rarr; JSON endpoint</p>' +
    '</body></html>'
  )
})

fastify.get('/api/hello', async function(req, reply) {
  return { message: 'Hello from Fastify!', framework: 'fastify', runtime: 'browser-node' }
})

fastify.listen({ port: PORT }, function(err) {
  if (err) { console.error(err.message); return }
  console.log('Fastify server running on http://localhost:' + PORT)
})
`)

  // ── React (CDN) ───────────────────────────────────────────────────────────────
  mkdirpSync('/examples/react')
  writeFileToVfs('/examples/react/package.json', JSON.stringify({
    name: 'react-example', version: '1.0.0', main: 'server.js',
    dependencies: { express: '^4.18.0' }
  }, null, 2))
  writeFileToVfs('/examples/react/server.js',
`'use strict'
const express = require('express')
const app = express()
const PORT = 3000

const html = [
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>React App</title>',
  '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\\/script>',
  '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\\/script>',
  '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\\/script>',
  '<style>body{font-family:sans-serif;padding:48px;max-width:640px;margin:0 auto;background:#0f1117;color:#e6edf3}',
  'h1{color:#61dafb}button{margin-top:16px;padding:8px 20px;background:rgba(97,218,251,0.15);',
  'border:1px solid rgba(97,218,251,0.3);color:#61dafb;border-radius:6px;cursor:pointer;font-size:14px}',
  'button:hover{background:rgba(97,218,251,0.25)}</style>',
  '</head><body>',
  '<div id="root"></div>',
  '<script type="text/babel">',
  'function Counter() {',
  '  const [count, setCount] = React.useState(0)',
  '  return (',
  '    <div>',
  '      <h1>React Counter</h1>',
  '      <p style={{color:"#8b949e"}}>Running via CDN in browser-node</p>',
  '      <p style={{fontSize:48,margin:"16px 0"}}>{count}</p>',
  '      <button onClick={() => setCount(c => c + 1)}>Increment</button>',
  '    </div>',
  '  )',
  '}',
  'ReactDOM.createRoot(document.getElementById("root")).render(<Counter />)',
  '<\\/script>',
  '</body></html>'
].join('')

app.get('/', function(req, res) { res.send(html) })

app.listen(PORT, function() {
  console.log('React app server running on http://localhost:' + PORT)
})
`)

  // ── Vue (CDN) ─────────────────────────────────────────────────────────────────
  mkdirpSync('/examples/vue')
  writeFileToVfs('/examples/vue/package.json', JSON.stringify({
    name: 'vue-example', version: '1.0.0', main: 'server.js',
    dependencies: { express: '^4.18.0' }
  }, null, 2))
  writeFileToVfs('/examples/vue/server.js',
`'use strict'
const express = require('express')
const app = express()
const PORT = 3000

const html = [
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Vue App</title>',
  '<script src="https://unpkg.com/vue@3/dist/vue.global.js"><\\/script>',
  '<style>body{font-family:sans-serif;padding:48px;max-width:640px;margin:0 auto;background:#0f1117;color:#e6edf3}',
  'h1{color:#42d392}button{margin-top:16px;padding:8px 20px;background:rgba(66,211,146,0.15);',
  'border:1px solid rgba(66,211,146,0.3);color:#42d392;border-radius:6px;cursor:pointer;font-size:14px}',
  'button:hover{background:rgba(66,211,146,0.25)}.count{font-size:48px;margin:16px 0}',
  'p{color:#8b949e}</style>',
  '</head><body>',
  '<div id="app">',
  '  <h1>Vue Counter</h1>',
  '  <p>Running via CDN in browser-node</p>',
  '  <div class="count">{{ count }}</div>',
  '  <button @click="count++">Increment</button>',
  '</div>',
  '<script>',
  'Vue.createApp({ data() { return { count: 0 } } }).mount("#app")',
  '<\\/script>',
  '</body></html>'
].join('')

app.get('/', function(req, res) { res.send(html) })

app.listen(PORT, function() {
  console.log('Vue app server running on http://localhost:' + PORT)
})
`)

  // ── Static Node HTTP ──────────────────────────────────────────────────────────
  mkdirpSync('/examples/node-http')
  writeFileToVfs('/examples/node-http/package.json', JSON.stringify({
    name: 'node-http-example', version: '1.0.0', main: 'index.js', dependencies: {}
  }, null, 2))
  writeFileToVfs('/examples/node-http/index.js',
`'use strict'
const http = require('http')
const PORT = 3000

const server = http.createServer(function(req, res) {
  if (req.url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Hello from Node.js http module!', url: req.url }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(
    '<!DOCTYPE html><html><head><title>Node HTTP</title>' +
    '<style>body{font-family:sans-serif;padding:48px;max-width:640px;margin:0 auto;background:#0f1117;color:#e6edf3}' +
    'h1{color:#f59e0b}p{color:#8b949e;line-height:1.6}a{color:#f59e0b}' +
    '.badge{display:inline-block;padding:3px 10px;border-radius:20px;background:rgba(245,158,11,0.15);' +
    'border:1px solid rgba(245,158,11,0.3);color:#f59e0b;font-size:12px;margin-bottom:16px}' +
    '</style></head><body>' +
    '<span class="badge">built-in</span>' +
    '<h1>Node.js http</h1>' +
    '<p>Using the built-in <code>http</code> module &mdash; no dependencies needed.</p>' +
    '<p><a href="/api">GET /api</a> &rarr; JSON endpoint</p>' +
    '</body></html>'
  )
})

server.listen(PORT, function() {
  console.log('HTTP server running on http://localhost:' + PORT)
})
`)

  writeFileToVfs('/examples/README.md',
`# Examples

Each folder contains a runnable example. To try one:

  cd /examples/express
  npm install
  node index.js

Then click the Preview tab to see it live.

## Available examples

- express/     - Express.js HTTP server
- fastify/     - Fastify HTTP server
- react/       - React app via CDN (served by Express)
- vue/         - Vue 3 app via CDN (served by Express)
- node-http/   - Plain Node.js http module (no dependencies)
`)
}

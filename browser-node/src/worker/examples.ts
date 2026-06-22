import { writeFileToVfs, mkdirpSync } from './vfs'

export function initExamples() {
  mkdirpSync('/examples')

  // ── Express ──────────────────────────────────────────────────────────────────
  mkdirpSync('/examples/express')
  writeFileToVfs('/examples/express/package.json', JSON.stringify({
    name: 'express-example',
    version: '1.0.0',
    main: 'index.js',
    dependencies: { express: '^4.18.0' }
  }, null, 2))
  writeFileToVfs('/examples/express/index.js',
`'use strict'
const express = require('express')

const app = express()
const PORT = 3000

app.get('/', function(req, res) {
  res.send(\`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Express</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto;
           background: #0f1117; color: #e6edf3; }
    h1   { color: #58a6ff; }
    p    { color: #8b949e; line-height: 1.6; }
    a    { color: #58a6ff; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Express.js</h1>
  <p>This server runs entirely in your browser via a Web Worker.</p>
  <p>Try <a href="/api/hello"><code>GET /api/hello</code></a> for a JSON endpoint.</p>
</body>
</html>\`)
})

app.get('/api/hello', function(req, res) {
  res.json({ message: 'Hello from Express!', framework: 'express' })
})

app.listen(PORT, function() {
  console.log('Express server on http://localhost:' + PORT)
})
`)

  // ── Fastify ───────────────────────────────────────────────────────────────────
  mkdirpSync('/examples/fastify')
  writeFileToVfs('/examples/fastify/package.json', JSON.stringify({
    name: 'fastify-example',
    version: '1.0.0',
    main: 'index.js',
    dependencies: { fastify: '^4.0.0' }
  }, null, 2))
  writeFileToVfs('/examples/fastify/index.js',
`'use strict'
const fastify = require('fastify')({ logger: false })
const PORT = 3000

fastify.get('/', async function(req, reply) {
  reply.type('text/html')
  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fastify</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto;
           background: #0f1117; color: #e6edf3; }
    h1   { color: #e879f9; }
    p    { color: #8b949e; line-height: 1.6; }
    a    { color: #e879f9; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Fastify</h1>
  <p>This server runs entirely in your browser via a Web Worker.</p>
  <p>Try <a href="/api/hello"><code>GET /api/hello</code></a> for a JSON endpoint.</p>
</body>
</html>\`
})

fastify.get('/api/hello', async function() {
  return { message: 'Hello from Fastify!', framework: 'fastify' }
})

fastify.listen({ port: PORT }, function(err) {
  if (err) { console.error(err.message); return }
  console.log('Fastify server on http://localhost:' + PORT)
})
`)

  // ── React ─────────────────────────────────────────────────────────────────────
  // Serves React UMD build from local node_modules — no CDN, no bundler.
  // Run: npm install && node server.js
  mkdirpSync('/examples/react')
  writeFileToVfs('/examples/react/package.json', JSON.stringify({
    name: 'react-example',
    version: '1.0.0',
    main: 'server.js',
    dependencies: {
      express: '^4.18.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    }
  }, null, 2))
  writeFileToVfs('/examples/react/server.js',
`'use strict'
const path    = require('path')
const fs      = require('fs')
const express = require('express')

const app  = express()
const PORT = 3000

// Serve React UMD builds from local node_modules (installed via npm install).
// No CDN — everything lives in the in-browser virtual filesystem.
const nm = path.resolve(__dirname, 'node_modules')

app.get('/react.js', function(req, res) {
  res.setHeader('Content-Type', 'application/javascript')
  res.end(fs.readFileSync(path.join(nm, 'react/umd/react.development.js'), 'utf8'))
})

app.get('/react-dom.js', function(req, res) {
  res.setHeader('Content-Type', 'application/javascript')
  res.end(fs.readFileSync(path.join(nm, 'react-dom/umd/react-dom.development.js'), 'utf8'))
})

app.get('/', function(req, res) {
  res.setHeader('Content-Type', 'text/html')
  res.end(\`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>React App</title>
  <script src="/react.js"></script>
  <script src="/react-dom.js"></script>
  <style>
    body   { font-family: sans-serif; padding: 2rem; background: #0f1117; color: #e6edf3; }
    h1     { color: #61dafb; }
    p      { color: #8b949e; }
    .count { font-size: 3rem; margin: 1rem 0; }
    button { padding: 8px 20px; background: rgba(97,218,251,0.15);
             border: 1px solid rgba(97,218,251,0.3); color: #61dafb;
             border-radius: 6px; cursor: pointer; font-size: 14px; }
    button:hover { background: rgba(97,218,251,0.25); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // React without JSX — uses React.createElement directly
    var h = React.createElement
    function Counter() {
      var state  = React.useState(0)
      var count  = state[0]
      var setCount = state[1]
      return h('div', null,
        h('h1', null, 'React Counter'),
        h('p',  null, 'Loaded from npm — no CDN, no bundler'),
        h('div', { className: 'count' }, count),
        h('button', { onClick: function() { setCount(function(c) { return c + 1 }) } }, 'Increment')
      )
    }
    ReactDOM.createRoot(document.getElementById('root')).render(h(Counter))
  </script>
</body>
</html>\`)
})

app.listen(PORT, function() {
  console.log('React app on http://localhost:' + PORT)
})
`)

  // ── Vue ───────────────────────────────────────────────────────────────────────
  // Serves Vue global build from local node_modules — no CDN, no bundler.
  // Run: npm install && node server.js
  mkdirpSync('/examples/vue')
  writeFileToVfs('/examples/vue/package.json', JSON.stringify({
    name: 'vue-example',
    version: '1.0.0',
    main: 'server.js',
    dependencies: {
      express: '^4.18.0',
      vue: '^3.0.0'
    }
  }, null, 2))
  writeFileToVfs('/examples/vue/server.js',
`'use strict'
const path    = require('path')
const fs      = require('fs')
const express = require('express')

const app  = express()
const PORT = 3000

// Serve Vue global UMD build from local node_modules (installed via npm install).
// No CDN — everything lives in the in-browser virtual filesystem.
const nm = path.resolve(__dirname, 'node_modules')

app.get('/vue.js', function(req, res) {
  res.setHeader('Content-Type', 'application/javascript')
  res.end(fs.readFileSync(path.join(nm, 'vue/dist/vue.global.js'), 'utf8'))
})

app.get('/', function(req, res) {
  res.setHeader('Content-Type', 'text/html')
  res.end(\`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Vue App</title>
  <script src="/vue.js"></script>
  <style>
    body   { font-family: sans-serif; padding: 2rem; background: #0f1117; color: #e6edf3; }
    h1     { color: #42d392; }
    p      { color: #8b949e; }
    .count { font-size: 3rem; margin: 1rem 0; }
    button { padding: 8px 20px; background: rgba(66,211,146,0.15);
             border: 1px solid rgba(66,211,146,0.3); color: #42d392;
             border-radius: 6px; cursor: pointer; font-size: 14px; }
    button:hover { background: rgba(66,211,146,0.25); }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    Vue.createApp({
      data: function() { return { count: 0 } },
      template: \\\`
        <div>
          <h1>Vue Counter</h1>
          <p>Loaded from npm — no CDN, no bundler</p>
          <div class="count">{{ count }}</div>
          <button @click="count++">Increment</button>
        </div>
      \\\`
    }).mount('#app')
  </script>
</body>
</html>\`)
})

app.listen(PORT, function() {
  console.log('Vue app on http://localhost:' + PORT)
})
`)

  // ── Plain Node.js HTTP ────────────────────────────────────────────────────────
  mkdirpSync('/examples/node-http')
  writeFileToVfs('/examples/node-http/package.json', JSON.stringify({
    name: 'node-http-example',
    version: '1.0.0',
    main: 'index.js',
    dependencies: {}
  }, null, 2))
  writeFileToVfs('/examples/node-http/index.js',
`'use strict'
const http = require('http')

const PORT = 3000

const server = http.createServer(function(req, res) {
  if (req.url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Hello from Node.js http!', url: req.url }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(\`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Node.js HTTP</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto;
           background: #0f1117; color: #e6edf3; }
    h1   { color: #f59e0b; }
    p    { color: #8b949e; line-height: 1.6; }
    a    { color: #f59e0b; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Node.js HTTP</h1>
  <p>Using the built-in <code>http</code> module — no dependencies needed.</p>
  <p>Try <a href="/api"><code>GET /api</code></a> for a JSON endpoint.</p>
</body>
</html>\`)
})

server.listen(PORT, function() {
  console.log('HTTP server on http://localhost:' + PORT)
})
`)

  writeFileToVfs('/examples/README.md',
`# Examples

Each folder is a self-contained project. To run one:

\`\`\`
cd /examples/express && npm install && node index.js
\`\`\`

Then open the Preview tab to see it live.

## Available examples

| Folder     | Entry point    | Dependencies               |
|------------|----------------|----------------------------|
| express/   | node index.js  | express                    |
| fastify/   | node index.js  | fastify                    |
| react/     | node server.js | express, react, react-dom  |
| vue/       | node server.js | express, vue               |
| node-http/ | node index.js  | none (built-in only)       |

React and Vue examples serve the framework UMD build from local node_modules.
No CDN — everything runs inside the browser virtual filesystem.
`)
}

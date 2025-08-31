importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js");

let pyodide; // <-- global pyodide instance
let app;
let requestStatus, headers;

// Load Pyodide once
const pyodideReadyPromise = (async () => {
  pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install("flask");
  await micropip.install("sqlite3");
  return pyodide;
})();

// Initialize Flask app dynamically
let flaskReadyPromise;
async function startFlaskApp() {
  await pyodideReadyPromise;

  const res = await fetch("app.py");
  const appSrc = await res.text();
  pyodide.runPython(appSrc);

  app = pyodide.globals.get("app").toJs();

  // notify clients
  self.clients
    .matchAll()
    .then((clients) =>
      clients.forEach((c) => c.postMessage({ command: "appReady" }))
    );
}
flaskReadyPromise = startFlaskApp();

function start_response(status, responseHeaders, exc_info) {
  requestStatus = status;
  headers = {};
  responseHeaders.toJs().forEach(([key, value]) => (headers[key] = value));
}

async function handleRequest(path) {
  // Wait until Flask is ready
  await flaskReadyPromise;

  const environ = {
    "wsgi.url_scheme": "http",
    REQUEST_METHOD: "GET",
    PATH_INFO: path,
  };

  const result = app(pyodide.toPy(environ), start_response).toJs();
  let response = result.__next__();

  if (response.constructor.name === "PyProxy") {
    response = new Uint8Array(response.toJs());
    return new Response(response, { status: parseInt(requestStatus), headers });
  } else {
    const body = new TextEncoder().encode(response.toString());
    return new Response(body, { status: parseInt(requestStatus), headers });
  }
}

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated!");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api")) {
    event.respondWith(handleRequest(url.pathname));
  }
});

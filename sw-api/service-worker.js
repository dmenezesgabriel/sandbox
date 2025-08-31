// service-worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js");

let pyodide;
let app, requestStatus, headers;

async function startPyodide() {
  pyodide = await loadPyodide();

  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install("flask");

  // Minimal Flask app with multiple /api routes
  pyodide.runPython(`
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/hello")
def hello_world():
    return "<p>Hello, World from /api/hello!</p>"

@app.route("/api/data")
def data():
    return jsonify({"message": "This is JSON from /api/data"})
`);

  app = pyodide.globals.get("app").toJs();

  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ command: "appReady" });
    });
  });
}

startPyodide();

function start_response(status, responseHeaders, exc_info) {
  requestStatus = status;
  headers = {};
  responseHeaders.toJs().forEach(([key, value]) => (headers[key] = value));
}

function handleRequest(path) {
  const environ = {
    "wsgi.url_scheme": "http",
    REQUEST_METHOD: "GET",
    PATH_INFO: path,
  };

  const result = app(pyodide.toPy(environ), start_response).toJs();
  let response = result.__next__(); // WSGI iterable

  // Check if response is bytes (Pyodide returns Python bytes)
  if (response.constructor.name === "PyProxy") {
    // Convert to Uint8Array
    response = new Uint8Array(response.toJs());
    return new Response(response, { status: parseInt(requestStatus), headers });
  } else {
    // Otherwise convert to string (HTML)
    response = response.toString();
    const body = new TextEncoder().encode(response);
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
    const flaskPath = url.pathname; // pass full /api path
    event.respondWith(handleRequest(flaskPath));
  }
});

self.addEventListener("install", (event) => {
  console.log("SW installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("SW activated");
});

// Simple in-memory mock DB
const users = {
  123: { id: 123, name: "Bob" },
};

class Expresso {
  constructor() {
    this.routes = [];
    self.addEventListener("fetch", (event) => this.handleFetch(event));
  }

  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
  }

  async handleFetch(event) {
    const url = new URL(event.request.url);
    const method = event.request.method;
    const path = url.pathname;

    for (const route of this.routes) {
      if (route.method === method && route.path === path) {
        event.respondWith(route.handler(event.request));
        return;
      }
    }
  }
}

// Example usage of Expresso
const app = new Expresso();

app.get("/api/hello", async (req) => {
  return new Response(JSON.stringify({ message: "Hello, world!" }), {
    headers: { "Content-Type": "application/json" },
  });
});

app.post("/api/echo", async (req) => {
  const body = await req.json();
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
});

app.get("/api/users/:id", async (req) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();
  const user = users[id];
  if (!user) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(user), {
    headers: { "Content-Type": "application/json" },
  });
});

app.post("/api/users", async (req) => {
  const body = await req.json();
  const id = Date.now();
  users[id] = { id, ...body };
  return new Response(JSON.stringify(users[id]), {
    headers: { "Content-Type": "application/json" },
  });
});

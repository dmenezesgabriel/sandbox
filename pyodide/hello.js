import { ProxyAgent, setGlobalDispatcher } from "undici";
import "dotenv/config";

const username = process.env.USERNAME;
const password = process.env.PASSWORD;

const token = `Basic ${btoa(`${username}:${password}`)}`;

if (process.env.PROXY) {
  const proxyAgent = new ProxyAgent({
    uri: process.env.PROXY,
    token,
    rejectUnauthorized: false,
  });

  setGlobalDispatcher(proxyAgent);
}

async function hello_python() {
  const { loadPyodide } = await import("pyodide");

  let pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");

  return pyodide.runPythonAsync("1+1");
}

hello_python().then((result) => {
  console.log("Python says that 1+1 =", result);
});

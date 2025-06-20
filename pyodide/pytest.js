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

async function run_pytest() {
  const { loadPyodide } = await import("pyodide");
  let pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");

  const micropip = pyodide.pyimport("micropip");

  // Install pytest
  await micropip.install("pytest");

  // Define the add function and test file
  const pythonCode = `
def add(a, b):
  return a + b

# Create a test file dynamically
with open("test_add.py", "w") as f:
  f.write("""
import pytest
from main import add

def test_add():
  assert add(2, 3) == 5
  assert add(-1, 1) == 0
  assert add(0, 0) == 0
""")

# Save the add function in a main.py file
with open("main.py", "w") as f:
  f.write("""
def add(a, b):
  return a + b
""")

# Run pytest
import pytest
pytest.main(["-v"])
`;

  // Run the Python code
  return await pyodide.runPythonAsync(pythonCode);
}

run_pytest().then((result) => {
  console.log("pytest completed.", result);
});

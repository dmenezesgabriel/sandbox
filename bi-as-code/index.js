// ./index.js (UPDATED - imports new component modules)
import vegaEmbed from "vega-embed";
import * as duckdb from "@duckdb/duckdb-wasm";
import { marked } from "marked";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import Handlebars from "handlebars";

// import the component modules (they register themselves)
import "./components/dropdown-component.js";
import "./components/vegalite-chart.js";
import "./components/data-table-component.js";
import "./components/data-card.js";

marked.use({
  gfm: true,
  breaks: true,
});

// Global data store with nested structure
const dataStore = {
  data: {},
  input: {},
};

// (Keep the SQL rendering helpers and other helpers unchanged)
function parseSQLBlock(code, infoString) {
  const nameMatch = infoString && infoString.match(/name=['"]([^'"]+)['"]/);
  return {
    code,
    name: nameMatch ? nameMatch[1] : null,
  };
}

function renderSQLResult(data, queryName, error = null) {
  if (error) {
    return `<div class="sql-error"><strong>SQL Error:</strong> ${error}</div>`;
  }

  if (!data || data.length === 0) {
    return `<details class="sql-result">
      <summary>Query Result${
        queryName ? `: ${queryName}` : ""
      } (0 rows)</summary>
      <div class="sql-result-content"><p style="color: #999;">No results returned</p></div>
    </details>`;
  }

  const columns = Object.keys(data[0]);
  const tableHTML = `
    <table>
      <thead>
        <tr>${columns.map((col) => `<th>${col}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${data
          .map(
            (row) => `
          <tr>${columns
            .map(
              (col) =>
                `<td>${row[col] !== null ? row[col] : "<em>null</em>"}</td>`
            )
            .join("")}</tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  return `<details class="sql-result">
    <summary>Query Result${queryName ? `: ${queryName}` : ""} (${
    data.length
  } rows)</summary>
    <div class="sql-result-content">${tableHTML}</div>
  </details>`;
}

// Handlebars helper for nested property access
Handlebars.registerHelper("get", function (obj, path) {
  const keys = path.split(".");
  let result = obj;
  for (const key of keys) {
    result = result[key];
    if (result === undefined) return "";
  }
  return result;
});

// DuckDB init and query functions (kept as you had them)
let db = null;
let conn = null;

async function initDuckDB() {
  try {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    conn = await db.connect();
    console.log("DuckDB initialized successfully");
  } catch (error) {
    console.error("DuckDB initialization error:", error);
    throw error;
  }
}

async function executeSQL(sql) {
  if (!conn) {
    throw new Error("DuckDB not initialized");
  }
  const result = await conn.query(sql);
  return result.toArray().map((row) => row.toJSON());
}

async function processMarkdown(markdown) {
  // Step 1: Compile markdown with Handlebars first
  const template = Handlebars.compile(markdown, { noEscape: true });
  const interpolatedMarkdown = template(dataStore);

  const sqlBlocks = [];
  let blockIndex = 0;

  // Step 2: Extract SQL blocks and replace with placeholders
  let processedMarkdown = interpolatedMarkdown.replace(
    /```sql([^\n]*)\n([\s\S]*?)```|```sql([^`]+)```/g,
    (match, infoString, code, singleLine) => {
      let parsed;
      if (singleLine) {
        parsed = parseSQLBlock(singleLine.trim(), infoString || "");
      } else {
        parsed = parseSQLBlock(code.trim(), infoString || "");
      }

      const placeholder = `<!--SQL_BLOCK_${blockIndex}-->`;
      sqlBlocks.push({ ...parsed, placeholder });
      blockIndex++;
      return placeholder;
    }
  );

  // Step 3: Convert markdown to HTML
  let html = marked.parse(processedMarkdown);

  // Step 4: Process SQL blocks sequentially
  const replacements = {};

  for (const block of sqlBlocks) {
    let resultHTML;
    try {
      const data = await executeSQL(block.code);

      if (block.name) {
        dataStore.data[block.name] = data;
      }

      resultHTML =
        `<pre><code class="language-sql">${block.code}</code></pre>` +
        renderSQLResult(data, block.name);
    } catch (error) {
      resultHTML =
        `<pre><code class="language-sql">${block.code}</code></pre>` +
        renderSQLResult(null, block.name, error.message);
    }

    replacements[block.placeholder] = resultHTML;
  }

  // Step 5: Replace placeholders in HTML
  for (const block of sqlBlocks) {
    html = html.split(block.placeholder).join(replacements[block.placeholder]);
  }

  return html;
}

function bindComponentData() {
  const preview = document.getElementById("preview");

  // Bind dropdown components
  const dropdowns = preview.querySelectorAll("dropdown-component");
  dropdowns.forEach((dropdown) => {
    const dataRef = dropdown.getAttribute("data-ref");
    const name = dropdown.getAttribute("name");

    if (dataRef && dataStore.data[dataRef]) {
      dropdown.data = dataStore.data[dataRef];
      dropdown.name = name;
    }
  });

  // Bind table components
  const tables = preview.querySelectorAll("data-table-component");
  tables.forEach((table) => {
    const dataRef = table.getAttribute("data-ref");
    if (dataRef && dataStore.data[dataRef]) {
      table.data = dataStore.data[dataRef];
    }
  });

  // Bind card components
  const cards = preview.querySelectorAll("data-card");
  cards.forEach((card) => {
    const dataRef = card.getAttribute("data-ref");
    if (dataRef && dataStore.data[dataRef]) {
      card.data = dataStore.data[dataRef];
    }
  });

  // Bind chart components
  const charts = preview.querySelectorAll("vegalite-chart");
  charts.forEach((chart) => {
    const dataRef = chart.getAttribute("data-ref");
    const specAttr = chart.getAttribute("spec");

    if (specAttr) {
      try {
        chart.spec = JSON.parse(specAttr);
      } catch (e) {
        console.error("Invalid chart spec:", e);
      }
    }

    if (dataRef && dataStore.data[dataRef]) {
      chart.data = dataStore.data[dataRef];
    }
  });
}

// Editor + preview wiring (unchanged aside from being in this file)
let editor;
let debounceTimer;

async function updatePreview() {
  const markdown = editor.state.doc.toString();
  const preview = document.getElementById("preview");

  try {
    const html = await processMarkdown(markdown);
    preview.innerHTML = html;

    // Bind data to components after DOM insertion
    setTimeout(bindComponentData, 100);
  } catch (error) {
    console.error("Error processing markdown:", error);
    preview.innerHTML = `<div class="sql-error">Error: ${error.message}</div>`;
  }
}

// Listen for value changes from components
// NOTE: component modules now dispatch arrays for dropdowns.
// This listener converts arrays into the string format your templates expect: "['A','B']"
document.addEventListener("valuechange", (e) => {
  const detail = e.detail || {};
  const name = detail.name;
  const val = detail.value;

  if (!name) return;

  if (Array.isArray(val)) {
    if (val.length === 0) {
      dataStore.input[name] = "[]";
    } else {
      const formattedValues = val.map(
        (v) => `'${String(v).replace(/'/g, "''")}'`
      );
      dataStore.input[name] = `[${formattedValues.join(",")}]`;
    }
  } else if (typeof val === "string") {
    // Accept older format or other components that send a preformatted string
    dataStore.input[name] = val;
  } else {
    // Fallback: stringify
    dataStore.input[name] = JSON.stringify(val);
  }

  // re-render preview after input change
  updatePreview();
});

function initCodeMirror() {
  const editorElement = document.getElementById("editor");
  const initialState = editorElement.value;
  const parentContainer = editorElement.parentElement;

  editorElement.remove();

  const changeListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 300);
    }
  });

  const startState = EditorState.create({
    doc: initialState,
    extensions: [
      keymap.of(defaultKeymap),
      markdown(),
      oneDark,
      EditorView.lineWrapping,
      changeListener,
    ],
  });

  editor = new EditorView({
    state: startState,
    parent: parentContainer,
  });
}

// Initialize default input values
dataStore.input.productSelection = "[]";

initDuckDB()
  .then(() => {
    initCodeMirror();
    updatePreview();
  })
  .catch((error) => {
    console.error("Failed to initialize DuckDB:", error);
    document.getElementById(
      "preview"
    ).innerHTML = `<div class="sql-error">Failed to initialize DuckDB: ${error.message}<br><br>This may be due to browser security restrictions. Try opening this page in a local server or different browser.</div>`;
  });

import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import { marked } from "marked";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import Handlebars from "handlebars";

import "./components/dropdown-component.js";
import "./components/vegalite-chart.js";
import "./components/data-table-component.js";
import "./components/data-card.js";

marked.use({
  gfm: true,
  breaks: true,
});

Handlebars.registerHelper("get", function (obj, path) {
  const keys = path.split(".");
  let result = obj;
  for (const key of keys) {
    result = result[key];
    if (result === undefined) return "";
  }
  return result;
});

const dataStore = {
  data: {},
  input: {},
};

function parseSQLBlock(code, infoString) {
  const nameMatch = infoString && infoString.match(/name=['"]([^'"]+)['"]/);
  const hide = infoString && /\bhide\b/.test(infoString); // detect 'hide' keyword

  return {
    code,
    name: nameMatch ? nameMatch[1] : null,
    hide: hide || false,
  };
}

let conn = null;

async function initDuckDB() {
  try {
    const MANUAL_BUNDLES = {
      mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
      },
      eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
      },
    };

    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

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

  let html = marked.parse(processedMarkdown);

  const replacements = {};

  for (const block of sqlBlocks) {
    try {
      const data = await executeSQL(block.code);

      if (block.name) {
        dataStore.data[block.name] = data;
      }

      // If hide is true, render nothing
      replacements[block.placeholder] = block.hide
        ? ""
        : `<pre><code class="language-sql">${block.code}</code></pre>` +
          `<details class="sql-result">` +
          `<summary>Query Result${block.name} ${data.length} </summary>` +
          `<div class="sql-result-content">` +
          `<data-table-component data-ref='${block.name}'></data-table-component>` +
          `</div>` +
          `</details>`;
    } catch (error) {
      replacements[block.placeholder] = block.hide
        ? ""
        : `<pre><code class="language-sql">${block.code}</code></pre>` +
          `<details class="sql-result">` +
          `<summary>Query Result${block.name} ${data.length} </summary>` +
          `<div class="sql-result-content">` +
          `<data-table-component data-ref='${block.name}'></data-table-component>` +
          `</div>` +
          `</details>`;
    }
  }

  // Step 5: Replace placeholders in HTML
  for (const block of sqlBlocks) {
    html = html.split(block.placeholder).join(replacements[block.placeholder]);
  }

  return html;
}

function bindComponentData() {
  const preview = document.getElementById("preview");

  const dropdowns = preview.querySelectorAll("dropdown-component");
  dropdowns.forEach((dropdown) => {
    const dataRef = dropdown.getAttribute("data-ref");
    const name = dropdown.getAttribute("name");

    if (dataRef && dataStore.data[dataRef]) {
      dropdown.data = dataStore.data[dataRef];
      dropdown.name = name;
    }
  });

  const tables = preview.querySelectorAll("data-table-component");
  tables.forEach((table) => {
    const dataRef = table.getAttribute("data-ref");
    if (dataRef && dataStore.data[dataRef]) {
      table.data = dataStore.data[dataRef];
    }
  });

  const cards = preview.querySelectorAll("data-card");
  cards.forEach((card) => {
    const dataRef = card.getAttribute("data-ref");
    if (dataRef && dataStore.data[dataRef]) {
      card.data = dataStore.data[dataRef];
    }
  });

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

let editor;
let debounceTimer;

async function updatePreview() {
  const markdown = editor.state.doc.toString();
  const preview = document.getElementById("preview");

  try {
    const html = await processMarkdown(markdown);
    preview.innerHTML = html;

    setTimeout(bindComponentData, 10);
  } catch (error) {
    console.error("Error processing markdown:", error);
    preview.innerHTML = `<div class="sql-error">Error: ${error.message}</div>`;
  }
}

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
    dataStore.input[name] = val;
  } else {
    dataStore.input[name] = JSON.stringify(val);
  }
  updatePreview();
});

async function initCodeMirror() {
  const editorContainer = document.querySelector(".editor-container");
  let initialMarkdown = "# Loading markdown...";
  try {
    const res = await fetch("src/content.md");
    initialMarkdown = await res.text();
  } catch (e) {
    console.error("Failed to load markdown file:", e);
    initialMarkdown = "# Failed to load markdown file";
  }

  const changeListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 300);
    }
  });

  const startState = EditorState.create({
    doc: initialMarkdown,
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
    parent: editorContainer,
  });

  await updatePreview();
}

dataStore.input.productSelection = "[]";

initDuckDB()
  .then(() => {
    initCodeMirror();
  })
  .catch((error) => {
    console.error("Failed to initialize DuckDB:", error);
    document.getElementById("preview").innerHTML = `
    <div class="sql-error">
      Failed to initialize DuckDB: ${error.message}
      <br>
      <br>
      This may be due to browser security restrictions.
      Try opening this page in a local server or different browser.
     </div>`;
  });

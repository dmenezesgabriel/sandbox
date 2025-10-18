import vegaEmbed from "vega-embed";
import * as duckdb from "@duckdb/duckdb-wasm";
import { marked } from "marked";

class Dropdown extends HTMLElement {
  static get observedAttributes() {
    return ["data", "name"];
  }

  constructor() {
    super();
    this._data = null;
    this._name = "";
    this._selectedValues = [];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "data") {
      const queryName = newValue.replace(/[${}]/g, "");
      this._data = dataStore[queryName];
      this.render();
    }
    if (name === "name") {
      this._name = newValue;
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this._data) {
      this.innerHTML = '<p style="color: #999;">Loading products...</p>';
      return;
    }

    const style = `
          <style>
            .select-container {
              margin: 16px 0;
            }
            .multi-select {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              min-height: 100px;
            }
            .multi-select option {
              padding: 4px;
            }
          </style>
        `;

    const products = this._data.map((row) => row.product);

    const selectId = this._name || this.getAttribute("name") || "productSelect";
    const html = `
          ${style}
          <div class="select-container">
            <label for="${selectId}">Select Products:</label><br>
            <select id="${selectId}" name="${
      this._name
    }" class="multi-select" multiple>
              ${products
                .map(
                  (product) =>
                    `<option value="${product}" ${
                      this._selectedValues.includes(product) ? "selected" : ""
                    }>${product}</option>`
                )
                .join("")}
            </select>
          </div>
        `;

    this.innerHTML = html;

    this.querySelector(`#${selectId}`).addEventListener("change", (e) => {
      const select = e.target;
      this._selectedValues = Array.from(select.selectedOptions).map(
        (opt) => opt.value
      );
      const formattedValues = this._selectedValues.map((v) => {
        const safe = v.replace(/'/g, "''");
        return `'${safe}'`;
      });
      dataStore[this._name] = this._selectedValues.length
        ? `[${formattedValues.join(",")}]`
        : "[]";
      console.log("Selected products:", dataStore[this._name]); // Debug log
      updatePreview();
    });
  }
}
customElements.define("dropdown-component", Dropdown);

class VegaLiteChart extends HTMLElement {
  static get observedAttributes() {
    return ["spec", "data"];
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._spec = null;
    this._data = null;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "spec") {
      try {
        this._spec = JSON.parse(newValue);
      } catch {
        this._spec = null;
      }
    }
    if (name === "data") {
      try {
        this._data = JSON.parse(newValue);
      } catch {
        this._data = null;
      }
    }
    this.renderChart();
  }
  set spec(val) {
    this._spec = val;
    this.renderChart();
  }
  set data(val) {
    this._data = val;
    this.renderChart();
  }
  get spec() {
    return this._spec;
  }
  get data() {
    return this._data;
  }
  connectedCallback() {
    this.renderChart();
  }
  renderChart() {
    if (!this._spec) return;
    const spec = JSON.parse(JSON.stringify(this._spec));
    if (this._data) spec.data = { values: this._data };
    this.shadowRoot.innerHTML = `<div id="chart"></div>`;
    vegaEmbed(this.shadowRoot.querySelector("#chart"), spec);
  }
}
customElements.define("vegalite-chart", VegaLiteChart);

const dataStore = {
  productSelection: "[]",
};

// Initialize DuckDB
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

class SampleTable extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const dataAttr = this.getAttribute("data");
    if (!dataAttr) {
      this.innerHTML = '<p style="color: #999;">No data provided</p>';
      return;
    }

    const data = dataStore[dataAttr.replace(/[${}]/g, "")];
    if (!data || !Array.isArray(data) || data.length === 0) {
      this.innerHTML =
        '<p style="color: #999;">Data not available or empty</p>';
      return;
    }

    const columns = Object.keys(data[0]);
    const html = `
          <div style="border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  ${columns
                    .map(
                      (col) =>
                        `<th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600;">${col}</th>`
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${data
                  .map(
                    (row) => `
                  <tr style="border-bottom: 1px solid #eee;">
                    ${columns
                      .map(
                        (col) => `<td style="padding: 10px;">${row[col]}</td>`
                      )
                      .join("")}
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `;
    this.innerHTML = html;
  }
}

class DataCard extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const dataAttr = this.getAttribute("data");
    if (!dataAttr) {
      this.innerHTML = '<p style="color: #999;">No data provided</p>';
      return;
    }

    const data = dataStore[dataAttr.replace(/[${}]/g, "")];
    if (!data || !Array.isArray(data) || data.length === 0) {
      this.innerHTML = '<p style="color: #999;">Data not available</p>';
      return;
    }

    const record = data[0];
    const html = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0;">
            ${Object.entries(record)
              .map(
                ([key, value]) => `
              <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">${key.replace(
                  /_/g,
                  " "
                )}</div>
                <div style="color: white; font-size: 24px; font-weight: 700;">${
                  typeof value === "number" ? value.toLocaleString() : value
                }</div>
              </div>
            `
              )
              .join("")}
          </div>
        `;
    this.innerHTML = html;
  }
}

customElements.define("data-table-component", SampleTable);
customElements.define("data-card", DataCard);

function parseSQLBlock(code, infoString) {
  const nameMatch = infoString.match(/name=['"]([^'"]+)['"]/);
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
    return `<details class="sql-result" open>
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

  return `<details class="sql-result" open>
        <summary>Query Result${queryName ? `: ${queryName}` : ""} (${
    data.length
  } rows)</summary>
        <div class="sql-result-content">${tableHTML}</div>
      </details>`;
}

async function processMarkdown(markdown) {
  const sqlBlocks = [];
  let blockIndex = 0;

  let processedMarkdown = markdown.replace(
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

  for (const block of sqlBlocks) {
    let resultHTML;
    try {
      let codeToExecute = block.code.replace(/\$\{(\w+)\}/g, (m, varName) => {
        const val = dataStore[varName];
        if (val === undefined) return "NULL";
        if (typeof val === "string" && val.trim().startsWith("[")) return val;
        if (Array.isArray(val) || typeof val === "object")
          return JSON.stringify(val);
        if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
        return String(val);
      });

      console.log("Executing SQL for block", block.name, ":", codeToExecute);
      const data = await executeSQL(codeToExecute);

      if (block.name) {
        dataStore[block.name] = data;
      }

      resultHTML =
        `<pre><code class="language-sql">${block.code}</code></pre>` +
        renderSQLResult(data, block.name);
      console.log(`Data stored for ${block.name}:`, data); // Debugging
    } catch (error) {
      resultHTML =
        `<pre><code class="language-sql">${block.code}</code></pre>` +
        renderSQLResult(null, block.name, error.message);
    }

    html = html.replace(block.placeholder, resultHTML);
  }

  html = html.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return varName;
  });

  return html;
}

function renderWebComponents() {
  const preview = document.getElementById("preview");
  const components = preview.querySelectorAll(
    "data-table-component, data-card, vegalite-chart"
  );
  components.forEach((component) => {
    if (component.tagName === "VEGALITE-CHART") {
      const dataAttr = component.getAttribute("data");
      if (dataAttr && dataStore[dataAttr]) {
        component.data = dataStore[dataAttr];
      }
    }
  });
  components.forEach((component) => {
    if (component.render) {
      component.render();
    }
  });
}

async function updatePreview() {
  const markdown = editor.getValue();
  const preview = document.getElementById("preview");

  try {
    const html = await processMarkdown(markdown);
    preview.innerHTML = html;
    setTimeout(renderWebComponents, 100);
  } catch (error) {
    console.error("Error processing markdown:", error);
    preview.innerHTML = `<div class="sql-error">Error: ${error.message}</div>`;
  }
}

const editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
  mode: "markdown",
  theme: "monokai",
  lineNumbers: true,
  lineWrapping: true,
  autofocus: true,
});

initDuckDB()
  .then(() => {
    let debounceTimer;
    editor.on("change", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 300);
    });

    updatePreview();
  })
  .catch((error) => {
    console.error("Failed to initialize DuckDB:", error);
    document.getElementById(
      "preview"
    ).innerHTML = `<div class="sql-error">Failed to initialize DuckDB: ${error.message}<br><br>This may be due to browser security restrictions. Try opening this page in a local server or different browser.</div>`;
  });

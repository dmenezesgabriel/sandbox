import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { processMarkdown } from "./utils/markdown.js";
import { dataStore } from "./utils/store.js";
import { initDuckDB } from "./utils/duckdb.js";
import { bindComponentData } from "./utils/component.js";

import "./components/dropdown-component.js";
import "./components/vegalite-chart.js";
import "./components/data-table-component.js";
import "./components/data-card.js";

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

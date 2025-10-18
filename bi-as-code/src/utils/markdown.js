import { dataStore } from "./store";
import Handlebars from "handlebars";
import { marked } from "marked";

import { conn } from "./duckdb.js";

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

async function executeSQL(sql) {
  if (!conn) {
    throw new Error("DuckDB not initialized");
  }
  const result = await conn.query(sql);
  return result.toArray().map((row) => row.toJSON());
}

function parseSQLBlock(code, infoString) {
  const nameMatch = infoString && infoString.match(/name=['"]([^'"]+)['"]/);
  const hide = infoString && /\bhide\b/.test(infoString); // detect 'hide' keyword

  return {
    code,
    name: nameMatch ? nameMatch[1] : null,
    hide: hide || false,
  };
}

export async function processMarkdown(markdown) {
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

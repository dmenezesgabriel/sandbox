import { dataStore } from "./store.js";

export function bindComponentData() {
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

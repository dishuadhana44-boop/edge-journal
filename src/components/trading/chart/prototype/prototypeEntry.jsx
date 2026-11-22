// ==========================================================
// CHART PROTOTYPE — STANDALONE ENTRY
//
// Loaded only by /chart-prototype.html. The normal app entry
// (src/main.jsx) and the terminal layout are untouched.
// ==========================================================

import { createRoot } from "react-dom/client";

import ChartLinePrototype from "./ChartLinePrototype.jsx";

const container = document.getElementById("prototype-root");

if (!container) {
  throw new Error(
    "Chart prototype entry: #prototype-root element is missing."
  );
}

const root = createRoot(container);

root.render(<ChartLinePrototype />);

// Exposed so the mount/unmount cleanup check can be driven from
// the console. Prototype only — it disappears with this page.
window.__edgefloPrototypeRoot = {
  unmount() {
    root.unmount();
    delete window.__edgefloPrototypeRoot;
  },
};

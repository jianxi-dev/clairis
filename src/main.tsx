import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/editor.css";
import "./styles/theme-light.css";
import "./styles/theme-dark.css";

console.info("[JianXi] main.tsx loaded, mounting React...");

window.addEventListener("error", (e) => {
  console.error("[JianXi] Global error:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[JianXi] Unhandled promise rejection:", e.reason);
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[JianXi] #root element not found!");
} else {
  console.info("[JianXi] #root found, creating React root...");
}

ReactDOM.createRoot(rootEl as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

console.info("[JianXi] React render called.");

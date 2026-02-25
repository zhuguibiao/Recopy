import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";

// Non-macOS main panel needs solid background.
// macOS uses NSPanel with native glass effect; other platforms lack this.
const isMacOS = /Mac/.test(navigator.userAgent);
const isMainPanel = !window.location.search.includes("page=");
if (!isMacOS && isMainPanel) {
  document.documentElement.style.backgroundColor = "var(--color-background)";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

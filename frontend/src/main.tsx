import React from "react";
import ReactDOM from "react-dom/client";

// apply saved theme before first paint (no flash)
const saved = localStorage.getItem("cleardesk-theme");
if (saved === "dark" ||
    (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

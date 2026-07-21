// The theme store applies the correct `dark` class at import time — keep this
// FIRST so the class is set before any component reads it (prevents the
// intermittent split-theme flash).
import "./store/theme";

import React from "react";
import ReactDOM from "react-dom/client";
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

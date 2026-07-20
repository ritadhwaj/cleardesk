import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: forward the backend's API routes + WebSocket to uvicorn on :8000.
// Production is same-origin (the backend serves this build), so no proxy runs.
const api = "http://localhost:8000";
const ws = "ws://localhost:8000";
const routes = ["/auth", "/cases", "/documents", "/reviews", "/activity", "/health"];

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      ...Object.fromEntries(routes.map((r) => [r, { target: api, changeOrigin: true }])),
      "/ws": { target: ws, ws: true },
    },
  },
});

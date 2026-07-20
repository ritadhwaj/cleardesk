import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: forward everything under /api (REST + WebSocket) to uvicorn on
// :8000. Production is same-origin (the backend serves this build), so the
// proxy never runs. Client-side routes (/cases/new, /review, …) are NOT under
// /api, so they’re served by the SPA and never collide with the API.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          // A WebSocket / request closing mid-flight makes http-proxy log
          // ECONNABORTED / ECONNRESET / EPIPE. These are harmless — swallow
          // them so the dev console only shows real proxy failures.
          const benign = new Set(["ECONNABORTED", "ECONNRESET", "EPIPE"]);
          proxy.on("error", (err: NodeJS.ErrnoException) => {
            if (!benign.has(err?.code ?? "")) {
              // eslint-disable-next-line no-console
              console.warn("[vite-proxy]", err?.message ?? err);
            }
          });
        },
      },
    },
  },
});

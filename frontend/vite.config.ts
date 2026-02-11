import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  optimizeDeps: {
    exclude: ["argon2-browser"],
  },
  build: {
    rollupOptions: {
      // argon2-browser loads its WASM via fetch() at runtime in browsers.
      // The dist/argon2.js (Emscripten glue) is only used in the Node.js
      // code path and should not be bundled.
      external: [/argon2-browser\/dist/],
    },
  },
});

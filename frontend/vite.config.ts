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
      // argon2-browser's dist/ contains Node.js-only Emscripten glue (fs, path).
      // We load it at runtime via a <script> tag from public/ instead.
      external: [/argon2-browser\/dist/],
    },
  },
});

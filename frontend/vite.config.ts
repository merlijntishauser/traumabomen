import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

/** Replace __OG_*__ placeholders in index.html during dev only (nginx does this in prod). */
function devHtmlPlaceholders(): Plugin {
  return {
    name: "dev-html-placeholders",
    apply: "serve",
    transformIndexHtml(html) {
      return html
        .replace(/__OG_TITLE__/g, "Traumabomen (local dev)")
        .replace(/__OG_DESC__/g, "Local development")
        .replace(/__OG_ORIGIN__/g, "http://localhost:5173")
        .replace(/__OG_LANG__/g, "en")
        .replace(/__OG_LOCALE__/g, "en_US");
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devHtmlPlaceholders(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-reactflow": ["@xyflow/react", "dagre"],
          "vendor-d3": ["d3"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});

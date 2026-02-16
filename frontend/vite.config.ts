import { type Plugin, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Replace __OG_*__ placeholders in index.html during dev (nginx does this in prod). */
function devHtmlPlaceholders(): Plugin {
  return {
    name: "dev-html-placeholders",
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
  plugins: [react(), devHtmlPlaceholders()],
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

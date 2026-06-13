import { execSync } from "node:child_process";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

function gitInfo(): { tag: string; hash: string } {
  // In Docker production builds, git isn't available; use build args passed as env vars.
  if (process.env.APP_VERSION || process.env.APP_COMMIT) {
    return { tag: process.env.APP_VERSION ?? "", hash: process.env.APP_COMMIT ?? "" };
  }
  try {
    const tag = execSync("git describe --tags --abbrev=0 2>/dev/null || echo ''", {
      encoding: "utf-8",
    }).trim();
    const hash = execSync("git rev-parse --short HEAD 2>/dev/null", { encoding: "utf-8" }).trim();
    return { tag, hash };
  } catch {
    return { tag: "", hash: "unknown" };
  }
}

/** Replace __OG_*__ placeholders in index.html during dev only (nginx does this in prod). */
function devHtmlPlaceholders(): Plugin {
  return {
    name: "dev-html-placeholders",
    apply: "serve",
    transformIndexHtml: {
      // Run before Vite's own asset-URL rewriting, which would otherwise treat
      // the bare placeholders as relative hrefs and prefix them with "/".
      order: "pre",
      handler(html, ctx) {
        const path = (ctx.originalUrl ?? "/").split("?")[0];
        return html
          .replace(/__OG_TITLE__/g, "Traumabomen (local dev)")
          .replace(/__OG_DESC__/g, "Local development")
          .replace(/__OG_ORIGIN__/g, "http://localhost:5173")
          .replace(/__OG_CANONICAL__/g, `http://localhost:5173${path}`)
          .replace(/__OG_ALT_EN__/g, `http://localhost:5173${path}`)
          .replace(/__OG_ALT_NL__/g, `http://localhost:5173${path}`)
          .replace(/__OG_LANG__/g, "en")
          .replace(/__OG_LOCALE__/g, "en_US");
      },
    },
  };
}

const git = gitInfo();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(git.tag),
    __APP_COMMIT__: JSON.stringify(git.hash),
  },
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
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React-family shim shared by react-i18next (eager) and zustand (only
          // reachable via the lazy workspace's React Flow canvas). Pin it to the
          // eager React chunk: otherwise rolldown parks it inside vendor-reactflow,
          // and the eager i18n import drags the whole 205KB canvas graph (and its
          // d3 deps) onto every public page. Must precede the @xyflow rule.
          if (/[\\/]use-sync-external-store[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]@xyflow[\\/]/.test(id) || /[\\/]dagre[\\/]/.test(id))
            return "vendor-reactflow";
          if (/[\\/]@tanstack[\\/]/.test(id)) return "vendor-query";
          if (/[\\/]d3(-[^\\/]*)?[\\/]/.test(id)) return "vendor-d3";
          if (/[\\/](react-dom|react-router-dom|react)[\\/]/.test(id))
            return "vendor-react";
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});

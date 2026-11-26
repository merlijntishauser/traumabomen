import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

// The guest page (view.html, served at /view) is a build of its own: no Sentry
// plugin, no source maps, and every file under /view-assets/, so each request
// the page makes is /view, /view-assets/* or /api/guest/open. nginx and the
// Cloud Logging exclusion rely on exactly those paths.

const BASE = "/view-assets/";
const ARGON2_SOURCE = fileURLToPath(new URL("./public/argon2-bundled.min.js", import.meta.url));
const ARGON2_TAG = 'src="/argon2-bundled.min.js"';

/**
 * view.html loads argon2 like index.html does, from /argon2-bundled.min.js
 * (which the dev server serves from public/). The guest build copies nothing
 * from public/, so this emits the one file it needs under /view-assets/ with a
 * content hash, which keeps the immutable caching on /view-assets/ safe, and
 * points the script tag at it.
 */
function guestArgon2Script(): Plugin {
  const source = readFileSync(ARGON2_SOURCE);
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 8);
  const fileName = `assets/argon2-bundled-${hash}.min.js`;
  return {
    name: "guest-argon2-script",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName, source });
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!html.includes(ARGON2_TAG)) {
          throw new Error(`view.html must load argon2 with ${ARGON2_TAG}`);
        }
        return html.replace(ARGON2_TAG, `src="${BASE}${fileName}"`);
      },
    },
  };
}

export default defineConfig({
  base: BASE,
  publicDir: false,
  plugins: [react(), guestArgon2Script()],
  build: {
    outDir: "dist/view-assets",
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      input: fileURLToPath(new URL("./view.html", import.meta.url)),
    },
  },
});

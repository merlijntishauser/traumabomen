#!/usr/bin/env node
// Fails when the guest page bundle (dist/view-assets, built by
// vite.guest.config.ts) contains anything that would reach a third party, write
// browser storage, or pull in the signed-in API client. If a dependency trips
// one of these, keep that dependency off the guest page instead of loosening
// the list. localStorage itself is allowed: the guest page may read the theme
// with localStorage.getItem, and "setItem" catches any write.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FORBIDDEN = [
  { label: "setItem", pattern: /setItem/ },
  { label: "sessionStorage", pattern: /sessionStorage/ },
  { label: "indexedDB", pattern: /indexedDB/ },
  { label: "document.cookie", pattern: /document\.cookie/ },
  { label: "sentry", pattern: /sentry/i },
  { label: "fonts.googleapis", pattern: /fonts\.googleapis/ },
  { label: "fonts.gstatic", pattern: /fonts\.gstatic/ },
  { label: "/auth/refresh", pattern: /\/auth\/refresh/ },
];

const root = process.argv[2] ?? join(import.meta.dirname, "..", "dist", "view-assets");

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

let files;
try {
  files = filesUnder(root);
} catch (error) {
  console.error(`check-guest-bundle: cannot read ${root}: ${error.message}`);
  process.exit(1);
}
if (files.length === 0 || !files.some((path) => path.endsWith("view.html"))) {
  console.error(`check-guest-bundle: no guest build in ${root} (expected view.html)`);
  process.exit(1);
}

const findings = [];
for (const path of files) {
  const content = readFileSync(path, "latin1");
  for (const { label, pattern } of FORBIDDEN) {
    if (pattern.test(content)) findings.push(`${relative(root, path)}: contains "${label}"`);
  }
}

if (findings.length > 0) {
  console.error("check-guest-bundle: the guest bundle contains forbidden strings:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`check-guest-bundle: ${files.length} files clean`);

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    exclude: ["node_modules", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.css",
        "**/*.test.*",
        "**/*.d.ts",
        "e2e/**",
        "src/test/**",
        "src/types/**",
        "src/i18n.ts",
        "src/main.tsx",
        "src/App.tsx",
        "src/vite-env.d.ts",
        "src/pages/**",
        "src/contexts/**",
      ],
    },
  },
});

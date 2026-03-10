import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(""),
    __APP_COMMIT__: JSON.stringify("test"),
  },
  plugins: [react()],
  test: {
    globals: true,
    exclude: ["node_modules", "e2e"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.unit.test.ts"],
          setupFiles: [],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.unit.test.ts", "node_modules", "e2e"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
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

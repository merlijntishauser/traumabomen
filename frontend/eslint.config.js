import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "e2e/", "*.config.*"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Complexity gates
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",

      // Disable rules that overlap with Biome or TypeScript
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // Disable rules that are noisy in React/JSX/D3 patterns
      "sonarjs/no-unknown-property": "off",
      "sonarjs/no-misused-promises": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/no-nested-functions": "off",
      "sonarjs/pseudo-random": "off",
      "sonarjs/fixme-tag": "off",
      "sonarjs/todo-tag": "off",
      "sonarjs/no-commented-out-code": "off",
      "sonarjs/sonar-no-unused-vars": "off",
      "sonarjs/no-unused-collection": "off",
    },
  },
  {
    files: ["src/**/*.test.*"],
    rules: {
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
    },
  },
  // Existing complex files -- reduce over time
  {
    files: [
      "src/components/timeline/TimelineView.tsx",
      "src/components/tree/RelationshipEdge.tsx",
      "src/hooks/useTreeLayout.ts",
      "src/lib/inferSiblings.ts",
    ],
    rules: {
      "sonarjs/cognitive-complexity": "off",
    },
  },
);

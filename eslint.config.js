// @ts-check
// ESLint flat config (v10+)
// Type checking is handled by `tsc --noEmit` in CI.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "target", "e2e", "src-tauri"] },

  // Base JS/TS rules
  ...tseslint.configs.recommended,

  // TS/TSX files
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React hooks — known issues downgraded to warn
      ...Object.fromEntries(
        Object.entries(reactHooks.configs.recommended.rules).map(
          ([k, v]) => [k, v === "error" ? "warn" : v],
        ),
      ),
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Warn on console.* (allow explicit calls via log.ts)
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
      "no-debugger": "error",

      // Cleanliness
      "prefer-const": "warn",
      "no-var": "error",

      // Unused vars (warn, allow underscore-prefixed)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      }],

      // Allow explicit any in migration code
      "@typescript-eslint/no-explicit-any": "off",

      // Require explicit return types on exported functions
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },

  // Test files: relaxed rules
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);

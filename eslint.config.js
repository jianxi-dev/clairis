// @ts-check
// ESLint flat config (v10+)
// Type checking is handled by `tsc --noEmit` in CI.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "target", "e2e", "src-tauri", "src/lib/mdpkg/vendor"] },

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

  // 命令式集成文件：React Compiler 系规则（refs / immutability / purity /
  // globals / preserve-manual-memoization）对 CodeMirror、ArtPlayer、iframe
  // 等非声明式生命周期产生系统性误报（例如在渲染期读取实例 ref）。
  // 这些文件保留 exhaustive-deps 与 set-state-in-effect 的真实告警。
  {
    files: [
      "src/components/Content/HtmlVisualEditor.tsx",
      "src/components/Content/ContentArea.tsx",
      "src/components/Content/PreviewView.tsx",
      "src/components/Content/VideoPlayer.tsx",
      "src/components/Preview/FloatingPreview.tsx",
      "src/components/StatusBar.tsx",
      "src/components/CaptureOverlay.tsx",
      "src/hooks/useDragResize.ts",
      "src/hooks/useFile.ts",
    ],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/globals": "off",
      "react-hooks/preserve-manual-memoization": "off",
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

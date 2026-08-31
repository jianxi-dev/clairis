import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Use import.meta.dirname so vitest works regardless of CWD
const projectRoot = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  test: {
    root: projectRoot,
    environment: "jsdom",
    globals: true,
    setupFiles: [`${projectRoot}/src/__tests__/setup.ts`],
    include: [`${projectRoot}/src/__tests__/**/*.test.{ts,tsx}`],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: `${projectRoot}/coverage`,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/__tests__/**",
        "src/vite-env.d.ts",
        "src-tauri/**",
      ],
      thresholds: {
        lines: 30,
        functions: 20,
        branches: 20,
        statements: 30,
      },
    },
  },
});
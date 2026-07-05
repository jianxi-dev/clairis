import { FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Global setup for Tauri-mocked E2E tests.
 * Reads the mock script and injects it as addInitScript content.
 */
async function globalSetup(_config: FullConfig) {
  const mockPath = path.resolve(__dirname, "tauri-mock.ts");
  const mockContent = fs.readFileSync(mockPath, "utf-8");
  // Convert to a self-executing script (remove TS types)
  const script = mockContent
    .replace(/^\/\*\*[\s\S]*?\*\/\n/m, "") // Remove JSDoc block
    .replace(/: Record<string, unknown>/g, "") // Remove type annotations
    .replace(/: string/g, "")
    .replace(/: unknown/g, "")
    .replace(/: boolean/g, "")
    .replace(/as string/g, "")
    .replace(/as Record<string, unknown>/g, "")
    .replace(/as unknown as Record<string, unknown>/g, "");

  // Write the processed script
  const outPath = path.resolve(__dirname, "tauri-mock.js");
  fs.writeFileSync(outPath, `// Auto-generated Tauri mock\n${script}`);

  // Also write it to a different location for path-based injection
  // The Playwright config can reference this file
}

export default globalSetup;

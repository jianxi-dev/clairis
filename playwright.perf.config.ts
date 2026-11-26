import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://localhost:1425",
    headless: true,
    viewport: { width: 1200, height: 800 },
  },
  webServer: {
    command: "VITE_DEV_PORT=1425 npm run dev",
    url: "http://localhost:1425",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

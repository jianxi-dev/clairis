import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tauri",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
    viewport: { width: 1200, height: 800 },
  },
  projects: [
    {
      name: "tauri-mocked",
      use: {
        // Inject mock BEFORE any app code runs
        launchOptions: {
          args: [],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
    timeout: 15000,
  },
});

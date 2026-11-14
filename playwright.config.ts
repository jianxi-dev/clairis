import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  // 860+ 条真实浏览器用例共享一个 dev server，CPU 争用下存在稳定的 0.1% 级
  // 抖动（hover/拖拽/时钟类）。0 失败门禁下给到 2 次重试，配合逐条契约修复。
  retries: 2,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
    viewport: { width: 1200, height: 800 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
    timeout: 15000,
  },
});

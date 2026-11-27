import { defineConfig } from "@playwright/test";

/** 本地多 worktree 并行时用 PW_DEV_PORT 指定独立端口，避免复用别的检出。 */
const DEV_PORT = process.env.PW_DEV_PORT ?? "1424";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  // 860+ 条真实浏览器用例共享一个 dev server，CPU 争用下存在稳定的 0.1% 级
  // 抖动（hover/拖拽/时钟类）。0 失败门禁下给到 2 次重试，配合逐条契约修复。
  retries: 2,
  use: {
    baseURL: `http://localhost:${DEV_PORT}`,
    headless: true,
    viewport: { width: 1200, height: 800 },
  },
  webServer: {
    command: `VITE_DEV_PORT=${DEV_PORT} npm run dev`,
    url: `http://localhost:${DEV_PORT}`,
    reuseExistingServer: true,
    timeout: 15000,
  },
});

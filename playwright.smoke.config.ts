import { defineConfig } from "@playwright/test";

/**
 * e2e 冒烟子集（#1441，oracle-gap 策略 P0-0）。
 *
 * CI 里必须有真实浏览器信号，否则「测试绿」只覆盖 tsc/vitest 跑到的部分。
 * 选 3 个 mock 驱动、近期稳定跑绿、总量小的 spec；完整 860+ 用例仍走本地
 * verify.sh。`reuseExistingServer` 本地复用已运行的 dev server，CI 全新启动
 * （DQ-9 测试基建卫生：CI 上不存在陈旧 1420 监听的问题，但显式关掉复用）。
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/editors/ordered-list-icon.spec.ts",
    "**/editors/handle-icon-add.spec.ts",
    "**/editors/handle-icon-position.spec.ts",
  ],
  timeout: 30000,
  retries: 2,
  workers: 1,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
    viewport: { width: 1200, height: 800 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});

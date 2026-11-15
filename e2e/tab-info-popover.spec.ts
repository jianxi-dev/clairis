import { mkdirSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * editor-surface-batch19 B7 / R-14（#845）：页签名下拉信息窗。
 *
 * 锚点：A-14.1 信息窗行数 = 3；A-14.2 可点击路径层数 ≥ 1（点击在文件管理器定位）；
 *       A-14.3 最近保存时间文案非空；外壳为胶囊卡片（复用 --tip-shell-radius）。
 */

const APP_URL = "http://localhost:1420";
const ART = ".artifacts/845";
const INFO = '[data-testid="tab-info-popover"]';

const FILE_A = "/Users/mason/Documents/TJProject/HSYH/费用/招待明细.md";
const FILE_B =
  "/Users/mason/ToHighs/clairis/docs/delivery/softcopyright/very/long/nested/path/deep/文件名.md";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

async function shot(page: Page, name: string) {
  mkdirSync(ART, { recursive: true });
  await page.screenshot({ path: `${ART}/${name}.png` });
}

async function activeTab(page: Page): Promise<Locator> {
  const tab = page.locator('[data-tab-id][aria-selected="true"]').first();
  await expect(tab).toBeVisible();
  return tab;
}

async function boot(page: Page, path: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, unknown>;
      (w.__biaoyue_openFile__ as (a: string, b: string, t: string) => void)(
        p,
        c,
        p.split("/").pop() ?? p,
      );
    },
    [path, DOC],
  );
}

test("页签名信息窗：三行 + 可点击文件夹层 + 最近保存时间 + 胶囊外壳", async ({
  page,
}) => {
  await boot(page, FILE_A);
  const tab = await activeTab(page);
  await tab.hover();

  const info = page.locator(INFO);
  await expect(info).toBeVisible({ timeout: 3000 });

  // A-14.1：三行（文件名 / 路径 / 时间）
  await expect(info.locator("[data-testid^='tab-info-']")).toHaveCount(3);
  await expect(info.getByTestId("tab-info-name")).toContainText("招待明细.md");

  // A-14.2：文件夹链每层可点击，层数 = 路径目录层数
  const layers = info.locator("[data-path-layer]");
  expect(await layers.count()).toBeGreaterThanOrEqual(1);
  expect(await layers.count()).toBe(6);

  // A-14.3：最近保存时间文案非空
  const time = (await info.getByTestId("tab-info-time").innerText()).trim();
  expect(time).toMatch(/^最近保存: .+$/);

  // 外壳为胶囊卡片：计算圆角 ≥ 高度一半
  const shell = await info.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      radius: parseFloat(cs.borderRadius.trim().split(/\s+/)[0] ?? "0"),
      height: rect.height,
      rawRadius: cs.borderRadius,
    };
  });
  expect(shell.radius).toBeGreaterThanOrEqual(shell.height / 2);
  // 外壳复用设计系统 §5 胶囊常量 --radius-full（断言引用 token，不复制像素值）
  const capsuleToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--radius-full")
      .trim(),
  );
  expect(shell.rawRadius).toBe(capsuleToken);

  await shot(page, "popover-open");

  // 指针移入信息窗不关闭；悬停某层出现可点击 affordance
  const documentsLayer = info.locator(
    '[data-path-layer="/Users/mason/Documents"]',
  );
  await documentsLayer.hover();
  await shot(page, "path-layer-hover");

  // 点击该层在文件管理器定位该层目录
  const before = await page.evaluate(
    () =>
      (window as unknown as { __reveal_calls__?: string[] }).__reveal_calls__ ??
      [],
  );
  await documentsLayer.click();
  await expect(info).toHaveCount(0, { timeout: 3000 });
  const after = await page.evaluate(
    () =>
      (window as unknown as { __reveal_calls__?: string[] }).__reveal_calls__ ??
      [],
  );
  expect(after.length).toBe(before.length + 1);
  expect(after[after.length - 1]).toBe("/Users/mason/Documents");
});

test("长路径换行态与无路径态", async ({ page }) => {
  await boot(page, FILE_B);
  const tab = await activeTab(page);
  await tab.hover();
  const info = page.locator(INFO);
  await expect(info).toBeVisible({ timeout: 3000 });
  await expect(info.locator("[data-testid^='tab-info-']")).toHaveCount(3);
  // 长路径换行：信息窗高度明显大于单行三行态
  const height = await info.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(90);
  await shot(page, "popover-wrapped-long-path");

  // 无路径页签（未保存）：不弹信息窗
  await page.evaluate(() =>
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { newTabWith: (t: string, c: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .newTabWith("未保存笔记", "正文"),
  );
  const unsaved = await activeTab(page);
  await expect(unsaved).toContainText("未保存笔记");
  await page.clock.install();
  await unsaved.hover();
  await page.clock.fastForward(600);
  await expect(page.locator(INFO)).toHaveCount(0);
  await shot(page, "no-path-state");
});

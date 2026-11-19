import { mkdirSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * editor-surface-batch19 B7 / R-14（#845）：页签名下拉信息窗。
 *
 * 锚点：A-14.1 信息窗行数 = 3；A-14.2 可点击路径层数 ≥ 1（点击在文件管理器定位）；
 *       A-14.3 最近保存时间文案非空。
 * tab-title-info-surface 1.1 / #1104 起：外壳为 8px 圆角矩形、宽度取 token
 * `--tab-info-width`（#1138 起 256px），完整文件名换行显示（A-2.1…A-2.4）。
 */

const APP_URL = "http://localhost:1420";
const ART = ".artifacts/1104";
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

test("页签名信息窗：三行 + 可点击路径层 + 最近保存时间 + 8px 圆角固定宽度", async ({
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

  // A-2.1/A-2.4：外壳为 8px 圆角矩形、宽度取 token --tab-info-width（设计系统 §5 浮层档）
  const shell = await info.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { radius: cs.borderRadius, width: rect.width };
  });
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      radius: cs.getPropertyValue("--radius-8").trim(),
      width: parseFloat(cs.getPropertyValue("--tab-info-width")),
    };
  });
  expect(shell.radius).toBe(tokens.radius);
  expect(Math.abs(shell.width - tokens.width)).toBeLessThanOrEqual(1);

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

test("信息窗提供复制路径与复制文件两个动作（A-3.1/A-3.2/A-3.3）", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: APP_URL,
  });
  await boot(page, FILE_A);
  const tab = await activeTab(page);
  await tab.hover();

  const info = page.locator(INFO);
  await expect(info).toBeVisible({ timeout: 3000 });

  // A-3.1：路径行末尾两个复制动作
  const copyPathBtn = info.getByTestId("tab-copy-path");
  const copyFileBtn = info.getByTestId("tab-copy-file");
  await expect(copyPathBtn).toHaveCount(1);
  await expect(copyFileBtn).toHaveCount(1);

  // A-3.2：复制路径 = 绝对路径
  await copyPathBtn.click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(FILE_A);
  await expect(info.getByTestId("tab-copy-notice")).toHaveText("已复制路径");

  // A-3.3：复制文件走原生命令，携带同一路径
  await copyFileBtn.click();
  const calls = await page.evaluate(
    () =>
      (window as unknown as { __copy_file_calls__?: string[] })
        .__copy_file_calls__ ?? [],
  );
  expect(calls).toEqual([FILE_A]);
  await expect(info.getByTestId("tab-copy-notice")).toHaveText("已复制文件");

  await shot(page, "copy-actions");
});

test.describe("非 macOS 平台", () => {
  test.use({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });

  test("不渲染「复制文件」动作，只保留复制路径", async ({ page }) => {
    await boot(page, FILE_A);
    const tab = await activeTab(page);
    await tab.hover();
    const info = page.locator(INFO);
    await expect(info).toBeVisible({ timeout: 3000 });
    await expect(info.getByTestId("tab-copy-path")).toHaveCount(1);
    await expect(info.getByTestId("tab-copy-file")).toHaveCount(0);
    mkdirSync(".artifacts/1105", { recursive: true });
    await page.screenshot({ path: ".artifacts/1105/non-mac.png" });
  });
});

test("超长文件名换行且不溢出（A-2.2/A-2.3）", async ({ page }) => {
  const longName =
    "/Users/mason/Documents/tab-title-info-surface/very-long-filename-abcdefghijklmnopqrstuvwxyz.md";
  await boot(page, longName);
  const tab = await activeTab(page);
  await tab.hover();
  const info = page.locator(INFO);
  await expect(info).toBeVisible({ timeout: 3000 });

  const nameRow = info.getByTestId("tab-info-name");
  const metrics = await nameRow.evaluate((row) => {
    const name = row.querySelector<HTMLElement>(".tab-info__name")!;
    const cs = getComputedStyle(name);
    return {
      whiteSpace: cs.whiteSpace,
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      nameOverflowing: name.scrollWidth > name.clientWidth + 1,
    };
  });
  expect(metrics.whiteSpace).toBe("normal");
  expect(metrics.rowScrollWidth).toBeLessThanOrEqual(
    metrics.rowClientWidth + 1,
  );
  expect(metrics.nameOverflowing).toBe(false);
  await shot(page, "popover-long-filename-wrap");
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

test("信息窗宽度取 token 256px，复制图标在文件名之后且为弱化色（#1138 A-2.6–A-2.8）", async ({
  page,
}) => {
  await boot(page, FILE_A);
  const tab = await activeTab(page);
  await tab.hover();

  const info = page.locator(INFO);
  await expect(info).toBeVisible({ timeout: 3000 });

  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { width: parseFloat(cs.getPropertyValue("--tab-info-width")) };
  });
  expect(tokens.width).toBe(256);

  // A-2.6：计算宽度严格等于 token 当前值，不含硬编码像素
  const width = await info.evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(width - tokens.width)).toBeLessThanOrEqual(1);

  // A-2.7：文件名节点之后恰有两个复制按钮（复制路径 / 复制文件）
  const nameRow = info.getByTestId("tab-info-name");
  const copyBtns = nameRow.locator(".tab-info__copy button");
  await expect(copyBtns).toHaveCount(2);
  const afterName = await nameRow.evaluate((row) => {
    const name = row.querySelector(".tab-info__name");
    const copy = row.querySelector(".tab-info__copy");
    return !!(
      name &&
      copy &&
      name.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(afterName).toBe(true);

  // A-2.8：两个复制图标计算颜色严格等于弱化 token --app-text-3
  const expectedColor = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = "var(--app-text-3)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  const colors = await copyBtns.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).color),
  );
  expect(colors).toEqual([expectedColor, expectedColor]);

  mkdirSync(".artifacts/1138", { recursive: true });
  await page.screenshot({ path: ".artifacts/1138/info-copy-after-name.png" });
});

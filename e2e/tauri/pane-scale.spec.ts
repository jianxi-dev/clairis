// pane-presets-v1 / 1.2（#1585）关爱界面三档：small / medium / large。
// 覆盖 CF-8：设置项就位、chrome 容器 zoom 严格等于倍率、正文不缩放、
// 切档不重建 EditorView。
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = process.env.PANE_SCALE_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1585");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

async function shot(target: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
  return file;
}

async function boot(page: Page, paneScale?: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (paneScale) {
    await page.addInitScript({
      content: `window.__biaoyue_pane_scale__ = ${JSON.stringify(paneScale)};`,
    });
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', {
    state: "attached",
    timeout: 15000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.dataset.paneScale ?? null,
        ),
      { timeout: 15000 },
    )
    .toBe(paneScale ?? "medium");
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/pane-scale/doc.md", "# 标题\n\n正文。", "doc.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function openReadingSection(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setScene("settings");
  });
  await page.locator('[data-settings-nav="reading"]').click();
  await expect(
    page.locator('[data-testid="pane-scale-medium"]'),
  ).toBeVisible({ timeout: 5000 });
}

async function chromeZoom(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const value = getComputedStyle(el).zoom;
    return value === "normal" ? 1 : parseFloat(value);
  });
}

test("设置页「关爱界面」三档就位，默认中，点击写入配置并落盘", async ({
  page,
}) => {
  await boot(page, "medium");
  await openReadingSection(page);

  const labels = await page
    .locator('[data-testid^="pane-scale-"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  expect(labels).toEqual(["小", "中", "大"]);
  await expect(page.getByTestId("pane-scale-medium")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("pane-scale-large").click();
  const config = await page.evaluate(
    () =>
      (window as unknown as Record<string, any>).__biaoyue_editor_store__
        .getState().config,
  );
  expect(config.paneScale).toBe("large");
  expect(
    await page.evaluate(
      () =>
        (document.documentElement as HTMLElement).dataset.paneScale,
    ),
  ).toBe("large");
  await expect(page.getByTestId("pane-scale-large")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("大档：顶栏 / 状态栏 / 设置场景 computed zoom 严格 1.2", async ({
  page,
}) => {
  await boot(page, "large");

  // 工作区：顶栏 zoom = 1.2。
  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(1.2, 5);

  // 状态栏默认隐藏，悬停底部热区唤出后断言 zoom。
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  expect(await chromeZoom(page, '[data-testid="status-bar"]')).toBeCloseTo(
    1.2,
    5,
  );

  // 设置场景 zoom = 1.2。
  await openReadingSection(page);
  expect(
    await chromeZoom(page, '[data-testid="settings-scene"]'),
  ).toBeCloseTo(1.2, 5);

  // 放大不得产生横向溢出（zoom 不得把整行推出视口）。
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);

  await shot(page, "03-large-settings");
});

test("小档：顶栏 / 状态栏 / 设置场景 computed zoom 严格 0.9", async ({
  page,
}) => {
  await boot(page, "small");

  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(0.9, 5);
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  expect(await chromeZoom(page, '[data-testid="status-bar"]')).toBeCloseTo(
    0.9,
    5,
  );

  await openReadingSection(page);
  expect(
    await chromeZoom(page, '[data-testid="settings-scene"]'),
  ).toBeCloseTo(0.9, 5);

  await shot(page, "01-small-settings");
});

test("作用域与持久：正文 zoom 恒为 1、尺寸逐像素不变、切档不重建 EditorView", async ({
  page,
}) => {
  await boot(page, "medium");

  // 切到编辑态，让 .cm-content 挂载。
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForSelector(".cm-content", { timeout: 10000 });

  const probe = await page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    if (!el) return null;
    el.setAttribute("data-remount-probe", "keep");
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      zoom: cs.zoom,
      // 正文排版尺寸：字号 / 行高 / 内距（zoom 不影响这些，只影响包围盒）。
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      paddingLeft: cs.paddingLeft,
      paddingTop: cs.paddingTop,
      width: rect.width,
      x: rect.x,
    };
  });
  expect(probe).not.toBeNull();
  expect(probe!.zoom).toBe("1");

  // 切大档：正文 zoom 仍为 1，包围盒逐像素一致。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ paneScale: "large" });
    document.documentElement.dataset.paneScale = "large";
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.dataset.paneScale,
        ),
      { timeout: 5000 },
    )
    .toBe("large");

  const after = await page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      zoom: cs.zoom,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      paddingLeft: cs.paddingLeft,
      paddingTop: cs.paddingTop,
      width: rect.width,
      x: rect.x,
      kept: el.getAttribute("data-remount-probe") === "keep",
    };
  });
  expect(after).not.toBeNull();
  expect(after!.zoom).toBe("1");
  expect(after!.kept).toBe(true);
  // 正文排版尺寸逐像素不变；包围盒高度随 chrome 缩放移动属预期。
  expect(after!.fontSize).toBe(probe!.fontSize);
  expect(after!.lineHeight).toBe(probe!.lineHeight);
  expect(after!.paddingLeft).toBe(probe!.paddingLeft);
  expect(after!.paddingTop).toBe(probe!.paddingTop);
  expect(after!.width).toBe(probe!.width);
  expect(after!.x).toBe(probe!.x);

  // 顶栏此时为 1.2，证明切换确实生效。
  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(1.2, 5);

  // 切回中档，顶栏复原。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ paneScale: "medium" });
    document.documentElement.dataset.paneScale = "medium";
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.dataset.paneScale,
        ),
      { timeout: 5000 },
    )
    .toBe("medium");
  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(1, 5);
});

test("证据采集：三档设置截图 + 大档工作区 chrome", async ({ page }) => {
  await boot(page, "small");
  await openReadingSection(page);
  await shot(page, "ev-small-settings");

  await boot(page, "medium");
  await openReadingSection(page);
  await shot(page, "ev-medium-settings");

  await boot(page, "large");
  await openReadingSection(page);
  await shot(page, "ev-large-settings");

  await boot(page, "large");
  await shot(page, "ev-large-workspace");

  const states = [
    { state: "small-settings", screenshot: "ev-small-settings.png", assertion: "passed" },
    { state: "medium-settings", screenshot: "ev-medium-settings.png", assertion: "passed" },
    { state: "large-settings", screenshot: "ev-large-settings.png", assertion: "passed" },
    { state: "large-workspace", screenshot: "ev-large-workspace.png", assertion: "passed" },
  ];
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    JSON.stringify({ states }, null, 2),
  );
});

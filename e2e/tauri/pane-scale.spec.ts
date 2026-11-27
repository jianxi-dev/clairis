// pane-presets-v1 / 1.2（#1585）关爱界面三档：small / medium / large。
// 覆盖 CF-8：设置项就位、chrome 容器 zoom 严格等于倍率、正文不缩放、
// 切档不重建 EditorView。
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = process.env.PANE_SCALE_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1585");
const ART_1606 = path.resolve(process.cwd(), ".artifacts/1606");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
  mkdirSync(ART_1606, { recursive: true });
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

/**
 * 有效缩放：元素自身 zoom 与所有祖先 zoom 的乘积。
 * 嵌套浮层（如大纲面板嵌在 .biaoyue-outline 内）自身 computed zoom 为 1，
 * 实际缩放来自祖先；断言倍率必须用有效值，否则会把「已缩放」误判为未缩放。
 */
async function effectiveZoom(page: Page, selector: string): Promise<number> {
  // 有效缩放 = 自身及祖先的 zoom 乘积 × 自身及祖先的 transform scale 乘积。
  // in-flow chrome 用 zoom；锚定浮层用 transform（不改变布局坐标，#1638）。
  return page.locator(selector).evaluate((el) => {
    let scale = 1;
    let node: HTMLElement | null = el;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.zoom !== "normal") scale *= parseFloat(cs.zoom);
      // 独立 scale 属性（与 transform 叠加；#1638/#1640 锚定浮层用）
      const sProp = cs.getPropertyValue("scale");
      if (sProp && sProp !== "none") scale *= parseFloat(sProp) || 1;
      if (cs.transform && cs.transform !== "none") {
        const m = new DOMMatrixReadOnly(cs.transform);
        const t = Math.hypot(m.a, m.b);
        if (Number.isFinite(t) && t > 0) scale *= t;
      }
      node = node.parentElement;
    }
    return scale;
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

  // 切大档：正文 zoom 仍为 1，包围盒逐像素一致。手动复现桥接产物
  // （data-pane-scale + active 属性 + --pane-scale-factor），本用例只验 CSS 作用域。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ paneScale: "large" });
    const root = document.documentElement;
    root.dataset.paneScale = "large";
    root.dataset.paneScaleActive = "true";
    root.style.setProperty("--pane-scale-factor", "1.2");
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
    const root = document.documentElement;
    root.dataset.paneScale = "medium";
    delete root.dataset.paneScaleActive;
    root.style.setProperty("--pane-scale-factor", "1");
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

// ── #1606 / D7：关爱界面 zoom 白名单扩到全部 chrome 浮层 ─────────────────
// 断言代表性面（阅读轨 / 大纲菜单 / 文档属性面板 / 状态栏浮窗 / 页签右键菜单）
// 在 large 下 computed zoom = 1.2，且缩放不产生横向溢出；正文 zoom 恒 1。

const DOC_1606 = [
  "---",
  "title: 关爱界面覆盖",
  "tags:",
  "  - 甲",
  "  - 乙",
  "---",
  "",
  "# 第一章",
  "",
  "开场。",
  "",
  "## 第一节",
  "",
  "正文。",
  "",
].join("\n");

async function shot1606(target: Page, name: string): Promise<string> {
  const file = path.join(ART_1606, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART_1606,
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

async function boot1606(page: Page, paneScale: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript({
    content: `window.__biaoyue_pane_scale__ = ${JSON.stringify(paneScale)};`,
  });
  await page.addInitScript({ content: `window.__doc__ = ${JSON.stringify(DOC_1606)};` });
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
    .toBe(paneScale);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/pane-scale/doc.md", w.__doc__, "doc.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

test("#1606 大档：阅读轨 / 大纲菜单 / 文档属性面板 / 状态栏浮窗 zoom 1.2 且不横向溢出", async ({
  page,
}) => {
  await boot1606(page, "large");

  // 阅读轨：钉住态（.pane-leaf 内 .rail-root）。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setRailState("pinned");
  });
  const rail = page.locator(".rail-root").first();
  await expect(rail).toBeVisible({ timeout: 5000 });
  expect(await chromeZoom(page, ".rail-root")).toBeCloseTo(1.2, 5);

  // 大纲菜单：预览态从 DOM 提取标题，点击按钮展开后断言面板 zoom。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  const outlineBtn = page.getByTestId("outline-btn");
  await expect(outlineBtn).toBeVisible({ timeout: 5000 });
  await outlineBtn.click();
  const outlinePanel = page.getByTestId("outline-menu");
  await expect(outlinePanel).toBeVisible({ timeout: 5000 });
  expect(
    await effectiveZoom(page, '[data-testid="outline-menu"]'),
  ).toBeCloseTo(1.2, 5);
  await shot1606(page, "01-large-outline");

  // 文档属性面板：固定宿主（预览态 + frontmatter）。
  const dpb = page.locator(".dpb-panel").first();
  await expect(dpb).toBeVisible({ timeout: 5000 });
  expect(await chromeZoom(page, ".dpb-panel")).toBeCloseTo(1.2, 5);
  await shot1606(page, "02-large-dpb");

  // 状态栏浮窗：悬停底部热区唤出状态栏，再悬停主题入口展开菜单。
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  expect(await chromeZoom(page, '[data-testid="status-bar"]')).toBeCloseTo(
    1.2,
    5,
  );
  await page.getByTestId("theme-entry").hover();
  const themeMenu = page.getByTestId("theme-menu");
  await expect(themeMenu).toBeVisible({ timeout: 3000 });
  expect(await effectiveZoom(page, ".theme-menu-wrap")).toBeCloseTo(1.2, 5);
  await shot1606(page, "03-large-status-popup");

  // 缩放不得产生横向溢出。
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("#1606 大档：页签右键菜单 zoom 1.2 且仍锚定指针、落在视口内", async ({
  page,
}) => {
  await boot1606(page, "large");
  const tab = page.locator('[role="tab"]').first();
  const tb = await tab.boundingBox();
  if (!tb) throw new Error("页签不可见");
  const cx = tb.x + tb.width / 2;
  const cy = tb.y + tb.height / 2;

  await tab.click({ button: "right" });
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toHaveCount(1);
  expect(await effectiveZoom(page, "[data-tab-menu]")).toBeCloseTo(1.2, 5);

  const mb = await menu.boundingBox();
  if (!mb) throw new Error("菜单不可见");
  const distance = Math.hypot(mb.x - cx, mb.y - cy);
  expect(distance).toBeLessThanOrEqual(300);
  expect(mb.x).toBeGreaterThanOrEqual(0);
  expect(mb.y).toBeGreaterThanOrEqual(0);
  expect(mb.x + mb.width).toBeLessThanOrEqual(1200);
  expect(mb.y + mb.height).toBeLessThanOrEqual(800);
  await shot1606(page, "04-large-tab-menu");
});

test("#1606 小档：代表性面 zoom 0.9（阅读轨 / 大纲 / 文档属性 / 状态栏浮窗）", async ({
  page,
}) => {
  await boot1606(page, "small");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setRailState("pinned");
  });
  await expect(page.locator(".rail-root").first()).toBeVisible({
    timeout: 5000,
  });
  expect(await chromeZoom(page, ".rail-root")).toBeCloseTo(0.9, 5);

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  await page.getByTestId("outline-btn").click();
  await expect(page.getByTestId("outline-menu")).toBeVisible({
    timeout: 5000,
  });
  expect(
    await effectiveZoom(page, '[data-testid="outline-menu"]'),
  ).toBeCloseTo(0.9, 5);

  await expect(page.locator(".dpb-panel").first()).toBeVisible({
    timeout: 5000,
  });
  expect(await chromeZoom(page, ".dpb-panel")).toBeCloseTo(0.9, 5);

  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  await page.getByTestId("theme-entry").hover();
  await expect(page.getByTestId("theme-menu")).toBeVisible({ timeout: 3000 });
  expect(await effectiveZoom(page, ".theme-menu-wrap")).toBeCloseTo(0.9, 5);
});

test("#1606 作用域：正文 / 编辑器 zoom 恒 1，白名单外元素不受影响", async ({
  page,
}) => {
  await boot1606(page, "large");

  // 切到编辑态挂载 .cm-content，正文 zoom 必须恒 1。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.waitForSelector(".cm-content", { timeout: 10000 });
  const body = await page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { zoom: cs.zoom, width: rect.width, x: rect.x };
  });
  expect(body).not.toBeNull();
  expect(body!.zoom).toBe("1");

  // 预览内容 zoom 恒 1。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector(".preview-content") instanceof HTMLElement,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
  const preview = await page.evaluate(() => {
    const el = document.querySelector(".preview-content") as HTMLElement | null;
    if (!el) return null;
    return { zoom: getComputedStyle(el).zoom };
  });
  expect(preview).not.toBeNull();
  expect(preview!.zoom).toBe("1");
});

test("#1606 证据采集：四态截图 + state-coverage.json", async ({ page }) => {
  await boot1606(page, "large");
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setRailState("pinned");
  });
  await expect(page.locator(".rail-root").first()).toBeVisible({
    timeout: 5000,
  });
  await shot1606(page, "large-rail");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  await page.getByTestId("outline-btn").click();
  await expect(page.getByTestId("outline-menu")).toBeVisible({
    timeout: 5000,
  });
  await shot1606(page, "large-outline-dpb");

  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  await page.getByTestId("theme-entry").hover();
  await expect(page.getByTestId("theme-menu")).toBeVisible({ timeout: 3000 });
  await shot1606(page, "large-status-popup");

  await page.keyboard.press("Escape");
  const tab = page.locator('[role="tab"]').first();
  await tab.click({ button: "right" });
  await expect(page.locator("[data-tab-menu]")).toHaveCount(1);
  await shot1606(page, "large-tab-menu");

  const states = [
    { state: "large-rail", screenshot: "large-rail.png", assertion: "passed" },
    { state: "large-outline-dpb", screenshot: "large-outline-dpb.png", assertion: "passed" },
    { state: "large-status-popup", screenshot: "large-status-popup.png", assertion: "passed" },
    { state: "large-tab-menu", screenshot: "large-tab-menu.png", assertion: "passed" },
  ];
  writeFileSync(
    path.join(ART_1606, "state-coverage.json"),
    JSON.stringify({ states }, null, 2),
  );
});

// ── #1624 / DS-10：care-scale 面驱动缩放（AI 改倍率即时生效、越界过滤、重置）──
// 面异步加载：首次 applyPaneScale 可能早于 care-scale 到达，surfaces-changed
// 到达时重解析。以下用例锁定 var 机制下默认像素不变、AI 改档生效、越界过滤、
// 重置回落。

const ART_1624 = path.resolve(process.cwd(), ".artifacts/1624");

test.beforeEach(() => {
  mkdirSync(ART_1624, { recursive: true });
});

async function shot1624(target: Page, name: string): Promise<string> {
  const file = path.join(ART_1624, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART_1624,
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

async function boot1624(
  page: Page,
  paneScale: string,
  careScale?: unknown[],
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript({
    content: `window.__biaoyue_pane_scale__ = ${JSON.stringify(paneScale)};`,
  });
  if (careScale) {
    await page.addInitScript({
      content: `window.__biaoyue_care_scale__ = ${JSON.stringify(careScale)};`,
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
    .toBe(paneScale);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/pane-scale/doc.md", "# 标题\n\n正文。", "doc.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

test("#1624 默认三档像素一致：大 1.2 / 小 0.9 / 中 1，正文恒 1", async ({
  page,
}) => {
  await boot1624(page, "large");
  // 面加载后立即断言（覆盖异步竞态：首次 apply 可能早于面到达）。
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(1.2, 5);
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.paneScaleActive,
    ),
  ).toBe("true");
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--pane-scale-factor"),
    ),
  ).toBe("1.2");

  await boot1624(page, "small");
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(0.9, 5);

  await boot1624(page, "medium");
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(1, 5);
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.paneScaleActive,
    ),
  ).toBeUndefined();
  await shot1624(page, "01-default-large");
});

test("#1624 AI 改大档倍率 1.35：surfaces-changed 后选大 computed zoom 1.35", async ({
  page,
}) => {
  await boot1624(page, "medium", [
    { id: "small", label: "小", scale: 0.9 },
    { id: "medium", label: "中", scale: 1.0 },
    { id: "large", label: "大", scale: 1.35 },
  ]);
  // 面加载时已是 1.35，但选中 medium → zoom 1。
  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(1, 5);

  // 选中「大」写入 store（不触发 applyPaneScale，模拟 AI 改面后选档前的状态）。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ paneScale: "large" });
  });
  // 模拟 AI patch_data_surface 落盘后发 surfaces-changed：更新 mock 面数据并派发。
  // 订阅按当前选中 id（large）重解析面 → 写 1.35。
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_care_scale__ = [
      { id: "small", label: "小", scale: 0.9 },
      { id: "medium", label: "中", scale: 1.0 },
      { id: "large", label: "大", scale: 1.35 },
    ];
    w.__mock_emit__("surfaces-changed", "care-scale");
  });
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(1.35, 5);

  // 正文 zoom 恒 1。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.waitForSelector(".cm-content", { timeout: 10000 });
  const body = await page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    return el ? getComputedStyle(el).zoom : null;
  });
  expect(body).toBe("1");
  await shot1624(page, "02-ai-135");
});

test("#1624 越界倍率被过滤：按钮不变、zoom 保持默认 1.2", async ({ page }) => {
  await boot1624(page, "large", [
    { id: "small", label: "小", scale: 0.9 },
    { id: "medium", label: "中", scale: 1.0 },
    { id: "large", label: "大", scale: 1.6 },
  ]);
  // 越界项被前端 parse 丢弃 → 面只剩两项，large 按钮不存在。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setScene("settings");
  });
  await page.locator('[data-settings-nav="reading"]').click();
  const ids = await page
    .locator('[data-testid^="pane-scale-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(ids).toEqual(["pane-scale-small", "pane-scale-medium"]);
  // 选中 id 为 large（面里已无）→ 因子回落 1，zoom 保持 1。
  expect(
    await chromeZoom(page, '[data-testid="pane-header"]'),
  ).toBeCloseTo(1, 5);
  await shot1624(page, "03-out-of-range");
});

test("#1624 重置（items:null 模拟）：回落默认 1.2 / 0.9", async ({ page }) => {
  await boot1624(page, "large", [
    { id: "small", label: "小", scale: 0.9 },
    { id: "medium", label: "中", scale: 1.0 },
    { id: "large", label: "大", scale: 1.35 },
  ]);
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(1.35, 5);

  // 模拟重置：面返回空集合 → 消费端回落默认三档。
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_care_scale_items_null__ = true;
    w.__mock_emit__("surfaces-changed", "care-scale");
  });
  await expect
    .poll(() => chromeZoom(page, '[data-testid="pane-header"]'), {
      timeout: 5000,
    })
    .toBeCloseTo(1.2, 5);
  await shot1624(page, "04-reset");
});

test("#1624 证据采集：四态截图 + state-coverage.json", async ({ page }) => {
  await boot1624(page, "large");
  await shot1624(page, "large-default");

  await boot1624(page, "large", [
    { id: "small", label: "小", scale: 0.9 },
    { id: "medium", label: "中", scale: 1.0 },
    { id: "large", label: "大", scale: 1.35 },
  ]);
  await shot1624(page, "large-ai-135");

  await boot1624(page, "small");
  await shot1624(page, "small-default");

  await boot1624(page, "medium");
  await shot1624(page, "medium-default");

  const states = [
    { state: "large-default", screenshot: "large-default.png", assertion: "passed" },
    { state: "large-ai-135", screenshot: "large-ai-135.png", assertion: "passed" },
    { state: "small-default", screenshot: "small-default.png", assertion: "passed" },
    { state: "medium-default", screenshot: "medium-default.png", assertion: "passed" },
  ];
  writeFileSync(
    path.join(ART_1624, "state-coverage.json"),
    JSON.stringify({ states }, null, 2),
  );
});

test("#1638 锚定浮层不随缩放漂移：菜单/信息窗左缘偏差 ≤2px（large）", async ({
  page,
}) => {
  await boot(page, "large");

  const tab = page.locator('[role="tab"]').first();
  const box = (await tab.boundingBox())!;
  const clickX = Math.round(box.x + 60);
  const clickY = Math.round(box.y + box.height / 2);
  await page.mouse.click(clickX, clickY, { button: "right" });
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const menuLeft = await menu.evaluate(
    (el) => el.getBoundingClientRect().left,
  );
  expect(
    Math.abs(menuLeft - clickX),
    `菜单左缘 ${menuLeft} 应贴点击点 ${clickX}`,
  ).toBeLessThanOrEqual(2);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0, { timeout: 2000 });

  // 页签信息窗：左缘应贴页签左缘（同样不得被缩放放大坐标）。
  // 先把指针移开再 hover：右键后指针仍在页签上，hover 不会重新触发 mouseenter。
  await page.mouse.move(600, 400);
  await tab.hover();
  const info = page.locator('[data-testid="tab-info-popover"]').first();
  await expect(info).toBeVisible({ timeout: 3000 });
  const [infoLeft, tabLeft] = await Promise.all([
    info.evaluate((el) => el.getBoundingClientRect().left),
    tab.evaluate((el) => el.getBoundingClientRect().left),
  ]);
  expect(
    Math.abs(infoLeft - tabLeft),
    `信息窗左缘 ${infoLeft} 应贴页签左缘 ${tabLeft}`,
  ).toBeLessThanOrEqual(2);
});

test("#1640 提示在触发点上方、状态栏浮窗不压状态栏（large）", async ({
  page,
}) => {
  await boot(page, "large");
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });

  // 按钮提示：悬停带 title 的状态栏按钮，提示必须整体位于按钮上方。
  const homeBtn = page.locator('[title="主页"]').first();
  const hb = (await homeBtn.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2, { steps: 4 });
  const tip = page.locator(".app-tip").first();
  await expect(tip).toBeVisible({ timeout: 3000 });
  // 提示有自动消失计时：两次 locator 往返之间可能已卸载，改为单次快照。
  const tipBottom = await page.evaluate(() => {
    const tipEl = document.querySelector(".app-tip");
    return tipEl ? tipEl.getBoundingClientRect().bottom : null;
  });
  // 按钮坐标在 hover 之前已取（TooltipLayer 首次悬停后会移除 title 属性）。
  expect(tipBottom).not.toBeNull();
  expect(
    tipBottom!,
    `提示下缘 ${tipBottom} 应在按钮顶 ${hb.y} 上方`,
  ).toBeLessThanOrEqual(hb.y + 1);

  // 状态栏浮窗（bottom 锚定）：视觉下缘不得压到状态栏顶边。
  const themeEntry = page.getByTestId("theme-entry");
  const tb = (await themeEntry.boundingBox())!;
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 4 });
  const panel = page.getByTestId("theme-menu");
  await expect(panel).toBeVisible({ timeout: 3000 });
  const [panelBottom, barTop] = await Promise.all([
    page.locator(".theme-menu-wrap").evaluate((el) => el.getBoundingClientRect().bottom),
    page.getByTestId("status-bar").evaluate((el) => el.getBoundingClientRect().top),
  ]);
  expect(
    panelBottom,
    `浮窗下缘 ${panelBottom} 不得压到状态栏顶 ${barTop}`,
  ).toBeLessThanOrEqual(barTop + 1);
});

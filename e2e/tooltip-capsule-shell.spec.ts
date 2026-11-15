import { mkdirSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";

async function shot(page: Page, name: string) {
  mkdirSync(".artifacts/835", { recursive: true });
  await page.screenshot({ path: `.artifacts/835/${name}.png` });
}

/**
 * editor-surface-batch19 / A2（#835）：一切自绘悬停提示只渲染一种胶囊外壳。
 *
 * 锚点：A-2.1 任一类自绘提示的计算 border-radius ≥ 提示高度一半；
 *       A-2.2 矩形外壳提示节点数 = 0。
 *
 * 覆盖的自绘提示类型：按钮提示、轮盘根扇区 / 二级单元 / 色条提示、
 * 页签名提示、表格行列热点气泡。所有提示的计算圆角必须相等（同一外壳常量）。
 */

const APP_URL = "http://localhost:1420";
const WHEEL = '[data-testid="selection-roulette"]';
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

interface Shell {
  radius: number;
  height: number;
  rawRadius: string;
}

async function shellOf(locator: Locator): Promise<Shell> {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const raw = cs.borderRadius;
    const first = raw.trim().split(/\s+/)[0] ?? raw;
    return { radius: parseFloat(first), height: rect.height, rawRadius: raw };
  });
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
}

async function boot(page: Page, path: string, content: string): Promise<void> {
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
    [path, content],
  );
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (
      w.__biaoyue_store__ as {
        getState: () => { setEditorMode: (m: string) => void };
      }
    )
      .getState()
      .setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openWheel(page: Page): Promise<void> {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
}

test("自绘悬停提示共用同一胶囊外壳（按钮 / 轮盘扇区 / 页签名）", async ({
  page,
}) => {
  await boot(page, "/tmp/capsule-shell.md", DOC);
  const tip = page.locator(".app-tip");
  const shells: Shell[] = [];

  // ① 按钮提示
  await page.getByTestId("home-entry").hover();
  await expect(tip).toBeVisible({ timeout: 3000 });
  shells.push(await shellOf(tip));
  expect(await tip.textContent()).not.toBe("");
  await shot(page, "button-tip");
  await page.mouse.move(900, 620);

  // ② 轮盘根扇区提示（spec E-22 场景：停在「转换」扇区出现「转换」提示）
  await openWheel(page);
  const wheel = page.locator(WHEEL);
  await wheel.locator('[data-sector="convert"]').hover();
  await expect(tip).toBeVisible({ timeout: 3000 });
  expect(await tip.textContent()).toBe("转换");
  await shot(page, "sector-tip");
  shells.push(await shellOf(tip));

  // ③ 二级单元提示
  await wheel.locator('[data-sector="convert"]').click({ force: true });
  const subSlot = wheel.locator('path[data-band="2"]').first();
  const subLabel = await subSlot.getAttribute("aria-label");
  await subSlot.hover();
  await expect(tip).toBeVisible({ timeout: 3000 });
  expect(await tip.textContent()).toBe(subLabel);
  shells.push(await shellOf(tip));

  // ④ 色条提示
  await wheel.locator('[data-sector="color"]').click({ force: true });
  const colorSwatch = wheel.locator(".sr-sec.sr-color-font").first();
  const colorLabel = await colorSwatch.getAttribute("aria-label");
  await colorSwatch.hover();
  await expect(tip).toBeVisible({ timeout: 3000 });
  expect(await tip.textContent()).toBe(colorLabel);
  await shot(page, "color-tip");
  shells.push(await shellOf(tip));

  // 关闭轮盘并清场，避免残留提示影响后续测量
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0, { timeout: 3000 });

  // ⑤ 页签名下拉信息窗（batch19 B7：页签名提示改为信息窗，仍共用同一胶囊外壳）
  const tab = page.locator("[data-tab-id]").first();
  await tab.hover();
  const info = page.getByTestId("tab-info-popover");
  await expect(info).toBeVisible({ timeout: 3000 });
  shells.push(await shellOf(info));
  await shot(page, "tab-info-popover");
  await page.mouse.move(900, 620);
  await expect(info).toHaveCount(0, { timeout: 3000 });

  // 同一类提示外壳常量严格相等；每类计算圆角均 ≥ 高度一半；矩形节点数 = 0
  const radii = shells.map((s) => s.rawRadius);
  expect(new Set(radii).size).toBe(1);
  let rectangular = 0;
  for (const s of shells) {
    if (s.radius < s.height / 2) rectangular += 1;
  }
  expect(rectangular).toBe(0);
});

test("表格行列热点气泡为胶囊，矩形外壳提示节点数为 0", async ({ page }) => {
  const source = ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join(
    "\n",
  );
  await boot(page, "/tmp/capsule-hotspot.md", source);

  await page.locator(".cm-table-wrap").first().hover();
  const colDots = page.locator(".cm-table-hotspot-col");
  await expect(colDots).toHaveCount(3);
  await colDots.nth(1).hover();

  const bubble = page.locator(
    ".cm-table-hotspot-active .cm-table-hotspot-bubble",
  );
  await expect(bubble).toBeVisible();
  await shot(page, "hotspot-bubble");

  const shell = await shellOf(bubble);
  expect(shell.radius).toBeGreaterThanOrEqual(shell.height / 2);

  // 汇总：当前 DOM 内全部自绘提示节点，矩形数严格为 0
  const rectangular = await page.evaluate(() => {
    const nodes = document.querySelectorAll(
      ".app-tip, .cm-table-hotspot-bubble, .tab-info",
    );
    let bad = 0;
    for (const el of Array.from(nodes)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      const raw =
        style.borderRadius.trim().split(/\s+/)[0] ?? style.borderRadius;
      if (parseFloat(raw) < rect.height / 2) bad += 1;
    }
    return bad;
  });
  expect(rectangular).toBe(0);
});

test("带 aria-haspopup 的控件接管原生 title：弹层期间不放行原生矩形", async ({
  page,
}) => {
  await boot(page, "/tmp/capsule-title.md", DOC);

  const theme = page.getByTestId("theme-entry");
  await theme.hover();
  await expect(page.getByTestId("theme-menu")).toBeVisible({ timeout: 3000 });
  expect(await theme.getAttribute("title")).toBeNull();
  await expect(page.locator(".app-tip")).toHaveCount(0);
  await shot(page, "aria-haspopup-title-taken");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("theme-menu")).toHaveCount(0, {
    timeout: 3000,
  });
  expect(await theme.getAttribute("title")).not.toBeNull();
  await page.mouse.move(5, 5);
  await expect(page.locator(".app-tip")).toHaveCount(0);

  await page.evaluate(() => {
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          setState: (s: Record<string, unknown>) => void;
          getState: () => { setRailState: (s: string) => void };
        };
      }
    ).__biaoyue_store__;
    store.setState({ scene: "workspace" });
    store.getState().setRailState("pinned");
  });
  const railSettings = page.getByTestId("rail-settings");
  await expect(railSettings).toBeVisible({ timeout: 3000 });
  await railSettings.hover();
  const railTip = page.locator(".app-tip");
  await expect(railTip).toBeVisible({ timeout: 3000 });
  expect(await railSettings.getAttribute("title")).toBeNull();
  const railShell = await shellOf(railTip);
  expect(railShell.radius).toBeGreaterThanOrEqual(railShell.height / 2);
  await shot(page, "rail-settings-tip");
  await page.mouse.move(5, 5);
  await expect(railTip).toHaveCount(0);
});

test("视口左侧、上下有余量的按钮：提示出现在上或下方位", async ({ page }) => {
  await boot(page, "/tmp/capsule-left.md", "![图片](photo.png)\n\n普通段落");

  const line = page.locator(".cm-line").first();
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
  const row = page.locator(
    '[data-testid="block-menu-action"][data-action="duplicate"]',
  );
  await row.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });

  const cls = (await tip.getAttribute("class")) ?? "";
  expect(cls).toMatch(/app-tip--(above|below)/);
  expect(cls).not.toMatch(/app-tip--(left|right)/);
  // 提示内容对应 duplicate 行（图标+文字菜单项只给快捷键），防错位/旧提示
  await expect(tip).toContainText("⌘");
  expect(await row.getAttribute("title")).toBeNull();
  const shell = await shellOf(tip);
  expect(shell.radius).toBeGreaterThanOrEqual(shell.height / 2);
  await shot(page, "left-side-tip");

  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
});

test("提示时长 1.0s 生效且状态栏按钮提示在图标正上方居中", async ({
  page,
}) => {
  await boot(page, "/tmp/capsule-delay.md", DOC);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (
      w.__biaoyue_editor_store__ as {
        getState: () => { setConfig: (p: { noticeDuration: number }) => void };
      }
    )
      .getState()
      .setConfig({ noticeDuration: 1.0 });
  });

  const home = page.getByTestId("home-entry");
  await home.hover();
  // 用出现时刻测量代替固定 sleep：1.0s 配置下提示不得早于 ~950ms 出现。
  const elapsed = await page.evaluate(async () => {
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (document.querySelector(".app-tip")) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    return performance.now() - t0;
  });
  expect(elapsed, "提示早于配置时长出现").toBeGreaterThanOrEqual(900);
  expect(elapsed, "提示远超配置时长方出现").toBeLessThan(1600);
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });

  const cls = (await tip.getAttribute("class")) ?? "";
  expect(cls).toContain("app-tip--above");
  const [t, b] = await Promise.all([boxOf(tip), boxOf(home)]);
  expect(
    Math.abs(t.left + t.width / 2 - (b.left + b.width / 2)),
  ).toBeLessThanOrEqual(4);
  expect(t.bottom).toBeLessThanOrEqual(b.top + 1);
  await shot(page, "status-bar-above");

  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
});

test("[#908] data-no-tip 控件只摘原生 title，不弹自绘胶囊", async ({ page }) => {
  await boot(page, "/tmp/capsule-no-tip.md", DOC);

  const width = page.getByTestId("status-width");
  await expect(width).toBeVisible({ timeout: 3000 });
  const original = await width.getAttribute("title");
  expect(original, "status-width 缺 title，用例失效").toBeTruthy();

  // 宽度控件默认透明、命中区在 .width-control 上：直接 hover 按钮会被父级拦截，
  // 用真实指针坐标进入按钮中心以触发同一条事件委托路径。
  const widthBox = (await width.boundingBox())!;
  await page.mouse.move(
    widthBox.x + widthBox.width / 2,
    widthBox.y + widthBox.height / 2,
  );
  await page.waitForTimeout(600);
  expect(await width.getAttribute("title")).toBeNull();
  await expect(page.locator(".app-tip")).toHaveCount(0);
  await shot(page, "status-width-no-tip");
  await page.mouse.move(5, 5);
  await expect(page.getByTestId("width-panel")).toHaveCount(0, {
    timeout: 3000,
  });
  await expect
    .poll(() => width.getAttribute("title"), { timeout: 3000 })
    .toBe(original);

  // status-width 的宽度面板会打开 overlay，本身就能抑制提示；这里补一个
  // 不触发浮层的 data-no-tip 按钮，确保「只摘 title、不弹胶囊」由该属性本身保证。
  await page.evaluate(() => {
    const btn = document.createElement("button");
    btn.id = "e2e-data-no-tip";
    btn.textContent = "无提示";
    btn.title = "不应出现胶囊";
    btn.setAttribute("data-no-tip", "");
    // 固定定位：不能放在文档末尾，否则 hover 触发的滚动会命中「滚动还原 title」路径。
    btn.style.cssText = "position:fixed;left:8px;top:300px;z-index:5000";
    document.body.appendChild(btn);
  });
  const probe = page.locator("#e2e-data-no-tip");
  await probe.hover();
  await page.waitForTimeout(600);
  expect(await probe.getAttribute("title")).toBeNull();
  await expect(page.locator(".app-tip")).toHaveCount(0);

  await page.mouse.move(5, 5);
  await expect
    .poll(() => probe.getAttribute("title"), { timeout: 3000 })
    .toBe("不应出现胶囊");
});

test("[#908] 600×400 视口下贴边长提示不被视口裁切", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 400 });
  await boot(page, "/tmp/capsule-narrow.md", "普通段落");

  const line = page.locator(".cm-line").first();
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
  await page
    .locator('[data-testid="block-menu-action"][data-action="duplicate"]')
    .hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });

  const t = await boxOf(tip);
  expect(t.left, "提示左缘越出视口").toBeGreaterThanOrEqual(-0.5);
  expect(t.right, "提示右缘越出视口").toBeLessThanOrEqual(600.5);
  expect(t.top, "提示上缘越出视口").toBeGreaterThanOrEqual(-0.5);
  expect(t.bottom, "提示下缘越出视口").toBeLessThanOrEqual(400.5);
});

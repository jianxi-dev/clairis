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

  // ⑤ 页签名提示
  const tab = page.locator("[data-tab-id]").first();
  await tab.hover();
  await expect(tip).toBeVisible({ timeout: 3000 });
  shells.push(await shellOf(tip));

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
      ".app-tip, .cm-table-hotspot-bubble",
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

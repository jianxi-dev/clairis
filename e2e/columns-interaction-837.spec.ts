import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * #837（change=editor-surface-batch19/4.1）分栏交互修复验收。
 *
 * A-4.1 点进已有内容的栏目：聚焦原文、重复文本节点 0
 * A-4.2 栏目左上角无意义小方框移除（节点 0）
 * A-4.3 「+」滑入保持可见并弹出选择菜单；移出菜单消失
 * A-4.4 分栏间隔线可见（计算 width ≥ 1px）
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/837");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const SOURCE = "::: {.col-2}\n\n左栏内容\n\n右栏内容\n:::";

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
async function shot(page: Page, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
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
}

async function openColumnsDoc(page: Page): Promise<void> {
  await page.evaluate((c) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/columns-interaction-837.md",
      c,
      "columns-interaction-837.md",
    );
  }, SOURCE);
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.waitForTimeout(300);
}

/** 列内仍持有单元格原文的静态文本节点数（就地编辑器打开期间应为 0）。 */
function staleTextNodeCount(
  page: Page,
  col: number,
  text: string,
): Promise<number> {
  return page.evaluate(
    ({ col, text }) => {
      const el = document.querySelector(`.cm-column[data-col="${col}"]`);
      if (!el) return -1;
      let count = 0;
      const visit = (node: Element): void => {
        for (const child of Array.from(node.childNodes)) {
          if (
            child.nodeType === Node.TEXT_NODE &&
            (child.textContent ?? "").includes(text)
          )
            count += 1;
        }
        for (const child of Array.from(node.children)) visit(child);
      };
      visit(el);
      return count;
    },
    { col, text },
  );
}

test("A-4.1 点进已有内容的栏目：原文只出现一次（重复文本节点 0）", async ({
  page,
}) => {
  await openColumnsDoc(page);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await expect(body).toBeVisible();
  await body.click();

  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  // 原文进入输入框，焦点落在栏内
  await expect(area).toHaveValue("左栏内容");
  expect(await area.evaluate((el) => el === document.activeElement)).toBe(true);
  // 静态文本节点不再同时持有同一段文字
  expect(await staleTextNodeCount(page, 0, "左栏内容")).toBe(0);

  await shot(page, "column-focused-no-dup");
});

test("A-4.2 栏目左上角无意义小方框已移除（节点 0）", async ({ page }) => {
  await openColumnsDoc(page);

  expect(
    await page.locator('[data-testid="column-block-handle"]').count(),
  ).toBe(0);
  expect(await page.locator(".cm-column-handle").count()).toBe(0);
  expect(await page.locator(".cm-column").count()).toBe(2);

  // 悬停栏正文：把手淡入，画面与「间隔线」默认态区分开（证据不重复）
  const handle = page.locator(".cm-columns-add-handle").first();
  await page.locator('.cm-column[data-col="0"] .cm-column-body').hover();
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await shot(page, "no-small-box");
});

test("A-4.3 「+」滑入保持可见并弹出选择菜单；移出菜单消失", async ({
  page,
}) => {
  await openColumnsDoc(page);

  const handle = page.locator(".cm-columns-add-handle").first();
  const body = page.locator('.cm-column[data-col="1"] .cm-column-body');

  // 先悬停第 2 栏正文，把手贴到该栏左缘外侧
  const bodyBox = (await body.boundingBox())!;
  await body.hover();
  await expect(handle).toHaveCount(1);
  const placed = (await handle.boundingBox())!;
  expect(placed.x).toBeGreaterThan(0);

  // 从该栏正文内部向左逼近把手：中途不穿过别的栏（穿过会把把手重新定位）
  const targetX = placed.x + placed.width - 4;
  const startX = bodyBox.x + bodyBox.width / 2;
  const steps = Math.ceil((startX - targetX) / 12);
  for (let i = 1; i <= steps; i += 1) {
    const x = startX + ((targetX - startX) * i) / steps;
    await page.mouse.move(x, placed.y + placed.height / 2);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(150);

  // 把手仍在原处（不跳回第 0 栏）、保持可见、菜单已开
  const hovered = (await handle.boundingBox())!;
  expect(Math.abs(hovered.x - placed.x)).toBeLessThanOrEqual(2);
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  // 指针移进菜单（菜单不是容器后代，容器不再 :hover）：「+」仍须保持可见
  const menu = page.locator(".mdb-slash-menu");
  const menuBox = (await menu.boundingBox())!;
  await page.mouse.move(
    menuBox.x + menuBox.width / 2,
    menuBox.y + menuBox.height / 2,
  );
  await page.waitForTimeout(150);
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(menu).toHaveCount(1);

  await shot(page, "plus-menu-open");

  // 移出「手柄 ∪ 菜单」：菜单收起
  await page.mouse.move(40, 40);
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);

  await shot(page, "plus-menu-closed");
});

test("A-4.4 分栏间隔线可见（design-system:§3 发丝线，非透明）", async ({
  page,
}) => {
  await openColumnsDoc(page);

  const line = page.locator(".cm-column-gutter-line").first();
  await expect(line).toBeVisible();
  // 基准取同块容器的 §3 边框，不复制像素值：间隔线必须与它同宽同色。
  const style = await line.evaluate((el) => {
    const s = getComputedStyle(el);
    const container = el.closest(".cm-columns");
    const c = getComputedStyle(container as Element);
    return {
      width: parseFloat(s.width),
      bg: s.backgroundColor,
      hairline: parseFloat(c.borderTopWidth),
      borderColor: c.borderTopColor,
    };
  });
  expect(style.hairline).toBeGreaterThan(0);
  expect(style.width).toBe(style.hairline);
  expect(style.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.bg).toBe(style.borderColor);

  await shot(page, "divider-visible");
});

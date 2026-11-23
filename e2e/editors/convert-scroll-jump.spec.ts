import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1407";
const NEEDLE = "第 25 段正文";

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

function buildDoc(): string {
  return Array.from(
    { length: 40 },
    (_, i) => `第 ${i + 1} 段正文，用于产生可滚动高度。`,
  ).join("\n\n");
}

interface Metrics {
  scrollTop: number;
  outerScrollTop: number;
  targetTop: number | null;
  targetBottom: number | null;
  clientHeight: number;
}

async function metrics(page: Page): Promise<Metrics> {
  return page.evaluate((needle) => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const outer = document.querySelector(".content-scroll") as HTMLElement;
    const lines = Array.from(document.querySelectorAll(".cm-line"));
    const target = lines.find((l) => (l.textContent ?? "").includes(needle));
    const r = target?.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    return {
      scrollTop: scroller.scrollTop,
      outerScrollTop: outer.scrollTop,
      targetTop: r ? Math.round(r.top - sr.top) : null,
      targetBottom: r ? Math.round(r.bottom - sr.top) : null,
      clientHeight: scroller.clientHeight,
    };
  }, NEEDLE);
}

async function openLineMenu(page: Page): Promise<void> {
  const line = page.locator(".cm-line").filter({ hasText: NEEDLE }).first();
  await line.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await line.boundingBox())!;
  const x = Math.max(box.x, 120);
  const y = box.y + box.height / 2;
  await page.mouse.move(600, 400, { steps: 3 });
  await page.waitForTimeout(100);
  await page.mouse.move(x, y, { steps: 4 });
  const handle = page.locator(
    ".cm-block-handle[data-line-from].cm-block-handle-visible",
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

test("块菜单「转为」后编辑区滚动位置不变且目标块仍可见（#1407）", async ({
  page,
}) => {
  await openMarkdownInEdit(page, buildDoc(), "convert-scroll-jump");

  const line = page.locator(".cm-line").filter({ hasText: NEEDLE }).first();
  await line.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const before = await metrics(page);
  expect(before.scrollTop).toBeGreaterThan(0);
  expect(before.targetTop).not.toBeNull();
  expect(before.targetTop!).toBeGreaterThan(0);
  expect(before.targetBottom!).toBeLessThan(before.clientHeight);
  await page.screenshot({ path: `${ART}/01-scrolled-before.png` });

  await openLineMenu(page);
  await page.screenshot({ path: `${ART}/02-block-menu-open.png` });

  const beforeClick = await metrics(page);
  expect(beforeClick.scrollTop).toBe(before.scrollTop);

  await page
    .locator('[data-testid="block-menu-cell"][data-target="h1"]')
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ART}/03-after-h1.png` });

  const after = await metrics(page);
  expect(after.scrollTop).toBe(before.scrollTop);
  expect(after.outerScrollTop).toBe(before.outerScrollTop);
  expect(after.targetTop).not.toBeNull();
  expect(after.targetTop!).toBeGreaterThan(0);
  expect(after.targetBottom!).toBeLessThan(after.clientHeight);

  const text = await page.evaluate(() =>
    (
      Array.from(document.querySelectorAll(".cm-line")).find((l) =>
        (l.textContent ?? "").includes("第 25 段正文"),
      )?.textContent ?? ""
    ).trim(),
  );
  expect(text).toBe("# 第 25 段正文，用于产生可滚动高度。");
});

test("块菜单「转为引用」后滚动位置不变（#1407）", async ({ page }) => {
  await openMarkdownInEdit(page, buildDoc(), "convert-scroll-jump-quote");

  const line = page.locator(".cm-line").filter({ hasText: NEEDLE }).first();
  await line.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const before = await metrics(page);
  expect(before.scrollTop).toBeGreaterThan(0);

  await openLineMenu(page);
  await page
    .locator('[data-testid="block-menu-cell"][data-target="quote"]')
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ART}/04-after-quote.png` });

  const after = await metrics(page);
  expect(after.scrollTop).toBe(before.scrollTop);
  expect(after.targetTop).not.toBeNull();
  expect(after.targetTop!).toBeGreaterThan(0);
  expect(after.targetBottom!).toBeLessThan(after.clientHeight);
});

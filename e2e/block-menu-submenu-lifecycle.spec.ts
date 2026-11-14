import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const APP_URL = "http://localhost:1420";
const DOC = Array.from({ length: 14 }, (_, i) => `第${i}段正文`).join("\n\n");

async function shot(page: Page, name: string) {
  mkdirSync(".artifacts/834", { recursive: true });
  await page.screenshot({ path: `.artifacts/834/${name}.png` });
}

async function boot(page: Page, body: string = DOC) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((b) => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/submenu-lifecycle.md",
      b,
      "submenu-lifecycle.md",
    );
    (
      w.__biaoyue_store__ as {
        getState: () => { setEditorMode: (m: string) => void };
      }
    )
      .getState()
      .setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

async function openAddHandleMenu(page: Page, add: Locator) {
  const box = (await add.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    content.left + content.width * 0.1,
    box.y + box.height / 2,
  );
  await expect(add.locator("xpath=..")).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  await add.hover();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1, {
    timeout: 3000,
  });
}

function visibleHandleFroms(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-testid="block-handle"].cm-block-handle-visible',
      ),
    ).map((el) => (el as HTMLElement).dataset.blockFrom ?? ""),
  );
}

async function moveBelowUnionOverText(page: Page) {
  const pt = await page.evaluate(() => {
    const layers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="block-menu"], [data-block-flyout], .mdb-slash-menu',
      ),
    );
    const bottom = Math.max(
      ...layers.map((el) => el.getBoundingClientRect().bottom),
    );
    const line = Array.from(
      document.querySelectorAll<HTMLElement>(".cm-line"),
    ).find((el) => el.getBoundingClientRect().top > bottom);
    if (!line) return null;
    const r = line.getBoundingClientRect();
    const content = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return {
      x: Math.max(r.left, content.left + content.width * 0.1),
      y: r.top + r.height / 2,
    };
  });
  if (!pt) throw new Error("并集下方没有可探针的正文行");
  await page.mouse.move(pt.x, pt.y);
  return pt;
}

async function moveOutOfSummonZone(page: Page) {
  const pt = await page.evaluate(() => {
    const content = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { x: content.right - 20, y: content.top + 40 };
  });
  await page.mouse.move(pt.x, pt.y);
}

async function moveIntoSlashSubmenu(page: Page) {
  const box = (await page.locator(".mdb-slash-menu").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
}

async function parentMenuPoint(page: Page) {
  const box = (await page.locator('[data-testid="block-menu"]').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + 12 };
}

test("A-1.1 对齐与缩进二级菜单移出并集后消失", async ({ page }) => {
  await boot(page);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(1, { timeout: 3000 });
  await shot(page, "submenu-open");

  await moveBelowUnionOverText(page);

  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0, {
    timeout: 2000,
  });
  await shot(page, "pointer-out-menu-gone");
});

test("A-1.1 在下方添加二级菜单移出并集后消失", async ({ page }) => {
  await boot(page);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-add-below"]').hover();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1, {
    timeout: 3000,
  });

  await moveBelowUnionOverText(page);

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0, {
    timeout: 2000,
  });
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0, {
    timeout: 2000,
  });
});

test("A-1.3 二级菜单在并集内来回保持显示", async ({ page }) => {
  await boot(page);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-align"]').hover();
  const panel = page.locator('[data-testid="block-menu-align-panel"]');
  await expect(panel).toHaveCount(1, { timeout: 3000 });

  const flyout = (await panel.boundingBox())!;
  await page.mouse.move(flyout.x + flyout.width / 2, flyout.y + 20);
  const parentPt = await parentMenuPoint(page);
  await page.mouse.move(parentPt.x, parentPt.y);
  await expect(panel).toHaveCount(1);
});

test("A-1.1/A-1.3 从「在下方添加」面板内部移出并集后整栈消失且恢复召唤", async ({
  page,
}) => {
  await boot(page);
  await hoverHandle(page, 0);
  const originalFrom = (await visibleHandleFroms(page))[0];
  await page.locator('[data-testid="block-menu-add-below"]').hover();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1, {
    timeout: 3000,
  });
  await moveIntoSlashSubmenu(page);

  const probe = await moveBelowUnionOverText(page);
  await page.waitForTimeout(500);

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  expect(await visibleHandleFroms(page)).toEqual([originalFrom]);

  await moveOutOfSummonZone(page);
  await page.waitForTimeout(250);
  await page.mouse.move(probe.x, probe.y);
  await page.waitForTimeout(500);

  const froms = await visibleHandleFroms(page);
  expect(froms).toHaveLength(1);
  expect(froms[0]).not.toBe(originalFrom);
});

test("A-1.2/A-1.3 菜单栈开启期间下层文字不召唤手柄，关闭后恢复", async ({
  page,
}) => {
  await boot(page);
  await hoverHandle(page, 0);
  const originalFrom = (await visibleHandleFroms(page))[0];
  await page.locator('[data-testid="block-menu-align"]').hover();
  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(1, { timeout: 3000 });

  const probe = await moveBelowUnionOverText(page);
  await page.waitForTimeout(500);

  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(0);
  expect(await visibleHandleFroms(page)).toEqual([originalFrom]);

  await moveOutOfSummonZone(page);
  await page.waitForTimeout(250);
  await page.mouse.move(probe.x, probe.y);
  await page.waitForTimeout(500);

  const froms = await visibleHandleFroms(page);
  expect(froms).toHaveLength(1);
  expect(froms[0]).not.toBe(originalFrom);
  await shot(page, "closed-handle-resumed");
});

test("A-1.2 新增「+」菜单开启期间下层文字不召唤手柄，关闭后恢复", async ({
  page,
}) => {
  await boot(page);
  const add = page.locator(".cm-block-handle-add").first();
  await openAddHandleMenu(page, add);
  await shot(page, "stack-open-no-summon");
  const originalFrom = (await visibleHandleFroms(page))[0];

  const probe = await moveBelowUnionOverText(page);
  await page.waitForTimeout(500);

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  expect(await visibleHandleFroms(page)).toEqual([originalFrom]);

  await moveOutOfSummonZone(page);
  await page.waitForTimeout(250);
  await page.mouse.move(probe.x, probe.y);
  await page.waitForTimeout(500);

  const froms = await visibleHandleFroms(page);
  expect(froms).toHaveLength(1);
  expect(froms[0]).not.toBe(originalFrom);
});

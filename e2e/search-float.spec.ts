import { test, expect, type Page } from "@playwright/test";

/**
 * 搜索浮窗首通与形态（#981 / S-1、S-2）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js：`__biaoyue_openFile__` 注入文档，
 * `__biaoyue_store__` 切模式。断言落到计算样式、几何位置与命中计数，
 * 不停留在「元素存在」。
 */

const APP_URL = "http://localhost:1420";

const DOC = `# 属性面板

这是属性面板的正文。

## 第二段

属性面板可以配置。
`;

const LONG_DOC = Array.from(
  { length: 21 },
  (_, i) => `第 ${i + 1} 段命中`,
).join("\n\n");

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(
  page: Page,
  content = DOC,
  path = "/Users/test/search.md",
): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, "search.md");
    },
    { path, content },
  );
}

async function sceneOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    return (
      window as unknown as {
        __biaoyue_store__: { getState: () => { scene: string } };
      }
    ).__biaoyue_store__.getState().scene;
  });
}

async function setMode(page: Page, mode: "preview" | "edit" | "source") {
  await page.evaluate((m) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setEditorMode: (m: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setEditorMode(m as "preview" | "edit" | "source");
  }, mode);
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

async function closeSettings(page: Page): Promise<void> {
  await page.locator('[aria-label="关闭设置"]').click();
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
}

async function contentBox(page: Page) {
  const box = await page.locator(".content-scroll").first().boundingBox();
  if (!box) throw new Error("content-scroll 未布局");
  return box;
}

function near(a: number, b: number, tolerance = 2): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function dragBy(
  page: Page,
  testId: string,
  dx: number,
  dy: number,
): Promise<void> {
  const handle = page.locator(`[data-testid="${testId}"]`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`${testId} 未布局`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 6 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await boot(page);
  await openDoc(page);
  await setMode(page, "edit");
});

test("⌘F 打开浮窗：600×460，Esc 关闭无残留、再按重开，内置搜索面板不出现", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const box = await float.boundingBox();
  if (!box) throw new Error("浮窗未布局");
  expect(near(box.width, 600, 1)).toBe(true);
  expect(near(box.height, 460, 1)).toBe(true);

  await expect(page.locator(".cm-panels")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();

  await page.keyboard.press("Meta+f");
  await expect(float).toBeVisible();
});

test("输入中文关键词即时显示命中计数与结果行", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const input = page.locator('[data-testid="search-float-input"]');
  await expect(input).toBeFocused();

  await input.fill("属性");
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "3 处",
  );
  await expect(page.locator('[data-testid="search-float-hit"]')).toHaveCount(3);
  await expect(
    page.locator('[data-testid="search-float-hit"]').first(),
  ).toContainText("L1 · 标题");
});

test("预览态：⌘F 搜索可用，且本票无替换行", async ({ page }) => {
  await setMode(page, "preview");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "3 处",
  );
  await expect(float.locator("input")).toHaveCount(1);
});

test("设置默认位置为右侧后 ⌘F 停靠窗格右侧", async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-settings-nav="editor"]').click();
  await page.locator('[data-testid="search-panel-pos-right"]').click();
  await closeSettings(page);

  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const box = await float.boundingBox();
  const content = await contentBox(page);
  if (!box) throw new Error("浮窗未布局");
  expect(near(box.x + box.width, content.x + content.width - 24, 2)).toBe(true);
});

test("拖拽手柄移动后，关闭再开保持在拖后位置", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const before = await float.boundingBox();
  if (!before) throw new Error("浮窗未布局");
  await dragBy(page, "search-float-handle", 90, 60);
  const after = await float.boundingBox();
  if (!after) throw new Error("浮窗未布局");
  expect(!near(after.x, before.x, 2)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
  await page.keyboard.press("Meta+f");
  await expect(float).toBeVisible();

  const reopened = await float.boundingBox();
  if (!reopened) throw new Error("浮窗未布局");
  expect(near(reopened.x, after.x, 2)).toBe(true);
  expect(near(reopened.y, after.y, 2)).toBe(true);
});

test("右下角缩放手柄调整尺寸，会话内记忆", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  await dragBy(page, "search-float-resize", 60, 40);
  const resized = await float.boundingBox();
  if (!resized) throw new Error("浮窗未布局");
  expect(resized.width).toBeGreaterThan(600);
  expect(resized.height).toBeGreaterThan(460);

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
  await page.keyboard.press("Meta+f");
  await expect(float).toBeVisible();

  const reopened = await float.boundingBox();
  if (!reopened) throw new Error("浮窗未布局");
  expect(near(reopened.width, resized.width, 2)).toBe(true);
  expect(near(reopened.height, resized.height, 2)).toBe(true);
});

test("双行结果：定位行 + 序位 1/N + 两行上下文高亮", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(3);
  const first = rows.nth(0);
  await expect(first.locator(".search-float-loc")).toHaveText("L1 · 标题");
  await expect(first.locator(".search-float-idx")).toHaveText("1/3");
  await expect(first.locator(".search-float-context")).toContainText("属性");
  await expect(first.locator(".search-float-context mark").first()).toHaveText(
    "属性",
  );
  await expect(first.locator(".search-float-key")).toHaveText("⏎");
});

test("命中分布条：点击第 3 刻度跳转第 3 处", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const ticks = page.locator('[data-testid="search-float-dist-tick"]');
  await expect(ticks).toHaveCount(3);
  await ticks.nth(2).click();

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows.nth(2).locator(".search-float-key")).toHaveText("⏎");
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expect(ticks.nth(2)).toHaveClass(/cur/);
});

test("↓↓ 换选：第 3 行 ⏎，第 1/2 行 ⌘1/⌘2", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");
  await expect(rows.nth(2).locator(".search-float-key")).toHaveText("⏎");
});

test("Enter 定位选中行：编辑器出现选区", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");

  await page.keyboard.press("Enter");
  await expect(
    page.locator(".cm-selectionBackground").first(),
  ).toBeVisible();
});

test("⌘2 直达第 2 项，不触发全局卡片直开", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  await page.keyboard.press("Meta+2");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⏎");
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  expect(await sceneOf(page)).toBe("workspace");
});

test("关闭浮窗后 ⌘2 归还全局：无局部响应且工作区不变", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="search-float"]')).toBeHidden();

  await page.keyboard.press("Meta+2");
  await expect(page.locator('[data-testid="search-float"]')).toBeHidden();
  expect(await sceneOf(page)).toBe("workspace");
});

test("21 处命中滚动后前 9 行快捷键不变", async ({ page }) => {
  await openDoc(page, LONG_DOC, "/Users/test/long.md");
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("命中");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(21);
  await expect(
    page.locator('[data-testid="search-float-dist-tick"]'),
  ).toHaveCount(21);

  await page.keyboard.press("Meta+9");
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(9).locator(".search-float-key")).toHaveText("⏎");

  const results = page.locator('[data-testid="search-float-results"]');
  await results.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  for (let i = 0; i < 9; i++) {
    await expect(rows.nth(i).locator(".search-float-key")).toHaveText(
      `⌘${i + 1}`,
    );
  }
  await expect(rows.nth(9).locator(".search-float-key")).toHaveText("⏎");
  await expect(rows.nth(10).locator(".search-float-key")).toHaveText("");
});

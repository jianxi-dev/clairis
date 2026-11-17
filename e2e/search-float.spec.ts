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

async function editorText(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector(".cm-content")?.textContent ?? "",
  );
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

test("浮窗壳计算样式与悬浮预览窗一致：surface 底、1px 描边、8px 圆角、投影", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const shell = await float.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      borderWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      radius: cs.borderTopLeftRadius,
      shadow: cs.boxShadow,
    };
  });
  expect(shell.borderWidth).toBe("1px");
  expect(shell.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(shell.radius).toBe("8px");
  expect(shell.shadow).not.toBe("none");
  expect(shell.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
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

test("8 向缩放：四边与四角拖拽改变尺寸并钳到最小 320×240，会话内记忆", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const before = await float.boundingBox();
  if (!before) throw new Error("浮窗未布局");

  // 边：东边向右拖 → 变宽，高度不变
  await dragBy(page, "search-float-resize-e", 60, 0);
  const afterEdge = await float.boundingBox();
  if (!afterEdge) throw new Error("浮窗未布局");
  expect(afterEdge.width).toBeGreaterThan(before.width);
  expect(near(afterEdge.height, before.height, 2)).toBe(true);

  // 角：东南角向右下拖 → 更宽更高
  await dragBy(page, "search-float-resize-se", 40, 30);
  const afterCorner = await float.boundingBox();
  if (!afterCorner) throw new Error("浮窗未布局");
  expect(afterCorner.width).toBeGreaterThan(afterEdge.width);
  expect(afterCorner.height).toBeGreaterThan(afterEdge.height);

  // 边：北边向上拖 → 变高，宽度不变
  await dragBy(page, "search-float-resize-n", 0, -40);
  const afterNorth = await float.boundingBox();
  if (!afterNorth) throw new Error("浮窗未布局");
  expect(afterNorth.height).toBeGreaterThan(afterCorner.height);
  expect(near(afterNorth.width, afterCorner.width, 2)).toBe(true);

  // 边：南边向下拖 → 变高
  await dragBy(page, "search-float-resize-s", 0, 40);
  const afterSouth = await float.boundingBox();
  if (!afterSouth) throw new Error("浮窗未布局");
  expect(afterSouth.height).toBeGreaterThan(afterNorth.height);

  // 边：西边向左拖 → 变宽，高度不变
  await dragBy(page, "search-float-resize-w", -60, 0);
  const afterWest = await float.boundingBox();
  if (!afterWest) throw new Error("浮窗未布局");
  expect(afterWest.width).toBeGreaterThan(afterSouth.width);
  expect(near(afterWest.height, afterSouth.height, 2)).toBe(true);

  // 旧单一手柄的 testid 不应残留（精确匹配，无后缀）
  await expect(page.locator('[data-testid="search-float-resize"]')).toHaveCount(
    0,
  );

  // 最小钳制：西北角向内拖到底 → 严格 320×240
  await dragBy(page, "search-float-resize-nw", 2000, 2000);
  const clamped = await float.boundingBox();
  if (!clamped) throw new Error("浮窗未布局");
  expect(near(clamped.width, 320, 1)).toBe(true);
  expect(near(clamped.height, 240, 1)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
  await page.keyboard.press("Meta+f");
  await expect(float).toBeVisible();

  const reopened = await float.boundingBox();
  if (!reopened) throw new Error("浮窗未布局");
  expect(near(reopened.width, clamped.width, 1)).toBe(true);
  expect(near(reopened.height, clamped.height, 1)).toBe(true);
});

test("南边拖出窗格底部不跳变：北边锚死、南边贴底、不瞬移到顶部", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const host = await float.evaluate((el) => {
    const r = (el.offsetParent as HTMLElement).getBoundingClientRect();
    return { bottom: r.bottom };
  });

  // 先拖标题手柄把浮窗移到窗格下半部（距底 20px）
  const before = await float.boundingBox();
  if (!before) throw new Error("浮窗未布局");
  const dy = host.bottom - 20 - before.height - before.y;
  await dragBy(page, "search-float-handle", 0, dy);
  const moved = await float.boundingBox();
  if (!moved) throw new Error("浮窗未布局");
  expect(moved.y).toBeGreaterThan(before.y);

  // 南边手柄向下拖 1000px，远超窗格底部
  await dragBy(page, "search-float-resize-s", 0, 1000);
  const after = await float.boundingBox();
  if (!after) throw new Error("浮窗未布局");

  expect(near(after.y, moved.y, 2)).toBe(true);
  expect(near(after.y + after.height, host.bottom, 2)).toBe(true);
  expect(after.y).toBeGreaterThan(0);
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
  await expect(page.locator(".cm-selectionBackground").first()).toBeVisible();
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

test("⇄ 展开替换行（替换输入框 + 逐个/全部替换），再点收起", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float.locator("input")).toHaveCount(1);

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await expect(
    page.locator('[data-testid="search-float-replace-row"]'),
  ).toBeVisible();
  await expect(float.locator("input")).toHaveCount(2);
  await expect(
    page.locator('[data-testid="search-float-replace-one"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="search-float-replace-all"]'),
  ).toBeVisible();

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await expect(
    page.locator('[data-testid="search-float-replace-row"]'),
  ).toHaveCount(0);
  await expect(float.locator("input")).toHaveCount(1);
});

test("替换模式结果行内联 diff：原词删除线、新词强调色；普通搜索无 diff", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await page.locator('[data-testid="search-float-replace-input"]').fill("特性");

  const row = page.locator('[data-testid="search-float-hit"]').first();
  const del = row.locator('[data-testid="search-float-diff"] del');
  const ins = row.locator('[data-testid="search-float-diff"] ins');
  await expect(del).toHaveText("属性");
  await expect(ins).toHaveText("特性");
  expect(
    await del.evaluate((el) => getComputedStyle(el).textDecorationLine),
  ).toContain("line-through");
  const accent = await row
    .locator(".search-float-loc")
    .evaluate((el) => getComputedStyle(el).color);
  expect(await ins.evaluate((el) => getComputedStyle(el).color)).toBe(accent);

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await expect(page.locator('[data-testid="search-float-diff"]')).toHaveCount(
    0,
  );
});

test("逐个替换当前命中后自动前进到下一处，文档文本变化", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await page.locator('[data-testid="search-float-replace-input"]').fill("特性");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows.nth(0).locator(".search-float-loc")).toHaveText(
    "L1 · 标题",
  );
  await page.locator('[data-testid="search-float-replace-one"]').click();

  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "2 处",
  );
  await expect(rows.nth(0).locator(".search-float-loc")).toHaveText(
    "L3 · 段落",
  );
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⏎");

  await setMode(page, "source");
  const text = await editorText(page);
  expect(text).toContain("特性面板");
  expect(text).not.toContain("# 属性面板");
});

test("全部替换一次事务完成并计数，Ctrl+Z 一次全部还原", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await page.locator('[data-testid="search-float-replace-input"]').fill("特性");

  await page.locator('[data-testid="search-float-replace-all"]').click();
  await expect(page.locator('[data-testid="search-float-status"]')).toHaveText(
    "已替换 3 处",
  );
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "0 处",
  );

  await setMode(page, "source");
  expect(await editorText(page)).not.toContain("属性");

  await page.keyboard.press("Meta+z");
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "3 处",
  );
  expect(await editorText(page)).toContain("属性面板");
});

test("替换模式悬停结果行弹全文预览卡，普通搜索不弹", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const row = page.locator('[data-testid="search-float-hit"]').first();
  await row.hover();
  await expect(
    page.locator('[data-testid="search-float-hover-card"]'),
  ).toHaveCount(0);

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await page.locator('[data-testid="search-float-replace-input"]').fill("特性");
  await row.hover();

  const card = page.locator('[data-testid="search-float-hover-card"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("L1 · 标题");
  await expect(card).toContainText("# 属性面板");

  const cardBox = await card.boundingBox();
  const paneBox = await contentBox(page);
  if (!cardBox) throw new Error("预览卡未布局");
  expect(cardBox.x).toBeGreaterThanOrEqual(paneBox.x - 1);
  expect(cardBox.y).toBeGreaterThanOrEqual(paneBox.y - 1);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
    paneBox.x + paneBox.width + 1,
  );
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(
    paneBox.y + paneBox.height + 1,
  );

  await page.locator('[data-testid="search-float-input"]').hover();
  await expect(card).toHaveCount(0);
});

test("预览态 ⌘F：无替换切换按钮、无替换行", async ({ page }) => {
  await setMode(page, "preview");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  await expect(
    page.locator('[data-testid="search-float-replace-toggle"]'),
  ).toHaveCount(0);
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await expect(float.locator("input")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="search-float-replace-row"]'),
  ).toHaveCount(0);
});

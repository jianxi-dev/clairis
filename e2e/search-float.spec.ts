import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

const RICH_DOC = ["# 标题", "", "前缀 **加粗命中** 与 `代码命中` 后缀"].join(
  "\n",
);

const DOC_A = [
  "# 文档甲",
  "",
  ...Array.from({ length: 40 }, (_, i) => `甲第 ${i + 1} 行填充`),
].join("\n");

const DOC_B = [
  "# 文档乙",
  "",
  ...Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 行填充`),
  "",
  "目标命中第一处",
  "",
  "目标命中第二处",
].join("\n");

async function paneIds(page: Page): Promise<{ main: string; split: string }> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            paneRoot: { type: string; id: string; children?: unknown[] };
            focusedPaneId: string;
          };
        };
      }
    ).__biaoyue_store__;
    const ids: string[] = [];
    const walk = (node: { type: string; id: string; children?: unknown[] }) => {
      if (node.type === "leaf") ids.push(node.id);
      else (node.children ?? []).forEach((child) => walk(child as never));
    };
    walk(store.getState().paneRoot);
    return { main: ids[0], split: store.getState().focusedPaneId };
  });
}

async function paneProbe(page: Page, paneId: string) {
  return page.evaluate((pid) => {
    const el = document.querySelector(`[data-pane-id="${pid}"]`);
    if (!el) return null;
    const scroller = el.querySelector<HTMLElement>(".cm-scroller");
    return {
      selections: el.querySelectorAll(".cm-selectionBackground").length,
      scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
    };
  }, paneId);
}

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

test("⌘F 打开浮窗：300×460，Esc 关闭无残留、再按重开，内置搜索面板不出现", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const box = await float.boundingBox();
  if (!box) throw new Error("浮窗未布局");
  expect(near(box.width, 300, 1)).toBe(true);
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

test("8 向缩放：四边与四角拖拽改变尺寸并钳到最小 280×240，会话内记忆", async ({
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

  // 最小钳制：西北角向内拖到底 → 严格 280×240
  await dragBy(page, "search-float-resize-nw", 2000, 2000);
  const clamped = await float.boundingBox();
  if (!clamped) throw new Error("浮窗未布局");
  expect(near(clamped.width, 280, 1)).toBe(true);
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
  expect(
    await first.locator(".search-float-context").textContent(),
  ).not.toContain("#");
  await expectEnterBadge(first.locator(".search-float-key"));
});

test("命中分布条：点击第 3 刻度跳转第 3 处", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const ticks = page.locator('[data-testid="search-float-dist-tick"]');
  await expect(ticks).toHaveCount(3);
  await ticks.nth(2).click();

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expectEnterBadge(rows.nth(2).locator(".search-float-key"));
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expect(ticks.nth(2)).toHaveClass(/cur/);
});

test("↓↓ 换选：第 3 行 回车，第 1/2 行 ⌘1/⌘2", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");
  await expectEnterBadge(rows.nth(2).locator(".search-float-key"));
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
  await expectEnterBadge(rows.nth(1).locator(".search-float-key"));
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
  await expectEnterBadge(rows.nth(9).locator(".search-float-key"));

  const results = page.locator('[data-testid="search-float-results"]');
  await results.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  for (let i = 0; i < 9; i++) {
    await expect(rows.nth(i).locator(".search-float-key")).toHaveText(
      `⌘${i + 1}`,
    );
  }
  await expectEnterBadge(rows.nth(9).locator(".search-float-key"));
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
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));

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
  await expect(card).toContainText("属性面板");
  expect((await card.textContent()) ?? "").not.toContain("#");

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

test("分栏：B 格浮窗点击行定位到 B 格、A 格不动；⌘N 直达后 回车 跟随并定位", async ({
  page,
}) => {
  await openDoc(page, DOC_A, "/Users/test/a.md");
  await setMode(page, "edit");

  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { splitPane: (d: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .splitPane("row");
  });
  await openDoc(page, DOC_B, "/Users/test/b.md");

  const { main, split } = await paneIds(page);
  expect(main).toBe("main");
  await page.evaluate((id) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            setPaneEditorMode: (id: string, m: string) => void;
          };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setPaneEditorMode(id, "edit");
  }, split);

  await page.locator('[data-pane-id="main"] .cm-content').click();
  await page.evaluate((id) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { focusPane: (id: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .focusPane(id);
  }, split);
  await page.keyboard.press("Meta+f");
  const float = page.locator(
    `[data-pane-id="${split}"] [data-testid="search-float"]`,
  );
  await expect(float).toBeVisible();

  await float.locator('[data-testid="search-float-input"]').fill("目标命中");
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(2);
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");

  await rows.nth(1).click();

  await expect
    .poll(async () => {
      const b = await paneProbe(page, split);
      return (b?.selections ?? 0) > 0 && (b?.scrollTop ?? 0) > 0;
    })
    .toBe(true);
  const bAfterClick = await paneProbe(page, split);
  const aAfterClick = await paneProbe(page, main);
  expect(bAfterClick?.selections ?? 0).toBeGreaterThan(0);
  expect(aAfterClick?.selections ?? 0).toBe(0);
  expect(bAfterClick?.scrollTop ?? 0).toBeGreaterThan(0);
  expect(aAfterClick?.scrollTop ?? 0).toBe(0);

  await float.locator('[data-testid="search-float-input"]').click();
  await page.keyboard.press("Meta+1");
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");

  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await paneProbe(page, split))?.selections ?? 0)
    .toBeGreaterThan(0);
  const bAfterEnter = await paneProbe(page, split);
  const aAfterEnter = await paneProbe(page, main);
  expect(bAfterEnter?.selections ?? 0).toBeGreaterThan(0);
  expect(aAfterEnter?.selections ?? 0).toBe(0);
});

test("状态栏：打开即显示快捷键说明，离开失焦约 2 秒隐藏，悬停恢复", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveText("↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达 · Esc 关闭");

  // 先进入浮窗，确保移出时 pointerleave 真实发生（否则只测到失焦路径）。
  await float.hover();
  await page.mouse.move(2, 2);
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await expect
    .poll(async () => bar.evaluate((el) => getComputedStyle(el).visibility), {
      timeout: 5000,
    })
    .toBe("hidden");

  await float.hover();
  await expect
    .poll(async () => bar.evaluate((el) => getComputedStyle(el).visibility), {
      timeout: 5000,
    })
    .toBe("visible");
});

test("结果行预览态渲染：加粗/行内代码语义标签，源码符号不出现，命中 mark 包裹", async ({
  page,
}) => {
  await openDoc(page, RICH_DOC, "/Users/test/rich.md");
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("加粗命中");

  const row = page.locator('[data-testid="search-float-hit"]').first();
  const context = row.locator(".search-float-context");
  await expect(context.locator("b mark")).toHaveText("加粗命中");
  await expect(context.locator("code")).toHaveText("代码命中");
  expect(
    await context
      .locator("code")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");

  const text = (await context.textContent()) ?? "";
  expect(text).not.toContain("**");
  expect(text).not.toContain("`");
  expect(text).not.toContain("#");
});

test("结果行命中在行内代码内部时 mark 包裹命中子串", async ({ page }) => {
  await openDoc(page, RICH_DOC, "/Users/test/rich.md");
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("代码命中");

  const row = page.locator('[data-testid="search-float-hit"]').first();
  await expect(row.locator(".search-float-context code mark")).toHaveText(
    "代码命中",
  );
});

/* ------------------------------------------------------------------ *
 * #1056 结果行与悬浮预览预览态渲染（A-18.1 / A-18.2）
 * ------------------------------------------------------------------ */

const ART_1056 = path.resolve(process.cwd(), ".artifacts/1056");

async function recordState1056(page: Page, state: string): Promise<void> {
  mkdirSync(ART_1056, { recursive: true });
  const file = path.join(ART_1056, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART_1056, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1056-search-preview-render", states }, null, 2)}\n`,
  );
}

// 整份文档必须是一个块（无空行），悬浮预览按整块渲染才能一次覆盖全部标记类型。
const PREVIEW_DOC = [
  "## 二级命中标题",
  "---",
  "```ts",
  "const 代码命中 = 1;",
  "```",
  "正文 **加粗命中** 与 `行内命中` 后缀",
].join("\n");

interface MarkerCounts {
  hash: number;
  dash: number;
  fence: number;
}

function countMarkers(text: string): MarkerCounts {
  return {
    hash: (text.match(/##/g) ?? []).length,
    dash: (text.match(/---/g) ?? []).length,
    fence: (text.match(/```/g) ?? []).length,
  };
}

test("#1056 结果行与悬浮预览预览态渲染：零源码标记、保留 mark、行内语义（A-18.1/2）", async ({
  page,
}) => {
  await openDoc(page, PREVIEW_DOC, "/Users/test/preview.md");
  await setMode(page, "edit");
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("命中");
  await page.locator('[data-testid="search-float-replace-toggle"]').click();

  const float = page.locator('[data-testid="search-float"]');
  const results = float.locator('[data-testid="search-float-results"]');
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(4);

  // 01 结果区：## / --- / 围栏为零，mark 保留，无块级标题
  const resultText = (await results.textContent()) ?? "";
  const resultMarkers = countMarkers(resultText);
  expect(resultMarkers.hash).toBe(0);
  expect(resultMarkers.dash).toBe(0);
  expect(resultMarkers.fence).toBe(0);
  expect(await results.locator("mark").count()).toBeGreaterThanOrEqual(1);
  expect(await results.locator("h1,h2,h3,h4,h5,h6").count()).toBe(0);
  await recordState1056(page, "01-row-rendered");

  // 02 悬浮预览体：与结果行共用同一渲染契约
  const row = rows.first();
  await row.hover();
  const card = page.locator('[data-testid="search-float-hover-card"]');
  await expect(card).toBeVisible();
  const body = card.locator(".search-float-hover-body");
  const bodyText = (await body.textContent()) ?? "";
  const bodyMarkers = countMarkers(bodyText);
  expect(bodyMarkers.hash).toBe(0);
  expect(bodyMarkers.dash).toBe(0);
  expect(bodyMarkers.fence).toBe(0);
  expect(await body.locator("mark").count()).toBeGreaterThanOrEqual(1);
  expect(await body.locator("h1,h2,h3,h4,h5,h6").count()).toBe(0);
  await recordState1056(page, "02-hover-rendered");

  // 03 行内语义：加粗 / 行内代码为语义标签，代码带预览态样式
  await expect(body.locator("b")).toHaveText("加粗命中");
  await expect(body.locator("code")).toHaveText("行内命中");
  const codeStyle = await body.locator("code").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      borderTopWidth: cs.borderTopWidth,
      fontFamily: cs.fontFamily,
    };
  });
  expect(codeStyle.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(codeStyle.borderRadius).toBe("4px");
  expect(codeStyle.borderTopWidth).toBe("1px");
  expect(codeStyle.fontFamily).toContain("mono");

  // 悬浮命中落在加粗 / 行内代码内时，mark 包裹命中子串
  await rows.nth(2).hover();
  await expect(body.locator("b mark")).toHaveText("命中");
  await rows.nth(3).hover();
  await expect(body.locator("code mark")).toHaveText("命中");
  await recordState1056(page, "03-no-source-markers");

  // 04 点击命中仍定位；关闭浮窗后无残留预览文本
  await row.click();
  await expect
    .poll(async () => page.locator(".cm-selectionBackground").count())
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
  expect(await page.locator(".search-float-hover-body").count()).toBe(0);
  expect(await editorText(page)).toContain("## 二级命中标题");
  await recordState1056(page, "04-hit-mark-present");
});

/* ------------------------------------------------------------------ *
 * #1056 补漏：链接 / 图片 / 删除线 / 任务列表 / 表格（真实搜索流）
 * 旧覆盖只测了 ## / --- / 围栏 / 加粗 / 行内代码，构造缺口在此补齐。
 * ------------------------------------------------------------------ */

test("#1056 链接与图片：结果行与悬浮预览均无源码括号，语义标签 + 命中保留", async ({
  page,
}) => {
  await openDoc(
    page,
    "前缀 [命中的链接](https://example.com) 与 ![命中的图片](a.png) 后缀",
    "/Users/test/link.md",
  );
  await setMode(page, "edit");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await page.locator('[data-testid="search-float-input"]').fill("命中");

  const ctx = float
    .locator('[data-testid="search-float-hit"]')
    .first()
    .locator(".search-float-context");
  await expect(ctx.locator(".sf-link")).toHaveText("命中的链接");
  await expect(ctx.locator(".sf-media")).toHaveText("命中的图片");
  await expect(ctx.locator(".sf-link mark")).toHaveText("命中");
  const rowText = (await ctx.textContent()) ?? "";
  expect(rowText).not.toContain("[");
  expect(rowText).not.toContain("](");
  expect(rowText).not.toContain("!");

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await float.locator('[data-testid="search-float-hit"]').first().hover();
  const body = page.locator(".search-float-hover-body");
  await expect(body.locator(".sf-link")).toHaveText("命中的链接");
  await expect(body.locator(".sf-media")).toHaveText("命中的图片");
  const hoverText = (await body.textContent()) ?? "";
  expect(hoverText).not.toContain("[");
  expect(hoverText).not.toContain("](");
});

test("#1056 删除线与任务列表：结果行与悬浮预览均无 ~~ 与 [ ] 源码符号", async ({
  page,
}) => {
  await openDoc(
    page,
    "前缀 ~~命中的删除~~ 后缀\n\n- [ ] 命中的任务",
    "/Users/test/inline.md",
  );
  await setMode(page, "edit");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await page.locator('[data-testid="search-float-input"]').fill("命中");
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(2);

  const strikeCtx = rows.nth(0).locator(".search-float-context");
  await expect(strikeCtx.locator("del")).toHaveText("命中的删除");
  await expect(strikeCtx.locator("del mark")).toHaveText("命中");
  expect((await strikeCtx.textContent()) ?? "").not.toContain("~~");

  const taskCtx = rows.nth(1).locator(".search-float-context");
  await expect(taskCtx.locator(".sf-check")).toHaveCount(1);
  expect((await taskCtx.textContent()) ?? "").not.toContain("[");
  expect((await taskCtx.textContent()) ?? "").not.toContain("]");

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await rows.nth(0).hover();
  const body = page.locator(".search-float-hover-body");
  await expect(body.locator("del")).toHaveText("命中的删除");
  expect((await body.textContent()) ?? "").not.toContain("~~");

  await rows.nth(1).hover();
  await expect(body.locator(".sf-check")).toHaveCount(1);
  expect((await body.textContent()) ?? "").not.toContain("[ ]");
});

test("#1056 表格：结果行与悬浮预览渲染为表格，竖线与对齐行不出现", async ({
  page,
}) => {
  await openDoc(
    page,
    ["| 列A | 列B |", "| --- | --- |", "| 命中的单元格 | 值 |"].join("\n"),
    "/Users/test/table.md",
  );
  await setMode(page, "edit");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await page.locator('[data-testid="search-float-input"]').fill("命中");

  const ctx = float
    .locator('[data-testid="search-float-hit"]')
    .first()
    .locator(".search-float-context");
  await expect(ctx.locator("table")).toHaveCount(1);
  await expect(ctx.locator("th")).toHaveCount(2);
  await expect(ctx.locator("td mark")).toHaveText("命中");
  const rowText = (await ctx.textContent()) ?? "";
  expect(rowText).not.toContain("|");
  expect(rowText).not.toContain("---");

  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await float.locator('[data-testid="search-float-hit"]').first().hover();
  const body = page.locator(".search-float-hover-body");
  await expect(body.locator("table")).toHaveCount(1);
  await expect(body.locator("th")).toHaveCount(2);
  await expect(body.locator("td mark")).toHaveText("命中");
  const hoverText = (await body.textContent()) ?? "";
  expect(hoverText).not.toContain("|");
  expect(hoverText).not.toContain("---");
});

/* ------------------------------------------------------------------ *
 * #1054 外框/顶栏/状态栏同构 + 缩放贴底（A-16.1 / A-16.2 / A-16.3）
 * ------------------------------------------------------------------ */

const ART_1054 = path.resolve(process.cwd(), ".artifacts/1054");

async function recordState1054(page: Page, state: string): Promise<void> {
  mkdirSync(ART_1054, { recursive: true });
  const file = path.join(ART_1054, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART_1054, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1054-search-float-chrome", states }, null, 2)}\n`,
  );
}

async function openRailPreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t?: string) => void;
      __biaoyue_store__: {
        getState: () => { setRailDensity: (d: string) => void };
      };
    };
    w.__biaoyue_openFile__(
      "/tmp/fp/par.md",
      "# 参照文档\n\n正文用于悬浮预览参照。",
      "参照",
    );
    w.__biaoyue_store__.getState().setRailDensity("compact");
  });
  const edge = page.locator('[data-testid="rail-edge"]');
  if (await edge.isVisible().catch(() => false)) await edge.hover();
  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toBeVisible();
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(panel).toHaveAttribute("data-rail-state", "pinned");

  const row = page
    .locator('[data-section="recent"] [data-testid="rail-item"]')
    .first();
  const b = await row.boundingBox();
  if (!b) throw new Error("rail row 未布局");
  await page.mouse.move(b.x + b.width - 20, b.y + b.height / 2);
  await expect(page.locator('[data-testid="floating-preview"]')).toBeVisible({
    timeout: 3000,
  });
}

async function statusbarGap(
  page: Page,
): Promise<{ gap: number; barHeight: number; offset: number } | null> {
  return page.locator('[data-testid="search-float"]').evaluate((el) => {
    const barEl = el.querySelector<HTMLElement>(
      '[data-testid="search-float-statusbar"]',
    );
    if (!barEl) return null;
    const fr = el.getBoundingClientRect();
    const br = barEl.getBoundingClientRect();
    const bb = parseFloat(getComputedStyle(el).borderBottomWidth);
    return {
      gap: br.bottom - (fr.bottom - bb),
      barHeight: br.height,
      offset: barEl.offsetHeight,
    };
  });
}

test("外框/顶栏/状态栏与阅读空间文件卡片悬浮窗同构：边框 1px、圆角 8px、分隔条 1px", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  await openRailPreview(page);
  const preview = page.locator('[data-testid="floating-preview"]');

  const shellOf = async (selector: string) => {
    const el = page.locator(selector);
    return {
      borderWidth: await el.evaluate((n) => getComputedStyle(n).borderTopWidth),
      borderColor: await el.evaluate((n) => getComputedStyle(n).borderTopColor),
      radius: await el.evaluate((n) => getComputedStyle(n).borderTopLeftRadius),
      background: await el.evaluate((n) => getComputedStyle(n).backgroundColor),
    };
  };

  const f = await shellOf('[data-testid="search-float"]');
  const p = await shellOf('[data-testid="floating-preview"]');
  expect(f.borderWidth).toBe(p.borderWidth);
  expect(f.borderColor).toBe(p.borderColor);
  expect(f.radius).toBe(p.radius);
  expect(f.background).toBe(p.background);

  const handle = float.locator('[data-testid="search-float-handle"]');
  const titlebar = preview.locator('[data-testid="preview-titlebar"]');
  const handleSep = await handle.evaluate(
    (n) => getComputedStyle(n).borderBottomWidth,
  );
  const titleSep = await titlebar.evaluate(
    (n) => getComputedStyle(n).borderBottomWidth,
  );
  expect(handleSep).toBe(titleSep);

  const bar = page.locator('[data-testid="search-float-statusbar"]');
  const pb = await preview.boundingBox();
  if (!pb) throw new Error("悬浮预览未布局");
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height - 4);
  const actions = preview.locator('[data-testid="preview-actions"]');
  await expect(actions).toBeVisible();
  const barSep = await bar.evaluate((n) => getComputedStyle(n).borderTopWidth);
  const actionsSep = await actions.evaluate(
    (n) => getComputedStyle(n).borderTopWidth,
  );
  expect(barSep).toBe(actionsSep);

  await recordState1054(page, "01-chrome-parity");
});

test("状态栏隐藏后残留占位高度为 0，悬停恢复且仍贴底", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();

  const shown = await statusbarGap(page);
  expect(Math.abs(shown?.gap ?? 999)).toBeLessThanOrEqual(1);
  expect(shown?.barHeight ?? 0).toBeGreaterThan(0);

  await float.hover();
  await page.mouse.move(2, 2);
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await expect
    .poll(async () => bar.evaluate((n) => getComputedStyle(n).visibility), {
      timeout: 5000,
    })
    .toBe("hidden");

  await expect
    .poll(async () => (await statusbarGap(page))?.barHeight ?? -1, {
      timeout: 5000,
    })
    .toBe(0);
  const hidden = await statusbarGap(page);
  // A-16.2：隐藏态占位高度 = 0
  expect(hidden?.offset).toBe(0);
  // A-16.1：隐藏后仍贴住浮窗底边
  expect(Math.abs(hidden?.gap ?? 999)).toBeLessThanOrEqual(1);

  await recordState1054(page, "02-statusbar-hidden-no-space");

  await float.hover();
  await expect
    .poll(async () => (await statusbarGap(page))?.barHeight ?? 0, {
      timeout: 5000,
    })
    .toBeGreaterThan(0);
  const restored = await statusbarGap(page);
  expect(Math.abs(restored?.gap ?? 999)).toBeLessThanOrEqual(1);
});

test("缩放后状态栏贴底：默认 300 与缩小一档间距 0", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  expect(Math.abs((await statusbarGap(page))?.gap ?? 999)).toBeLessThanOrEqual(
    1,
  );

  await dragBy(page, "search-float-resize-s", 0, 60);
  expect(Math.abs((await statusbarGap(page))?.gap ?? 999)).toBeLessThanOrEqual(
    1,
  );

  const box = await float.boundingBox();
  if (!box) throw new Error("浮窗未布局");
  const target = Math.max(280, Math.round(box.width / 2));
  await dragBy(
    page,
    "search-float-resize-e",
    target - Math.round(box.width),
    0,
  );
  const shrunk = await float.boundingBox();
  if (!shrunk) throw new Error("浮窗未布局");
  expect(Math.abs(shrunk.width - target)).toBeLessThanOrEqual(2);
  expect(Math.abs((await statusbarGap(page))?.gap ?? 999)).toBeLessThanOrEqual(
    1,
  );

  await recordState1054(page, "03-resized-bottom-attached");
});

test("窗口缩放后状态栏仍贴底（间距 0）", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const before = await float.boundingBox();
  if (!before) throw new Error("浮窗未布局");

  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(async () => (await float.boundingBox())?.width ?? 0)
    .toBeLessThan(before.width);
  expect(Math.abs((await statusbarGap(page))?.gap ?? 999)).toBeLessThanOrEqual(
    1,
  );

  await recordState1054(page, "04-window-resized-attached");

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect
    .poll(async () => (await float.boundingBox())?.width ?? 0)
    .toBeGreaterThan(290);
  expect(Math.abs((await statusbarGap(page))?.gap ?? 999)).toBeLessThanOrEqual(
    1,
  );
});

/* ------------------------------------------------------------------ *
 * #1055 上下键选择 + 选中行徽标「回车」（A-17.1 / A-17.2 / A-17.3）
 * ------------------------------------------------------------------ */

const ART_1055 = path.resolve(process.cwd(), ".artifacts/1055");

async function recordState1055(page: Page, state: string): Promise<void> {
  mkdirSync(ART_1055, { recursive: true });
  const file = path.join(ART_1055, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART_1055, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1055-search-keyboard-nav", states }, null, 2)}\n`,
  );
}

async function highlightedRowIndex(float: Locator): Promise<number> {
  return float.evaluate((el) => {
    const cur = el.querySelector<HTMLElement>(".search-float-hit-cur");
    return cur ? Number(cur.dataset.index) : -1;
  });
}

async function expectEnterBadge(key: Locator): Promise<void> {
  await expect(key.locator("svg")).toHaveCount(1);
  await expect(key).toHaveAttribute("aria-label", "回车");
  expect((await key.textContent()) ?? "").not.toContain("回车");
}

async function expectVisibleKeysWithinResults(float: Locator): Promise<void> {
  const report = await float
    .locator('[data-testid="search-float-results"]')
    .evaluate((el) => {
      const rr = el.getBoundingClientRect();
      const rows = Array.from(
        el.querySelectorAll<HTMLElement>('[data-testid="search-float-hit"]'),
      )
        .filter((row) => {
          const b = row.getBoundingClientRect();
          return b.top >= rr.top - 1 && b.bottom <= rr.bottom + 1;
        })
        .map((row) => {
          const key = row.querySelector<HTMLElement>(".search-float-key");
          const kb = key?.getBoundingClientRect();
          return {
            idx: Number(row.dataset.index),
            left: kb?.left ?? 0,
            right: kb?.right ?? 0,
            width: kb?.width ?? 0,
          };
        });
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        left: rr.left,
        right: rr.right,
        rows,
      };
    });
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
  expect(report.rows.length).toBeGreaterThan(0);
  for (const row of report.rows) {
    expect(row.width).toBeGreaterThan(0);
    expect(row.left).toBeGreaterThanOrEqual(report.left - 1);
    expect(row.right).toBeLessThanOrEqual(report.right + 1);
  }
}

test("#1055 上下键换选：高亮行移动、徽标为键帽回车图标、回车定位（A-17.1/2/3）", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(3);

  // 01 初始高亮在第 1 行；徽标为键帽回车图标，其余 ⌘2/⌘3
  expect(await highlightedRowIndex(float)).toBe(0);
  await expect(rows.nth(0)).toHaveClass(/search-float-hit-cur/);
  await expect(rows.nth(0)).toHaveAttribute("data-index", "0");
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");
  await expect(rows.nth(2).locator(".search-float-key")).toHaveText("⌘3");
  await recordState1055(page, "01-initial-highlight");

  // 02 ArrowDown：高亮移到第 2 行（读 class + data-index），第 1 行回到 ⌘1
  await page.keyboard.press("ArrowDown");
  expect(await highlightedRowIndex(float)).toBe(1);
  await expect(rows.nth(1)).toHaveClass(/search-float-hit-cur/);
  await expect(rows.nth(1)).toHaveAttribute("data-index", "1");
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expectEnterBadge(rows.nth(1).locator(".search-float-key"));
  await recordState1055(page, "02-arrow-down-second");

  // ArrowUp 回到第 1 行
  await page.keyboard.press("ArrowUp");
  expect(await highlightedRowIndex(float)).toBe(0);
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));

  // 03 连按两次 ArrowDown 到第 3 行，徽标为键帽回车图标
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  expect(await highlightedRowIndex(float)).toBe(2);
  await expect(rows.nth(2)).toHaveClass(/search-float-hit-cur/);
  await expect(rows.nth(2)).toHaveAttribute("data-index", "2");
  await expectEnterBadge(rows.nth(2).locator(".search-float-key"));
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await recordState1055(page, "03-badge-enter");

  // 04 Enter 定位第 3 处：编辑器出现选区
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => page.locator(".cm-selectionBackground").count())
    .toBeGreaterThan(0);
  await recordState1055(page, "04-enter-locates");
});

test("#1055 无命中与换词不留残留高亮", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.keyboard.press("ArrowDown");
  expect(await highlightedRowIndex(float)).toBe(1);

  // 换成无命中的词：无结果行、无高亮
  await page
    .locator('[data-testid="search-float-input"]')
    .fill("不存在的词xyz");
  await expect(float.locator('[data-testid="search-float-hit"]')).toHaveCount(
    0,
  );
  expect(await highlightedRowIndex(float)).toBe(-1);

  // 换回有命中的词：高亮重置回第 1 行，无残留
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await expect(float.locator('[data-testid="search-float-hit"]')).toHaveCount(
    3,
  );
  expect(await highlightedRowIndex(float)).toBe(0);
  await expect(
    float
      .locator('[data-testid="search-float-hit"]')
      .nth(0)
      .locator(".search-float-key"),
  ).toHaveAttribute("aria-label", "回车");
});

test("#1055 悬停结果行等价 ↑↓：高亮与徽标跟随，且不触发定位（A-2.4）", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(3);

  await rows.nth(2).hover();
  expect(await highlightedRowIndex(float)).toBe(2);
  await expectEnterBadge(rows.nth(2).locator(".search-float-key"));
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");
  await expect(rows.nth(1).locator(".search-float-key")).toHaveText("⌘2");
  expect(await page.locator(".cm-selectionBackground").count()).toBe(0);

  await rows.nth(0).hover();
  expect(await highlightedRowIndex(float)).toBe(0);
  await expectEnterBadge(rows.nth(0).locator(".search-float-key"));
});

test("#1055 Enter 定位后焦点留在浮窗，↑↓ 继续换选（A-2.5）", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const input = page.locator('[data-testid="search-float-input"]');
  await expect(float).toBeVisible();
  await input.fill("属性");
  const rows = float.locator('[data-testid="search-float-hit"]');

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  expect(await highlightedRowIndex(float)).toBe(2);

  await page.keyboard.press("Enter");
  await expect
    .poll(async () => page.locator(".cm-selectionBackground").count())
    .toBeGreaterThan(0);
  await expect(input).toBeFocused();

  await page.keyboard.press("ArrowUp");
  expect(await highlightedRowIndex(float)).toBe(1);
  await expectEnterBadge(rows.nth(1).locator(".search-float-key"));

  await page.keyboard.press("ArrowDown");
  expect(await highlightedRowIndex(float)).toBe(2);
  await expectEnterBadge(rows.nth(2).locator(".search-float-key"));
});

test("#1055 Enter 把当前命中滚动到编辑器可视区（A-2.6）", async ({ page }) => {
  const farDoc = [
    "# 远命中",
    "",
    ...Array.from({ length: 80 }, (_, i) => `第 ${i + 1} 行填充`),
    "",
    "目标命中第一处",
    "",
    "目标命中第二处",
  ].join("\n");
  await openDoc(page, DOC_A, "/Users/test/a.md");
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { splitPane: (d: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .splitPane("row");
  });
  await openDoc(page, farDoc, "/Users/test/far.md");
  const { main, split } = await paneIds(page);
  expect(main).toBe("main");
  await page.evaluate((id) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            setPaneEditorMode: (id: string, m: string) => void;
          };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setPaneEditorMode(id, "edit");
  }, split);
  await page.evaluate((id) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { focusPane: (id: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .focusPane(id);
  }, split);

  await page.keyboard.press("Meta+f");
  const float = page.locator(
    `[data-pane-id="${split}"] [data-testid="search-float"]`,
  );
  await expect(float).toBeVisible();
  await float.locator('[data-testid="search-float-input"]').fill("目标命中");
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(2);

  await page.keyboard.press("ArrowDown");
  await expectEnterBadge(rows.nth(1).locator(".search-float-key"));
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => (await paneProbe(page, split))?.scrollTop ?? 0)
    .toBeGreaterThan(0);
  const probe = await paneProbe(page, split);
  expect(probe?.selections ?? 0).toBeGreaterThan(0);
  const mainProbe = await paneProbe(page, main);
  expect(mainProbe?.selections ?? 0).toBe(0);
});

/* ------------------------------------------------------------------ *
 * #1057 结果容器 9 行上限 + 快捷键列常驻（A-19.1 / A-19.2 / A-19.3）
 * ------------------------------------------------------------------ */

const ART_1057 = path.resolve(process.cwd(), ".artifacts/1057");

async function recordState1057(page: Page, state: string): Promise<void> {
  mkdirSync(ART_1057, { recursive: true });
  const file = path.join(ART_1057, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART_1057, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1057-search-results-cap", states }, null, 2)}\n`,
  );
}

test("#1057 结果容器 9 行上限 + 滚动时快捷键列常驻 + 清空复位（A-19.1/2/3）", async ({
  page,
}) => {
  await openDoc(page, LONG_DOC, "/Users/test/long.md");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("命中");

  const results = float.locator('[data-testid="search-float-results"]');
  const rows = float.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(21);

  const geom = await results.evaluate((el) => {
    const cs = getComputedStyle(el);
    const first = el.querySelector<HTMLElement>(".search-float-hit");
    const rowH = first ? first.getBoundingClientRect().height : 0;
    const padTop = parseFloat(cs.paddingTop);
    const padBottom = parseFloat(cs.paddingBottom);
    return {
      rowH,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      padTop,
      padBottom,
      boxSizing: cs.boxSizing,
      contentBox: el.clientHeight - padTop - padBottom,
    };
  });
  expect(geom.boxSizing).toBe("border-box");
  expect(geom.rowH).toBeGreaterThan(0);
  // A-19.1：容器内容盒高度 = 9 × 实测行高（±2px）
  expect(Math.abs(geom.contentBox - 9 * geom.rowH)).toBeLessThanOrEqual(2);
  // A-19.3：内容溢出，容器可滚动
  expect(geom.scrollHeight).toBeGreaterThan(geom.clientHeight);
  await recordState1057(page, "01-nine-rows");

  // A-19.2：滚动到底部后，最后一条完整可见行的行尾快捷键仍可见。
  await results.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const lastVisibleIndex = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="search-float-results"]');
    if (!box) return -1;
    const rr = box.getBoundingClientRect();
    const all = Array.from(
      document.querySelectorAll('[data-testid="search-float-hit"]'),
    );
    let idx = -1;
    all.forEach((row, i) => {
      const b = row.getBoundingClientRect();
      if (b.top >= rr.top - 1 && b.bottom <= rr.bottom + 1) idx = i;
    });
    return idx;
  });
  expect(lastVisibleIndex).toBeGreaterThanOrEqual(0);
  await rows.nth(lastVisibleIndex).click();
  const lastKey = rows.nth(lastVisibleIndex).locator(".search-float-key");
  await expect(lastKey).toBeVisible();
  await expectEnterBadge(lastKey);
  const keyBox = await lastKey.boundingBox();
  const resultsBox = await results.boundingBox();
  if (!keyBox || !resultsBox) throw new Error("快捷键列或结果区未布局");
  expect(keyBox.x).toBeGreaterThanOrEqual(resultsBox.x - 1);
  expect(keyBox.x + keyBox.width).toBeLessThanOrEqual(
    resultsBox.x + resultsBox.width + 1,
  );
  await recordState1057(page, "02-scrolled-bottom");

  const keyStyle = await lastKey.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { position: cs.position, right: cs.right };
  });
  expect(keyStyle.position).toBe("sticky");
  expect(keyStyle.right).toBe("0px");
  await recordState1057(page, "03-key-column-visible");

  await page.locator('[data-testid="search-float-input"]').fill("");
  await expect(float.locator(".search-float-empty")).toBeVisible();
  await expect(rows).toHaveCount(0);
  const scrollTop = await results.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBe(0);
  await recordState1057(page, "04-cleared-reset");
});

test("#1057 长 token 与超宽行内容都不撑出横向滚动，键列恒在视口内", async ({
  page,
}) => {
  const doc = [
    "# 长 token 探针",
    "",
    `命中 ${"A".repeat(220)}`,
    "",
    ...Array.from({ length: 18 }, (_, i) => `第 ${i + 1} 段命中`),
  ].join("\n");
  await openDoc(page, doc, "/Users/test/long-token.md");
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("命中");
  const results = float.locator('[data-testid="search-float-results"]');
  await expect(
    results.locator('[data-testid="search-float-hit"]').first(),
  ).toBeVisible();

  const natural = await results.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(natural.scrollWidth).toBeLessThanOrEqual(natural.clientWidth + 1);
  await expectVisibleKeysWithinResults(float);

  await page.addStyleTag({
    content:
      ".search-float-main::after{content:'';display:inline-block;width:600px;height:1px;}",
  });
  const forced = await results.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(forced.scrollWidth).toBeLessThanOrEqual(forced.clientWidth + 1);

  await results.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expectVisibleKeysWithinResults(float);

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
});

/* ------------------------------------------------------------------ *
 * #1058 搜索浮窗默认宽度减半（A-20.1 / A-20.2）
 * ------------------------------------------------------------------ */

const ART_1058 = path.resolve(process.cwd(), ".artifacts/1058");

async function recordState1058(page: Page, state: string): Promise<void> {
  mkdirSync(ART_1058, { recursive: true });
  const file = path.join(ART_1058, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART_1058, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1058-search-float-half-width", states }, null, 2)}\n`,
  );
}

const NARROW_CONTROL_SELECTOR = [
  '[data-testid="search-float-input"]',
  '[data-testid="search-float-count"]',
  '[data-testid="search-float-replace-toggle"]',
  '[data-testid="search-float-close"]',
  '[data-testid="search-float-replace-input"]',
  '[data-testid="search-float-replace-one"]',
  '[data-testid="search-float-replace-all"]',
].join(",");

async function narrowLayoutProbe(page: Page) {
  return page.evaluate((selector) => {
    const float = document.querySelector<HTMLElement>(
      '[data-testid="search-float"]',
    );
    if (!float) throw new Error("浮窗不存在");
    const fr = float.getBoundingClientRect();
    const controls = Array.from(
      float.querySelectorAll<HTMLElement>(selector),
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        testid: el.getAttribute("data-testid"),
        left: r.left - fr.left,
        right: r.right - fr.right,
      };
    });
    return {
      floatWidth: fr.width,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      controls,
      outside: controls.filter((c) => c.left < -0.5 || c.right > 0.5),
    };
  }, NARROW_CONTROL_SELECTOR);
}

test("#1058 默认宽度 300（A-20.1）", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const box = await float.boundingBox();
  if (!box) throw new Error("浮窗未布局");
  expect(Math.abs(box.width - 300)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - 460)).toBeLessThanOrEqual(1);
  await recordState1058(page, "01-default-300");
});

test("#1058 窄视口 360：宽度受控、无横向溢出、控件不被裁剪（A-20.2）", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const probe = await narrowLayoutProbe(page);
  expect(probe.floatWidth).toBeLessThanOrEqual(probe.innerWidth - 32 + 1);
  expect(probe.scrollWidth).toBeLessThanOrEqual(probe.innerWidth + 1);
  expect(probe.outside).toEqual([]);
  await recordState1058(page, "02-narrow-360");
});

test("#1058 窄视口 320 + 替换行：控件在浮窗内且关闭可点（A-20.2）", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  await page.locator('[data-testid="search-float-replace-toggle"]').click();
  await expect(
    page.locator('[data-testid="search-float-replace-row"]'),
  ).toBeVisible();

  const probe = await narrowLayoutProbe(page);
  expect(probe.floatWidth).toBeLessThanOrEqual(probe.innerWidth - 32 + 1);
  expect(probe.scrollWidth).toBeLessThanOrEqual(probe.innerWidth + 1);
  expect(probe.outside).toEqual([]);
  await recordState1058(page, "03-narrow-320-controls");

  await page.locator('[data-testid="search-float-close"]').click();
  await expect(float).toBeHidden();
});

/* ------------------------------------------------------------------ *
 * #1054 重启反馈：顶栏标题 / 关闭钮位次 / 清空钮 / 状态栏文案 / 字号+1档
 * （change editor-surface-batch23 / 任务 1.1，A-1.1…A-1.8）
 * ------------------------------------------------------------------ */

test("#1054 A-1.1/A-1.2 顶栏含「搜索和替换」文本节点，关闭钮是顶栏最后一个子节点", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();
  const handle = float.locator('[data-testid="search-float-handle"]');

  // A-1.1：顶栏内出现「搜索和替换」的文本节点数下限 = 1
  const titleNodes = await handle.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node = walker.nextNode();
    while (node) {
      if ((node.textContent ?? "").includes("搜索和替换")) count += 1;
      node = walker.nextNode();
    }
    return count;
  });
  expect(titleNodes).toBeGreaterThanOrEqual(1);

  // A-1.2：关闭钮位于顶栏最右侧，其右兄弟节点数 = 0
  const closeInfo = await handle.evaluate((el) => {
    const close = el.querySelector<HTMLElement>(
      '[data-testid="search-float-close"]',
    );
    if (!close) return { found: false as const, rightSiblings: -1 };
    let rightSiblings = 0;
    let sib = close.nextElementSibling;
    while (sib) {
      rightSiblings += 1;
      sib = sib.nextElementSibling;
    }
    return { found: true as const, rightSiblings };
  });
  expect(closeInfo.found).toBe(true);
  expect(closeInfo.rightSiblings).toBe(0);
});

test("#1054 A-1.3/A-1.4 状态栏文案精确等于目标串且不含「（局部 · 浮窗内）」", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();
  const text = (await bar.textContent()) ?? "";
  expect(text).not.toContain("（局部 · 浮窗内）");
  expect(text).toBe("↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达 · Esc 关闭");
});

test("#1054 A-1.5 关键词非空出现一键清空钮，点击后清空且浮窗保持打开", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const input = page.locator('[data-testid="search-float-input"]');
  const clear = page.locator('[data-testid="search-float-clear"]');
  await expect(float).toBeVisible();

  // 空关键词：无清空钮
  await expect(clear).toHaveCount(0);

  await input.fill("属性");
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "3 处",
  );
  await expect(clear).toBeVisible();

  await clear.click();
  await expect(input).toHaveValue("");
  await expect(page.locator('[data-testid="search-float-count"]')).toHaveText(
    "",
  );
  await expect(float).toBeVisible();
  await expect(input).toBeFocused();
  await expect(clear).toHaveCount(0);
});

test("#1054 A-1.6/A-1.7/A-1.8 结果定位行 / 上下文片段 / 快捷键徽标字号各上调一档（11/12/11px）", async ({
  page,
}) => {
  await page.keyboard.press("Meta+f");
  await page.locator('[data-testid="search-float-input"]').fill("属性");
  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(3);

  const sizes = await rows.first().evaluate((row) => {
    const read = (selector: string) => {
      const el = row.querySelector<HTMLElement>(selector);
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    };
    return {
      locRow: read(".search-float-top"),
      context: read(".search-float-context"),
      // 第 2 行为非选中行，行尾是 ⌘N 文本，量它的字号
      key: parseFloat(
        getComputedStyle(
          row.parentElement!.querySelector<HTMLElement>(
            '[data-testid="search-float-hit"][data-index="1"] .search-float-key',
          )!,
        ).fontSize,
      ),
    };
  });

  expect(sizes.locRow).toBe(11);
  expect(sizes.context).toBe(12);
  expect(sizes.key).toBe(11);
});

test("#1058 默认 300 宽度下状态栏贴底（A-16.1 交叉复核）", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  const bar = page.locator('[data-testid="search-float-statusbar"]');
  await expect(bar).toBeVisible();
  await page.locator('[data-testid="search-float-input"]').fill("属性");

  const box = await float.boundingBox();
  if (!box) throw new Error("浮窗未布局");
  expect(Math.abs(box.width - 300)).toBeLessThanOrEqual(2);
  const gap = await statusbarGap(page);
  expect(Math.abs(gap?.gap ?? 999)).toBeLessThanOrEqual(1);
  await recordState1058(page, "04-statusbar-attached");
});

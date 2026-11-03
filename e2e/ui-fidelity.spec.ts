import { test, expect } from "@playwright/test";
import { ANCHOR_TOLERANCE_PX, EDITOR_ANCHORS } from "./fixtures/editor-anchors";
import {
  boxOf,
  centerOf,
  moveThrough,
  openMarkdownInEdit,
} from "./helpers/ui-probe";

/**
 * 保真回归层（#116）。
 *
 * 这一层只做一件事：把「用户在页面上看到的几何与图标」按锚点表钉住。
 * 断言数字全部来自 `e2e/fixtures/editor-anchors.ts`，本文件不写魔法数字。
 */

const DOC = ["# 标题一", "", "第一段正文", "", "第二段正文", ""].join("\n");

async function summonHandle(page: import("@playwright/test").Page) {
  await page.locator(".cm-line").nth(2).hover();
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  return handle;
}

test.describe("块手柄几何", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(page, DOC, "fidelity-handle");
  });

  test("药丸是 42×26（E-7）", async ({ page }) => {
    const handle = await summonHandle(page);
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.handle.width - ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.width)).toBeLessThanOrEqual(
      EDITOR_ANCHORS.handle.width + ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.handle.height - ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.height)).toBeLessThanOrEqual(
      EDITOR_ANCHORS.handle.height + ANCHOR_TOLERANCE_PX,
    );
  });
});

test.describe("表格左上角（#109）", () => {
  test("悬停表格不再出现锚点圆点", async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "| A | B |\n| --- | --- |\n| a1 | b1 |\n",
      "fidelity-table-corner",
    );
    await page.locator("td[data-row='0'][data-col='0']").hover();
    await page.waitForTimeout(300);
    await expect(page.locator(".cm-table-anchor")).toHaveCount(0);
    await expect(page.locator('[data-testid="cm-table-anchor"]')).toHaveCount(
      0,
    );
    // 逐单元格把手是另一件事（#108），必须还在。
    await expect(page.locator(".cm-table-cell-handle").first()).toBeVisible();
  });
});

test.describe("单元格手柄随内容变化（#108）", () => {
  const CELL = 'td[data-row="0"][data-col="1"]';

  async function handleIcon(page: import("@playwright/test").Page) {
    return page
      .locator(`${CELL} .cm-table-cell-handle`)
      .evaluate((el) => (el as HTMLElement).dataset.icon ?? null);
  }

  test("空 → 有内容：图标从 + 变成转换块", async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "| A | B |\n| --- | --- |\n| a1 |  |\n",
      "fidelity-cell-icon",
    );
    await expect.poll(() => handleIcon(page)).toBe("AddOutlined");

    await page.locator(CELL).click();
    const input = page.locator('[data-testid="cm-table-cell-input"]');
    await input.click();
    await page.keyboard.type("新内容");
    await page.keyboard.press("Enter");

    await expect.poll(() => handleIcon(page)).toBe("DataSheetOutlined");
    await expect
      .poll(() =>
        page
          .locator(`${CELL} .cm-table-cell-handle`)
          .evaluate((el) => (el as HTMLElement).dataset.cellEmpty),
      )
      .toBe("false");
  });
});

test.describe("块型图标（E-7：块型图标 + 拖拽把手）", () => {
  const cases: ReadonlyArray<{ name: string; doc: string; icon: string }> = [
    { name: "H2 标题", doc: "## 标题\n", icon: "H2Outlined" },
    { name: "段落", doc: "一段正文\n", icon: "FormatParagraphOutlined" },
    { name: "引用", doc: "> 引用一行\n", icon: "ReferenceOutlined" },
    { name: "无序列表", doc: "- 一项\n", icon: "DisorderListOutlined" },
    { name: "有序列表", doc: "1. 一项\n", icon: "OrderListOutlined" },
    { name: "任务", doc: "- [ ] 一项\n", icon: "TodoOutlined" },
    {
      name: "代码块",
      doc: "```js\nconst a = 1;\n```\n",
      icon: "CodeblockOutlined",
    },
  ];

  test("转换块型后图标立即跟随（不残留上一块）", async ({ page }) => {
    await openMarkdownInEdit(page, "一段正文\n", "fidelity-icon-refresh");
    await page.locator(".cm-line").first().hover();
    const handle = page.locator(
      '[data-testid="block-handle"].cm-block-handle-visible',
    );
    await expect(handle).toHaveCount(1, { timeout: 3000 });
    await handle.hover();
    await page
      .locator('[data-testid="block-menu-cell"][data-target="h1"]')
      .click();
    await page.waitForTimeout(150);
    await page.mouse.move(900, 500);
    await page.locator(".cm-line").first().hover();
    const refreshed = page.locator(
      '[data-testid="block-handle"].cm-block-handle-visible',
    );
    await expect(refreshed).toHaveCount(1, { timeout: 3000 });
    await expect(
      refreshed.locator(".cm-block-handle-icon svg"),
    ).toHaveAttribute("data-icon", "H1Outlined");
  });

  for (const item of cases) {
    test(`${item.name} 的手柄是 ${item.icon}`, async ({ page }) => {
      await openMarkdownInEdit(page, item.doc, `fidelity-icon-${item.icon}`);
      await page.locator(".cm-line").first().hover();
      const handle = page.locator(
        '[data-testid="block-handle"].cm-block-handle-visible',
      );
      await expect(handle).toHaveCount(1, { timeout: 3000 });
      // 药丸有两段：左段块型图标、右段拖拽把手。只看左段。
      await expect(handle.locator(".cm-block-handle-icon svg")).toHaveAttribute(
        "data-icon",
        item.icon,
      );
    });
  }
});

test.describe("模式切换与空大纲（2026-11-03 走查）", () => {
  test("预览切回编辑后视口铺满，不留空白", async ({ page }) => {
    const lines = Array.from(
      { length: 120 },
      (_, i) => `第 ${i + 1} 段正文`,
    ).join("\n\n");
    await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector("header", { timeout: 10000 });
    await page.evaluate((doc) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__("/tmp/long/long.md", doc, "long.md");
      win.__biaoyue_store__.getState().setEditorMode("preview");
    }, lines);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__biaoyue_store__
        .getState()
        .setEditorMode("edit");
    });
    await page.waitForTimeout(800);
    // 隐藏态量到的高度是 0，切回可见必须重新测量，否则只渲染顶部几行
    const shown = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(".cm-scroller");
      const content = document.querySelector<HTMLElement>(".cm-content");
      return {
        lines: document.querySelectorAll(".cm-line").length,
        contentH: content?.clientHeight ?? 0,
        scrollerH: scroller?.clientHeight ?? 0,
      };
    });
    expect(shown.contentH).toBeGreaterThan(shown.scrollerH * 2);
    expect(shown.lines).toBeGreaterThan(20);
  });

  test("没有标题时不显示大纲按钮", async ({ page }) => {
    await openMarkdownInEdit(page, "只有正文，没有标题\n", "no-heading");
    await expect(page.locator('[data-testid="outline-btn"]')).toHaveCount(0);
  });

  test("有标题时大纲按钮出现", async ({ page }) => {
    await openMarkdownInEdit(page, "# 有标题\n\n正文\n", "has-heading");
    await expect(page.locator('[data-testid="outline-btn"]')).toHaveCount(1);
  });
});

test.describe("空行「+」手柄", () => {
  test("悬停只召唤它自己，不弹转换菜单；点击才开插入菜单", async ({ page }) => {
    await openMarkdownInEdit(page, "第一段\n\n\n第二段\n", "fidelity-plus");
    const plus = page.locator('[data-empty="true"]').first();
    await expect(plus).toHaveCount(1);
    await plus.hover();
    // 给意图延迟留足时间：如果监听还挂在空行手柄上，这里就会弹出转换菜单。
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
    await plus.click();
    await expect(page.locator(".mdb-slash-menu")).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("块菜单几何与图标", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(page, DOC, "fidelity-menu");
    const handle = await summonHandle(page);
    await handle.hover();
    await page.locator('[data-testid="block-menu"]').waitFor({ timeout: 3000 });
  });

  test("菜单宽 236、行高 32（E-7）", async ({ page }) => {
    const menu = await boxOf(page, '[data-testid="block-menu"]');
    expect(
      Math.abs(menu.width - EDITOR_ANCHORS.menu.width),
    ).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
    // 网格单元不是 32px 行；行高锚点只约束列表行（「在下方添加」等）。
    const rows = page.locator(".cm-block-menu-item");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const row = await rows.nth(i).boundingBox();
      expect(Math.round(row!.height)).toBe(EDITOR_ANCHORS.menu.rowHeight);
    }
  });

  test("「转为」是 5 列 × 2 行网格（豆包 §4.3）", async ({ page }) => {
    await expect(page.locator('[data-testid="block-menu-cell"]')).toHaveCount(
      EDITOR_ANCHORS.convertCells,
    );
    const columns = await page
      .locator('[data-testid="block-menu-grid"]')
      .evaluate(
        (el) =>
          getComputedStyle(el)
            .gridTemplateColumns.split(" ")
            .filter((part) => part.trim() !== "").length,
      );
    expect(columns).toBe(5);
  });

  test("每个「转为」单元都有图标", async ({ page }) => {
    const rows = page.locator('[data-testid="block-menu-cell"]');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator("svg")).toHaveCount(1);
    }
  });

  test("菜单图标渲染 20px（放大一档，2026-11-03）", async ({ page }) => {
    const width = await page
      .locator('[data-testid="block-menu-cell"] svg')
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(width).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.menuIcon - ANCHOR_TOLERANCE_PX,
    );
  });

  test("「在下方添加」行也有图标与展开指示", async ({ page }) => {
    const row = page.locator('[data-testid="block-menu-add-below"]');
    await expect(row.locator("svg")).toHaveCount(1);
    await expect(row.locator(".cm-block-menu-chevron")).toHaveCount(1);
  });
});

test.describe("大纲浮层", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "# 一\n\n## 二\n\n## 三\n",
      "fidelity-outline",
    );
  });

  test("悬停展开、点击钉住、Esc 收起", async ({ page }) => {
    const btn = page.locator('[data-testid="outline-btn"]');
    await btn.hover();
    await expect(page.locator('[data-testid="outline-menu"]')).toBeVisible();
    await btn.click();
    await moveThrough(page, [{ x: 600, y: 400 }]);
    await expect(page.locator('[data-testid="outline-menu"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="outline-menu"]')).toHaveCount(0);
  });

  test("离开整体后收起（延迟不等于粘住）", async ({ page }) => {
    await page.locator('[data-testid="outline-btn"]').hover();
    const panel = page.locator('[data-testid="outline-menu"]');
    await expect(panel).toBeVisible();
    await moveThrough(page, [{ x: 600, y: 500 }], { steps: 4 });
    await expect(panel).toHaveCount(0, { timeout: 3000 });
  });

  test("指针穿过按钮与面板之间的空隙，浮层不消失", async ({ page }) => {
    await page.locator('[data-testid="outline-btn"]').hover();
    const panel = page.locator('[data-testid="outline-menu"]');
    await expect(panel).toBeVisible();
    const btnPoint = await centerOf(page, '[data-testid="outline-btn"]');
    const panelPoint = await centerOf(page, '[data-testid="outline-menu"]');
    await moveThrough(
      page,
      [btnPoint, { x: btnPoint.x, y: btnPoint.y + 30 }, panelPoint],
      {
        steps: 3,
        pauseMs: 120,
      },
    );
    await expect(panel).toBeVisible();
  });
});

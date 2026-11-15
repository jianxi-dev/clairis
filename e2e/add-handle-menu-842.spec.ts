import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough } from "./helpers/ui-probe";
import { summonAddHandle } from "./helpers/block-handle";
import { EDITOR_ANCHORS } from "./fixtures/editor-anchors";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/842");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

// design D7 的基础段顺序（A-10.4 要求前三项为 H1/H2/H3）。
// A-10.1 以 design D7 / 需求正文 / tasks 10.1 枚举的 10 项为准；原 G0 笔误
// 「8」已由 owner 另行修锚点（见 #842 正文修正）。
const BASIC_LABELS = [
  "H1",
  "H2",
  "H3",
  "有序列表",
  "无序列表",
  "任务",
  "引用",
  "分割线",
  "代码块",
  "链接",
];
const COMMON_LABELS = [
  "标题",
  "高亮",
  "分栏",
  "表格",
  "图片",
  "视频或文件",
  "公式",
  "内嵌网页",
];

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/add-handle-menu-842.md",
      "第一段正文\n\n\n第二段正文\n",
      "add-handle-menu-842.md",
    );
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openAddMenu(page: Page): Promise<Locator> {
  const add = page.locator(".cm-block-handle-add").first();
  await expect(add).toHaveCount(1);
  await summonAddHandle(page, add);
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1, { timeout: 3000 });
  return menu;
}

function shot(page: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
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
  });
}

/** 基础段图标单元的可访问名（aria-label / title）。 */
function basicNames(menu: Locator) {
  return menu
    .locator('.cm-add-grid[data-section="基础"] .cm-add-cell')
    .evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute("aria-label") ?? ""),
    );
}

test("新增手柄菜单分两段：基础纯图标、常用带文字（A-10.1–A-10.4）", async ({
  page,
}) => {
  await openDoc(page);
  const menu = await openAddMenu(page);

  const grid = menu.locator('.cm-add-grid[data-section="基础"]');
  const list = menu.locator('.cm-add-list[data-section="常用"]');
  await expect(grid).toHaveCount(1);
  await expect(list).toHaveCount(1);

  // A-10.1：基础段图标数 = 10（D7 枚举，owner 裁定口径）。
  const cells = grid.locator(".cm-add-cell");
  await expect(cells).toHaveCount(BASIC_LABELS.length);
  expect(BASIC_LABELS).toHaveLength(10);

  // A-10.2：基础段只显示图标——单元内除 svg 图标字形外没有文字节点。
  const basicText = await grid.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const outside: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node.textContent ?? "").trim() === "") continue;
      if (node.parentElement?.closest("svg")) continue;
      outside.push(node.textContent ?? "");
    }
    return {
      outsideSvg: outside,
      cjk: (el.textContent ?? "").match(/[\u4e00-\u9fa5]/g) ?? [],
      childTags: Array.from(el.querySelectorAll(".cm-add-cell")).map((cell) =>
        Array.from(cell.children).map((c) => c.tagName.toLowerCase()),
      ),
    };
  });
  expect(basicText.outsideSvg).toEqual([]);
  expect(basicText.cjk).toEqual([]);
  expect(
    basicText.childTags.every((tags) => tags.length === 1 && tags[0] === "svg"),
  ).toBe(true);

  // A-10.2 口径：基础网格之外，菜单里只允许「常用」行文字与分段标题
  // （`.cm-add-section-label` 是容器铬标，不是图标配文）。
  const strayText = await menu.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const stray: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").trim();
      if (text === "") continue;
      const parent = node.parentElement;
      if (parent?.closest("svg")) continue;
      if (parent?.closest(".cm-add-list")) continue;
      if (parent?.classList.contains("cm-add-section-label")) continue;
      stray.push(text);
    }
    return stray;
  });
  expect(strayText).toEqual([]);

  // A-10.4：基础段可访问名全量顺序 = 10 项枚举，前三项 = H1,H2,H3。
  const names = await basicNames(menu);
  expect(names).toEqual(BASIC_LABELS);
  expect(names.slice(0, 3)).toEqual(["H1", "H2", "H3"]);

  // A-10.3：常用段 8 项且每项显示文字。
  const commonRows = list.locator(".mdb-slash-item");
  await expect(commonRows).toHaveCount(COMMON_LABELS.length);
  const commonLabels = await commonRows
    .locator(".mdb-slash-item-label")
    .allTextContents();
  expect(commonLabels).toEqual(COMMON_LABELS);

  // 两段同宽：都沿用 E-11 菜单宽度常量（176px）。
  const gridBox = (await grid.boundingBox())!;
  const listBox = (await list.boundingBox())!;
  expect(Math.abs(gridBox.width - listBox.width)).toBeLessThanOrEqual(1);
  expect(gridBox.width).toBeGreaterThan(0);

  await shot(page, "menu-open-basic-dense");
});

test("基础单元悬停高亮、常用行展开二级（状态证据）", async ({ page }) => {
  await openDoc(page);
  const menu = await openAddMenu(page);

  // 状态 2：基础单元悬停 → data-selected 跟着指针移动（取 H3，非初始选中的首格）。
  const grid = menu.locator('.cm-add-grid[data-section="基础"]');
  const firstCell = grid.locator(".cm-add-cell").first();
  const h3Cell = grid.locator('.cm-add-cell[aria-label="H3"]');
  const h3Box = (await h3Cell.boundingBox())!;
  await moveThrough(
    page,
    [{ x: h3Box.x + h3Box.width / 2, y: h3Box.y + h3Box.height / 2 }],
    { steps: 4 },
  );
  await expect(h3Cell).toHaveAttribute("data-selected", "true");
  await expect(firstCell).not.toHaveAttribute("data-selected", "true");
  await shot(page, "basic-cell-hover-selected");

  // 状态 3：常用「表格」行悬停 → 尺寸网格浮层。
  const tableRow = menu
    .locator('.cm-add-list[data-section="常用"] .mdb-slash-item')
    .filter({ hasText: "表格" });
  const tableBox = (await tableRow.boundingBox())!;
  await moveThrough(
    page,
    [
      {
        x: tableBox.x + tableBox.width / 2,
        y: tableBox.y + tableBox.height / 2,
      },
    ],
    { steps: 4 },
  );
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(1);
  await shot(page, "common-table-grid-flyout");

  // 状态 4：常用「标题」行悬停 → 标题层级浮层。
  const headingRow = menu
    .locator('.cm-add-list[data-section="常用"] .mdb-slash-item')
    .filter({ hasText: "标题" });
  const headingBox = (await headingRow.boundingBox())!;
  await moveThrough(
    page,
    [
      {
        x: headingBox.x + headingBox.width / 2,
        y: headingBox.y + headingBox.height / 2,
      },
    ],
    { steps: 4 },
  );
  const flyoutLabels = page.locator(
    ".mdb-slash-flyout-item .mdb-slash-flyout-label",
  );
  await expect(flyoutLabels.first()).toBeVisible({ timeout: 3000 });
  expect((await flyoutLabels.allTextContents()).length).toBeGreaterThan(0);
  await shot(page, "common-heading-submenu");
});

test("基础单元点击落块（行为保持）", async ({ page }) => {
  await openDoc(page);
  const menu = await openAddMenu(page);

  const quote = menu.locator(
    '.cm-add-grid[data-section="基础"] .cm-add-cell[aria-label="引用"]',
  );
  await quote.click();
  await expect(menu).toHaveCount(0);

  const text = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId].content as string;
  });
  expect(text).toContain("> ");
});

test("基础段代码块 / 链接单元点击落块（行为保持）", async ({ page }) => {
  await openDoc(page);

  const codeMenu = await openAddMenu(page);
  await codeMenu
    .locator(
      '.cm-add-grid[data-section="基础"] .cm-add-cell[aria-label="代码块"]',
    )
    .click();
  await expect(codeMenu).toHaveCount(0);
  let text = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId].content as string;
  });
  expect(text).toContain("```");

  const linkMenu = await openAddMenu(page);
  await linkMenu
    .locator(
      '.cm-add-grid[data-section="基础"] .cm-add-cell[aria-label="链接"]',
    )
    .click();
  await expect(linkMenu).toHaveCount(0);
  text = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId].content as string;
  });
  expect(text).toContain("[链接文字](url)");
});

test("新增手柄菜单宽度沿用 E-11 常量", async ({ page }) => {
  await openDoc(page);
  const menu = await openAddMenu(page);
  const box = (await menu.boundingBox())!;
  expect(Math.abs(box.width - EDITOR_ANCHORS.menu.width)).toBeLessThanOrEqual(
    1,
  );
});

import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough, SUMMON_PROBE_RATIO } from "./helpers/ui-probe";
import { summonAddHandle } from "./helpers/block-handle";
import { EDITOR_ANCHORS } from "./fixtures/editor-anchors";

/**
 * #847（change=editor-surface-batch19/9.1）表格与单元格手柄复用全局菜单。
 *
 * A-9.1 滑入表格表头转换手柄节点数 = 1（表格图标 + 六点拖拽）
 * A-9.2 滑入单元格转换 / 新增手柄节点数 = 2
 * A-9.3 单元格菜单项集与全局菜单项集严格相等（复用 addHandleCommands）
 * A-9.4 上缘 / 左缘行列插入热点完整（非孤立灰点）
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/847");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const DOC = [
  "第一段",
  "",
  "| A | B | C |",
  "| --- | --- | --- |",
  "| 1 | 2 | 3 |",
  "| 4 | 5 | 6 |",
].join("\n");

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page): Promise<void> {
  await page.evaluate((doc) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/table-cell-handles-847.md",
      doc,
      "table-cell-handles-847.md",
    );
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

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

/** 召唤区（.cm-content 左缘 10%）内按真实指针路径移动。 */
async function moveToSummonZone(page: Page, y: number): Promise<void> {
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await moveThrough(
    page,
    [{ x: content.left + content.width * SUMMON_PROBE_RATIO, y }],
    { steps: 6 },
  );
}

/**
 * 菜单项名数组：基础段取单元 aria-label，常用段取行文字标签，按 DOM 顺序。
 * 全局新增菜单与单元格菜单共用这一读法，所以两者可以直接深比较。
 */
function menuNames(menu: Locator): Promise<string[]> {
  return menu.evaluate((el) => [
    ...Array.from(
      el.querySelectorAll('.cm-add-grid[data-section="基础"] .cm-add-cell'),
    ).map((cell) => cell.getAttribute("aria-label") ?? ""),
    ...Array.from(
      el.querySelectorAll(
        '.cm-add-list[data-section="常用"] .mdb-slash-item-label',
      ),
    ).map((label) => label.textContent ?? ""),
  ]);
}

/** 外部点击关闭：空行「+」菜单是 hover 打开的，焦点不在编辑器上，先走外点。 */
async function closeByOutsideClick(page: Page): Promise<void> {
  await page.locator(".cm-line").first().click();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
}

/** Esc 关闭：单元格手柄菜单由 `openCellMenuFor` 主动 focus，keymap 可达。 */
async function closeByEscape(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
}

test("A-9.1 滑入表头：转换手柄节点数 = 1（表格图标 + 六点拖拽）", async ({
  page,
}) => {
  await openDoc(page);
  const table = page.locator("table.cm-table").first();
  const tableBox = (await table.boundingBox())!;

  // 指针落在表头行的召唤区内（D5：左缘 25%），等 HoverGate 显现。
  await moveToSummonZone(page, tableBox.y + 16);
  const visible = page.locator(".cm-block-handle.cm-block-handle-visible");
  await expect(visible).toHaveCount(1, { timeout: 3000 });

  const handle = visible.first();
  await expect(handle.locator(".cm-block-handle-icon svg")).toHaveAttribute(
    "data-icon",
    "DataSheetOutlined",
  );
  await expect(handle.locator(".cm-block-handle-grip svg")).toHaveAttribute(
    "data-icon",
    "DragHandleOutlined",
  );

  await shot(page, "header-handle");
});

test("A-9.2 滑入单元格：转换手柄 + 新增「+」手柄节点数 = 2", async ({
  page,
}) => {
  await openDoc(page);
  const cell = page.locator('td[data-row="0"][data-col="0"]');
  const cellBox = (await cell.boundingBox())!;
  await moveThrough(
    page,
    [{ x: cellBox.x + cellBox.width / 2, y: cellBox.y + cellBox.height / 2 }],
    { steps: 6 },
  );
  await expect(cell.locator(".cm-table-cell-handle")).toHaveCount(1);
  await expect(cell.locator(".cm-table-cell-add")).toHaveCount(1);

  // 两个手柄都真的显现（不是只留下 DOM 节点）。
  for (const selector of [".cm-table-cell-handle", ".cm-table-cell-add"]) {
    await expect
      .poll(async () =>
        cell.locator(selector).evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
  }
  await expect(cell.locator(".cm-table-cell-add svg")).toHaveAttribute(
    "data-icon",
    "AddOutlined",
  );

  await shot(page, "cell-handles");
});

test("A-9.3 单元格菜单项集与全局菜单项集严格相等", async ({ page }) => {
  await openDoc(page);

  // 全局新增菜单：空行「+」手柄（B1 之后的 addHandleCommands 两段菜单）。
  const add = page.locator(".cm-block-handle-add").first();
  await expect(add).toHaveCount(1);
  await summonAddHandle(page, add);
  const globalMenu = page.locator(".mdb-slash-menu");
  await expect(globalMenu).toHaveCount(1, { timeout: 3000 });
  const globalNames = await menuNames(globalMenu);
  expect(globalNames).toHaveLength(EDITOR_ANCHORS.addMenuItems);
  await shot(page, "global-add-menu");
  await closeByOutsideClick(page);

  // 单元格转换手柄菜单。
  const cell = page.locator('td[data-row="0"][data-col="0"]');
  await cell.locator(".cm-table-cell-handle").click();
  const cellMenu = page.locator(".mdb-slash-menu");
  await expect(cellMenu).toHaveCount(1, { timeout: 3000 });
  expect(await menuNames(cellMenu)).toEqual(globalNames);
  await shot(page, "cell-menu-conversion");
  await closeByEscape(page);

  // 单元格新增「+」手柄菜单：同一项集。
  await cell.locator(".cm-table-cell-add").click();
  const addMenu = page.locator(".mdb-slash-menu");
  await expect(addMenu).toHaveCount(1, { timeout: 3000 });
  expect(await menuNames(addMenu)).toEqual(globalNames);
  await shot(page, "cell-menu-add");
  await closeByEscape(page);
});

test("A-9.4 上缘 / 左缘行列插入热点完整（非孤立灰点）", async ({ page }) => {
  await openDoc(page);
  const table = page.locator("table.cm-table").first();
  const columns = await table.locator("thead th").count();
  const bodyRows = await table.locator("tbody tr").count();

  const tableBox = (await table.boundingBox())!;
  await moveThrough(
    page,
    [
      {
        x: tableBox.x + tableBox.width / 2,
        y: tableBox.y + tableBox.height / 2,
      },
    ],
    { steps: 6 },
  );
  const colSpots = page.locator(".cm-table-hotspot-col");
  const rowSpots = page.locator(".cm-table-hotspot-row");
  await expect(colSpots).toHaveCount(columns + 1);
  await expect(rowSpots).toHaveCount(bodyRows + 1);

  // 全部热点显现，且都带可点击的插入按钮（不是孤立灰点）。
  await expect(page.locator(".cm-table-hotspot-revealed")).toHaveCount(
    columns + 1 + (bodyRows + 1),
  );
  for (const spot of await colSpots.all()) {
    await expect(spot.locator(".cm-table-boundary-insert")).toHaveCount(1);
  }
  for (const spot of await rowSpots.all()) {
    await expect(spot.locator(".cm-table-boundary-insert")).toHaveCount(1);
  }

  // 点击列热点真的插入了列（可点行为齐备）。
  const before = await table.locator("thead th").count();
  await colSpots.nth(1).click();
  const insertBtn = page.locator(
    ".cm-table-hotspot-active [data-testid='cm-table-boundary-insert']",
  );
  await expect(insertBtn).toBeVisible();
  await insertBtn.click();
  await expect(table.locator("thead th")).toHaveCount(before + 1);

  await shot(page, "hotspots-complete");
});

import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough } from "./helpers/ui-probe";
import { summonAddHandle } from "./helpers/block-handle";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/848");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/columns-picker-caption-848.md",
      "第一段正文\n\n\n第二段正文\n",
      "columns-picker-caption-848.md",
    );
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

/** 走真实指针路径：召唤新增手柄 → 常用段「分栏」行 → 5 根柱子浮层。 */
async function openColumnsPicker(page: Page): Promise<{
  menu: Locator;
  flyout: Locator;
  caption: Locator;
  count: Locator;
  cells: Locator;
}> {
  const add = page.locator(".cm-block-handle-add").first();
  await expect(add).toHaveCount(1);
  await summonAddHandle(page, add);
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1, { timeout: 3000 });

  const columnsRow = menu
    .locator('.cm-add-list[data-section="常用"] .mdb-slash-item')
    .filter({ hasText: "分栏" });
  await expect(columnsRow).toHaveCount(1);
  const rowBox = (await columnsRow.boundingBox())!;
  await moveThrough(
    page,
    [{ x: rowBox.x + rowBox.width / 2, y: rowBox.y + rowBox.height / 2 }],
    { steps: 4 },
  );

  const flyout = page.locator(".mdb-slash-flyout");
  await expect(flyout).toHaveCount(1);
  const caption = flyout.locator(".mdb-slash-grid-title");
  const count = flyout.locator(".mdb-slash-grid-label");
  const cells = flyout.locator(".mdb-slash-grid-cell");
  await expect(cells).toHaveCount(5);
  return { menu, flyout, caption, count, cells };
}

/**
 * 滑到目标柱。走 L 形：先在工作行高度横向进入浮层（说明区），再竖向滑到柱子
 * 中心。直线斜插会横跨下方「表格」行的右缘，误开表格网格（#848 实测）。
 */
async function hoverCell(
  page: Page,
  flyout: Locator,
  cells: Locator,
  index: number,
): Promise<void> {
  const entry = (await flyout.locator(".mdb-slash-grid-title").boundingBox())!;
  const box = (await cells.nth(index).boundingBox())!;
  await moveThrough(
    page,
    [
      { x: entry.x + entry.width / 2, y: entry.y + entry.height / 2 },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    ],
    { steps: 4 },
  );
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

test("新增手柄分栏弹窗：说明「选择栏目」+ 实时栏数（A-11.1 / A-11.2）", async ({
  page,
}) => {
  await openDoc(page);
  const { menu, flyout, caption, count, cells } = await openColumnsPicker(page);
  const onCells = flyout.locator('.mdb-slash-grid-cell[data-on="true"]');

  // A-11.1：说明文字节点数 = 1，文案严格为「选择栏目」。
  await expect(caption).toHaveCount(1);
  await expect(caption).toHaveText("选择栏目");
  // 初始 hoverC=1，读数与选中柱数一致。
  await expect(count).toHaveText("1");
  await expect(onCells).toHaveCount(1);
  await shot(page, "picker-open");

  // A-11.2：滑到第 3 根柱子 → 实时栏数文案严格为 "3"。
  await hoverCell(page, flyout, cells, 2);
  await expect(count).toHaveText("3");
  await expect(onCells).toHaveCount(3);
  await shot(page, "picker-hover-3");

  // 滑到第 5 根 → 读数跟随指针到 "5"。
  await hoverCell(page, flyout, cells, 4);
  await expect(count).toHaveText("5");
  await expect(onCells).toHaveCount(5);
  await shot(page, "picker-hover-5");

  // 指针移到无二级层的「公式」行 → 浮层收起，根菜单保留。
  const formulaRow = menu
    .locator('.cm-add-list[data-section="常用"] .mdb-slash-item')
    .filter({ hasText: "公式" });
  const formulaBox = (await formulaRow.boundingBox())!;
  await moveThrough(
    page,
    [
      {
        x: formulaBox.x + formulaBox.width / 2,
        y: formulaBox.y + formulaBox.height / 2,
      },
    ],
    { steps: 6 },
  );
  await expect(flyout).toHaveCount(0);
  await expect(menu).toHaveCount(1);
  await shot(page, "picker-closed");
});

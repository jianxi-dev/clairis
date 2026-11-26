import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough, SUMMON_PROBE_RATIO } from "../helpers/ui-probe";

/**
 * #1348 / E-47：块类型图标跨入口一致性。
 *
 * 表格在手柄 / 块菜单（在下方添加）/ 斜杠菜单三处同为 TableGridOutlined，
 * 引用在三处同为 FormatQuoteOutlined；渲染面不再出现 TableChartOutlined。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/1348");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const DOC = [
  "| A | B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "> 引用一行",
  "",
].join("\n");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

async function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      state,
      "--screenshot",
      `.artifacts/1348/${name}.png`,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
  return file;
}

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/icon-consistency.md",
      body,
      "icon-consistency.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

/** 文档每行文本 → 该行块手柄图标（同名行取第一个，即容器手柄）。 */
async function iconByLine(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const text = (state.tabs[state.activeTabId]?.content as string) ?? "";
    const lines = text.split("\n");
    const rows = Array.from(document.querySelectorAll(".cm-block-handle")).map(
      (h) => {
        const from = Number(h.getAttribute("data-block-from"));
        const line = text.slice(0, from).split("\n").length - 1;
        return {
          lineText: lines[line] ?? "",
          icon:
            h
              .querySelector(".cm-block-handle-icon svg")
              ?.getAttribute("data-icon") ?? null,
        };
      },
    );
    const map: Record<string, string | null> = {};
    for (const row of rows)
      if (!(row.lineText in map)) map[row.lineText] = row.icon;
    return map;
  });
}

/** 点击空行输入 `/` 打开斜杠菜单。 */
async function openSlashMenu(page: Page): Promise<Locator> {
  await page.locator(".cm-content").click();
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  return menu;
}

async function openTableBlockMenu(page: Page): Promise<Locator> {
  const table = page.locator("table.cm-table").first();
  const tableBox = (await table.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await moveThrough(
    page,
    [
      {
        x: content.left + content.width * SUMMON_PROBE_RATIO,
        y: tableBox.y + 16,
      },
    ],
    { steps: 6 },
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.click();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
  await page.locator('[data-testid="block-menu-add-below"]').hover();
  const flyout = page.locator(".mdb-slash-menu");
  await expect(flyout).toHaveCount(1, { timeout: 3000 });
  return flyout;
}

async function iconOf(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute("data-icon");
}

test("表格块:手柄 / 块菜单 / 斜杠菜单三处同为 TableGridOutlined", async ({
  page,
}) => {
  await openDoc(page);

  const handleIcons = await iconByLine(page);
  expect(handleIcons["| A | B |"]).toBe("TableGridOutlined");
  await shot(page, "01-table-handle", "table-handle");

  const slash = await openSlashMenu(page);
  expect(
    await iconOf(page, '.mdb-slash-menu .mdb-slash-item[data-cmd="table"] svg'),
  ).toBe("TableGridOutlined");
  await shot(page, "02-table-slash", "table-slash");
  await page.keyboard.press("Escape");
  await expect(slash).toHaveCount(0);

  const menu = await openTableBlockMenu(page);
  expect(
    await iconOf(page, '.mdb-slash-menu .mdb-slash-item[data-cmd="table"] svg'),
  ).toBe("TableGridOutlined");
  await shot(page, "03-table-menu", "table-menu");
  await page.locator(".cm-content").click();
  await expect(menu).toHaveCount(0);

  await expect(page.locator('svg[data-icon="TableChartOutlined"]')).toHaveCount(
    0,
  );
});

test("引用块:手柄 / 块菜单 / 斜杠菜单三处同为 FormatQuoteOutlined", async ({
  page,
}) => {
  await openDoc(page);

  const handleIcons = await iconByLine(page);
  expect(handleIcons["> 引用一行"]).toBe("FormatQuoteOutlined");
  await shot(page, "04-quote-handle", "quote-handle");

  const slash = await openSlashMenu(page);
  expect(
    await iconOf(page, '.mdb-slash-menu .mdb-slash-item[data-cmd="quote"] svg'),
  ).toBe("FormatQuoteOutlined");
  await shot(page, "05-quote-slash", "quote-slash");
  await page.keyboard.press("Escape");
  await expect(slash).toHaveCount(0);

  // 块菜单:悬停引用行召唤嵌套段落手柄,点开后「转为」网格的引用单元即引用图标。
  const quoteLine = page.locator(".cm-line").filter({ hasText: "引用一行" });
  const lineBox = (await quoteLine.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await moveThrough(
    page,
    [
      {
        x: Math.max(
          lineBox.x,
          content.left + content.width * SUMMON_PROBE_RATIO,
        ),
        y: lineBox.y + lineBox.height / 2,
      },
    ],
    { steps: 6 },
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.click();
  const menu = page.locator('[data-testid="block-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });
  expect(
    await iconOf(
      page,
      '[data-testid="block-menu-cell"][data-target="quote"] svg',
    ),
  ).toBe("FormatQuoteOutlined");
  await shot(page, "06-quote-menu", "quote-menu");
});

test("图标渲染尺寸落 18px 常规档(计算样式)", async ({ page }) => {
  await openDoc(page);
  const size = await page
    .locator(".cm-block-handle .cm-block-handle-icon svg")
    .first()
    .evaluate((el) => ({
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
    }));
  expect(size.width).toBe("18px");
  expect(size.height).toBe("18px");
  await shot(page, "07-icon-size-18", "icon-size-18");
});

import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1390";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        `.artifacts/1390/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/** 文档每行文本 → 该行块手柄图标（同名行取第一个，覆盖空行「+」与文末入口）。 */
async function iconByLine(page: Page): Promise<Map<string, string | null>> {
  const rows = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const text = (state.tabs[state.activeTabId]?.content as string) ?? "";
    const lines = text.split("\n");
    return Array.from(document.querySelectorAll(".cm-block-handle")).map(
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
  });
  const map = new Map<string, string | null>();
  for (const row of rows) {
    if (!map.has(row.lineText)) map.set(row.lineText, row.icon);
  }
  return map;
}

/** 召唤块手柄：指针移到块渲染矩形的左缘召唤区（左 10%）。 */
async function summonBlock(
  page: Page,
  widget: ReturnType<Page["locator"]>,
): Promise<void> {
  const box = (await widget.boundingBox())!;
  const contentRect = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, contentRect.left + contentRect.width * 0.1),
    box.y + box.height / 2,
    { steps: 6 },
  );
}

/** 手柄垂直中心与块渲染矩形垂直中心的偏差（px）。 */
async function centerDelta(
  page: Page,
  handle: ReturnType<Page["locator"]>,
  widget: ReturnType<Page["locator"]>,
): Promise<number> {
  const hb = (await handle.boundingBox())!;
  const wb = (await widget.boundingBox())!;
  return Math.abs(hb.y + hb.height / 2 - (wb.y + wb.height / 2));
}

test("附件手柄按扩展名显示附件类图标，不等于图片图标", async ({ page }) => {
  const doc = [
    "![spec](assets/spec.pdf)",
    "",
    "![notes](assets/notes.md)",
    "",
    "![report](assets/report.docx)",
    "",
    "![bundle](assets/bundle.zip)",
    "",
    "![pic](assets/pic.png)",
  ].join("\n");
  await openMarkdownInEdit(page, doc, "handle-icon-file");

  const icons = await iconByLine(page);
  const refs: Record<string, string> = {
    "![spec](assets/spec.pdf)": "FilePdfOutlined",
    "![notes](assets/notes.md)": "FileMarkdownOutlined",
    "![report](assets/report.docx)": "FileWordOutlined",
    "![bundle](assets/bundle.zip)": "FileZipOutlined",
  };
  for (const [ref, icon] of Object.entries(refs)) {
    expect(icons.get(ref), ref).toBe(icon);
  }
  const pic = icons.get("![pic](assets/pic.png)");
  expect(pic).toBe("ImageOutlined");
  for (const ref of Object.keys(refs)) {
    expect(icons.get(ref), ref).not.toBe(pic);
  }

  // pdf / md 附件默认内嵌且很高，后面的卡片在首屏之下；召唤首块（pdf 附件）手柄出镜。
  const firstLine = page.locator(".cm-line").first();
  await hoverLineLeft(page, firstLine);
  await expect(page.locator(".cm-block-handle-visible")).toHaveCount(1, {
    timeout: 3000,
  });
  await expect(
    page.locator(".cm-block-handle-visible .cm-block-handle-icon svg"),
  ).toHaveAttribute("data-icon", "FilePdfOutlined");
  await shot(page, "01-file-ext-icon-map", "file-ext-icon-map");
});

test("表格手柄垂直居中于卡片矩形，不落左上角", async ({ page }) => {
  const doc = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
  await openMarkdownInEdit(page, doc, "handle-icon-table-center");

  const tableHandle = page.locator(
    '.cm-block-handle:has(svg[data-icon="TableGridOutlined"])',
  );
  await expect(tableHandle).toHaveCount(1);
  const tableWidget = page.locator(".cm-table-wrap");

  await summonBlock(page, tableWidget);
  await expect(tableHandle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  const tableDelta = await centerDelta(page, tableHandle, tableWidget);
  expect(tableDelta).toBeLessThanOrEqual(2);
  const tb = (await tableHandle.boundingBox())!;
  const tw = (await tableWidget.boundingBox())!;
  expect(tb.y).toBeGreaterThan(tw.y);

  await shot(page, "02-widget-handle-vcenter", "widget-handle-vcenter");
});

test("高亮块手柄垂直居中于卡片矩形，不落左上角", async ({ page }) => {
  const doc = ["> [!NOTE] 标题", "> 正文第一行", "> 正文第二行"].join("\n");
  await openMarkdownInEdit(page, doc, "handle-icon-callout-center");

  const calloutHandle = page.locator(
    '.cm-block-handle:has(svg[data-icon="CalloutOutlined"])',
  );
  await expect(calloutHandle).toHaveCount(1);
  const calloutWidget = page.locator(".cm-callout");

  await summonBlock(page, calloutWidget);
  await expect(calloutHandle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  const calloutDelta = await centerDelta(page, calloutHandle, calloutWidget);
  expect(calloutDelta).toBeLessThanOrEqual(2);
  const cb = (await calloutHandle.boundingBox())!;
  const cw = (await calloutWidget.boundingBox())!;
  expect(cb.y).toBeGreaterThan(cw.y);

  await shot(page, "03-callout-handle-vcenter", "callout-handle-vcenter");
});

test("有序与无序列表手柄 data-icon 严格不相等（含 ')' 分隔符）", async ({
  page,
}) => {
  const doc = ["1. 点有序", "", "1) 括号有序", "", "- 无序"].join("\n");
  await openMarkdownInEdit(page, doc, "handle-icon-ordered");

  const contentRect = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { top: rect.top, right: rect.right };
  });

  const readIcon = async (text: string): Promise<string> => {
    // 先移进编辑器右缘（召唤区外）收掉旧手柄，避免 300ms 显现延迟里读到上一个块的图标。
    await page.mouse.move(contentRect.right - 24, contentRect.top + 40, {
      steps: 3,
    });
    await expect(page.locator(".cm-block-handle-visible")).toHaveCount(0);
    const line = page.locator(".cm-line").filter({ hasText: text }).first();
    await hoverLineLeft(page, line);
    await expect(page.locator(".cm-block-handle-visible")).toHaveCount(1, {
      timeout: 3000,
    });
    return page
      .locator(".cm-block-handle-visible .cm-block-handle-icon svg")
      .getAttribute("data-icon");
  };

  expect(await readIcon("点有序")).toBe("OrderListOutlined");
  expect(await readIcon("括号有序")).toBe("OrderListOutlined");
  const bulletIcon = await readIcon("无序");
  expect(bulletIcon).toBe("DisorderListOutlined");

  await shot(
    page,
    "04-ordered-unordered-icon-distinct",
    "ordered-unordered-icon-distinct",
  );
});

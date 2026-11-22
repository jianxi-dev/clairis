import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = path.resolve(process.cwd(), ".artifacts/1347");
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
        path.relative(process.cwd(), file),
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return (state.tabs[state.activeTabId]?.content as string) ?? "";
  });
}

/** 真实指针拖拽：把 handleFrom 的块拖到 targetLine 上沿松手。 */
async function dragBeforeLine(
  page: Page,
  handleFrom: number,
  targetLine: ReturnType<Page["locator"]>,
): Promise<void> {
  const handle = page.locator(
    `.cm-block-handle[data-block-from="${handleFrom}"]`,
  );
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  const from = await handle.boundingBox();
  const target = await targetLine.boundingBox();
  if (!from || !target) throw new Error("缺少可测量的布局盒");

  await page.mouse.move(from.x + from.width - 6, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width - 6, from.y - 20, { steps: 4 });
  // 落点取行首字符内：整行宽 1080px，x+40 会越过短文本落到块尾，
  // 使 computeDropTarget 判成「贴前一块下沿」而非「插到该块之前」。
  await page.mouse.move(target.x + 8, target.y + 4, { steps: 8 });
  await page.mouse.up();
}

test("拖第 2 段到第 1 段前：除两段外其余字节不变，一次撤销还原", async ({
  page,
}) => {
  const doc = "第一段\n\n第二段\n\n第三段  \n\n\n\n尾段";
  await openMarkdownInEdit(page, doc, "move-block-local");
  expect(await storeContent(page)).toBe(doc);
  await shot(page, "01-before-drag", "before-drag");

  const second = page.locator(".cm-line").filter({ hasText: "第二段" }).first();
  await hoverLineLeft(page, second);
  const first = page.locator(".cm-line").filter({ hasText: "第一段" }).first();
  await dragBeforeLine(page, 5, first);

  const after = await storeContent(page);
  expect(after).toBe("第二段\n\n第一段\n\n第三段  \n\n\n\n尾段");
  // 除两段外文档其余字节严格等于操作前（差异字符数为 0）。
  const strip = (s: string) =>
    s.replaceAll("第一段", "").replaceAll("第二段", "");
  expect(strip(after)).toBe(strip(doc));
  expect(after.slice(after.indexOf("第三段"))).toBe(
    doc.slice(doc.indexOf("第三段")),
  );
  await shot(page, "02-after-drop", "after-drop");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Meta+z");
  await expect.poll(() => storeContent(page)).toBe(doc);
  await shot(page, "03-undo", "undo");
});

test("特殊空白不因拖块被规范化：多空行 / 块尾双空格 / 文末换行", async ({
  page,
}) => {
  const doc = "甲\n\n\n\n乙\n\n丙  \n";
  await openMarkdownInEdit(page, doc, "move-block-special");
  expect(await storeContent(page)).toBe(doc);

  const yi = page.locator(".cm-line").filter({ hasText: "乙" }).first();
  await hoverLineLeft(page, yi);
  const jia = page.locator(".cm-line").filter({ hasText: "甲" }).first();
  await dragBeforeLine(page, 5, jia);

  const after = await storeContent(page);
  expect(after).toBe("乙\n\n甲\n\n\n\n丙  \n");
  expect(after.slice(after.indexOf("甲"))).toBe("甲\n\n\n\n丙  \n");
  await shot(page, "04-special-whitespace", "special-whitespace");
});

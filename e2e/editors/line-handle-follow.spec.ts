import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1388";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

/** 断言通过后截图，并把该态记进 state-coverage.json（QG-5 manifest）。 */
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
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/**
 * 1.1 行手柄渲染与跟行走。
 *
 * 文本行块按文档行拆行手柄：每行一个、贴住行盒、随指针行与滚动跟随；
 * 连续输入只重算几何不重建 DOM；表格 / 代码块等非文本行块不产生行手柄。
 */

const LINE_HANDLES = ".cm-block-handle[data-line-from]";
const BLOCK_ONLY_HANDLES =
  ".cm-block-handle:not([data-line-from]):not([data-empty]):not([data-trailing])";

/** 当前显现的行手柄 data-line-from 列表（按文档行起点升序）。 */
async function visibleLineFroms(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        ".cm-block-handle[data-line-from].cm-block-handle-visible",
      ),
    )
      .map((el) => Number(el.dataset.lineFrom))
      .sort((a, b) => a - b),
  );
}

async function lineHandleKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        ".cm-block-handle[data-line-from]",
      ),
    ).map((el) => el.dataset.handleKey ?? ""),
  );
}

test("多行段落每行一个手柄，贴住行盒并随指针行 / 滚动跟随", async ({
  page,
}) => {
  // 多行段落放在长文档中部：上下留有足够内容，滚动真实生效且段落仍在视口内。
  const prefix = Array.from({ length: 6 }, (_, i) => `前文 ${i + 1}`).join(
    "\n\n",
  );
  const suffix = Array.from({ length: 30 }, (_, i) => `后文 ${i + 1}`).join(
    "\n\n",
  );
  const doc = `${prefix}\n\n第一行\n第二行\n第三行\n\n${suffix}`;
  await openMarkdownInEdit(page, doc, "line-follow");

  const texts = ["第一行", "第二行", "第三行"];
  const lineFroms = [prefix.length + 2, prefix.length + 6, prefix.length + 10];
  const handleOf = (i: number) =>
    page.locator(`.cm-block-handle[data-line-from="${lineFroms[i]}"]`);
  const lineOf = (i: number) =>
    page.locator(".cm-line").filter({ hasText: texts[i] }).first();

  for (let i = 0; i < 3; i += 1) {
    await expect(handleOf(i)).toHaveCount(1);
    await hoverLineLeft(page, lineOf(i));
    // 只显现指针所在行的行手柄。
    await expect.poll(() => visibleLineFroms(page)).toEqual([lineFroms[i]]);
    const handleBox = await handleOf(i).boundingBox();
    const lineBox = await lineOf(i).boundingBox();
    if (!handleBox || !lineBox) throw new Error("行盒或手柄盒取不到");
    expect(Math.abs(handleBox.y - lineBox.y)).toBeLessThanOrEqual(1);
    if (i === 1) {
      await shot(
        page,
        "01-multi-line-handle-per-line",
        "multi-line-handle-per-line",
      );
    }
  }

  // 滚动后手柄仍贴住所在行（跟行走，不残留旧位置）。
  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop = 150;
  });
  await hoverLineLeft(page, lineOf(1));
  await expect.poll(() => visibleLineFroms(page)).toEqual([lineFroms[1]]);
  await expect
    .poll(async () => {
      const handleBox = await handleOf(1).boundingBox();
      const lineBox = await lineOf(1).boundingBox();
      return handleBox && lineBox ? Math.abs(handleBox.y - lineBox.y) : 999;
    })
    .toBeLessThanOrEqual(1);
  await shot(page, "02-scroll-follow", "scroll-follow");
});

test("连续输入：行手柄贴住对应行且不重建 DOM", async ({ page }) => {
  await openMarkdownInEdit(page, "第一行\n第二行\n第三行", "line-typing");

  const handles = page.locator(LINE_HANDLES);
  await hoverLineLeft(page, page.locator(".cm-line").first());
  await expect.poll(() => visibleLineFroms(page)).toEqual([0]);

  const keysBefore = (await lineHandleKeys(page)).sort();
  expect(keysBefore).toHaveLength(3);
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>(".cm-block-handle[data-line-from]")
      .forEach((el) => el.setAttribute("data-probe", "typing"));
  });

  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type("abcdefghij", { delay: 10 });

  await expect(handles).toHaveCount(3);
  expect((await lineHandleKeys(page)).sort()).toEqual(keysBefore);
  const probed = await page.evaluate(
    () =>
      document.querySelectorAll('.cm-block-handle[data-probe="typing"]').length,
  );
  expect(probed).toBe(3);
  // 无残留旧手柄：总数 = 3 行手柄 + 1 文末「+」。
  await expect(page.locator(".cm-block-handle")).toHaveCount(4);

  await hoverLineLeft(page, page.locator(".cm-line").first());
  await expect.poll(() => visibleLineFroms(page)).toEqual([0]);
  for (let i = 0; i < 3; i += 1) {
    const handleBox = await handles.nth(i).boundingBox();
    const lineBox = await page.locator(".cm-line").nth(i).boundingBox();
    if (!handleBox || !lineBox) throw new Error("行盒或手柄盒取不到");
    expect(Math.abs(handleBox.y - lineBox.y)).toBeLessThanOrEqual(1);
  }
  await shot(page, "03-typing-no-rebuild", "typing-no-rebuild");
});

test("表格 / 代码块不产生行级手柄，仍按块显示", async ({ page }) => {
  const doc = [
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "```",
    "code",
    "```",
    "",
    "<div>x</div>",
  ].join("\n");
  await openMarkdownInEdit(page, doc, "line-nontext");

  await expect(page.locator(LINE_HANDLES)).toHaveCount(0);
  await expect(page.locator(BLOCK_ONLY_HANDLES)).toHaveCount(3);

  const tableHandle = page.locator('.cm-block-handle[data-block-from="0"]');
  await expect(tableHandle).toHaveCount(1);
  await expect(tableHandle).not.toHaveAttribute("data-line-from", /./);

  const table = page.locator("table.cm-table").first();
  const tableBox = (await table.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(tableBox.x, content.left + content.width * 0.1),
    tableBox.y + 16,
    { steps: 6 },
  );
  await expect(tableHandle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  await expect(page.locator(LINE_HANDLES)).toHaveCount(0);
  await shot(
    page,
    "04-table-code-block-level-only",
    "table-code-block-level-only",
  );
});

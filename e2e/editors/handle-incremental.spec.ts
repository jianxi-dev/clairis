import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = path.resolve(process.cwd(), ".artifacts/1353");
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
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function renderedHandleKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".cm-block-handle"))
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => el.dataset.handleKey ?? ""),
  );
}

async function allHandleKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".cm-block-handle")).map(
      (el) => el.dataset.handleKey ?? "",
    ),
  );
}

async function displayOf(page: Page, key: string): Promise<string> {
  return page
    .locator(`[data-handle-key="${key}"]`)
    .first()
    .evaluate((el) => getComputedStyle(el).display);
}

test("长段落连续输入 10 次：手柄标识集合不变且贴住块首行行盒", async ({
  page,
}) => {
  const paragraph = "这是一段足够长的正文用来在编辑区里折成多行".repeat(3);
  await openMarkdownInEdit(page, `${paragraph}\n\n第二段`, "hi-typing");

  const handle = page.locator('[data-block-from="0"]');
  await expect(handle).toHaveCount(1);
  const keyBefore = await handle.getAttribute("data-handle-key");
  if (!keyBefore) throw new Error("手柄缺少 data-handle-key");
  const keysBefore = (await allHandleKeys(page)).sort();
  await handle.evaluate((el) => el.setAttribute("data-probe", "typing"));

  await hoverLineLeft(page, page.locator(".cm-line").first());
  await shot(page, "01-default", "default");

  await page.locator(".cm-line").first().click();
  await page.keyboard.type("abcdefghij", { delay: 15 });

  await expect(handle).toHaveCount(1);
  expect(await handle.getAttribute("data-handle-key")).toBe(keyBefore);
  expect(await handle.getAttribute("data-probe")).toBe("typing");
  expect((await allHandleKeys(page)).sort()).toEqual(keysBefore);

  const lineBox = await page.locator(".cm-line").first().boundingBox();
  const handleBox = await handle.boundingBox();
  if (!lineBox || !handleBox) throw new Error("行盒或手柄盒取不到");
  expect(Math.abs(handleBox.y - lineBox.y)).toBeLessThanOrEqual(1);

  await shot(page, "02-typing", "typing");
});

test("段落转标题再插新段：仅受影响块及其后手柄被替换", async ({ page }) => {
  await openMarkdownInEdit(page, "第一段\n\n第二段\n\n第三段", "hi-convert");
  const affectedFrom = 5;
  const before = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".cm-block-handle")).map(
      (el) => ({ from: Number(el.dataset.blockFrom) }),
    ),
  );
  const affectedIndex = before.findIndex((h) => h.from === affectedFrom);
  expect(affectedIndex).toBeGreaterThan(0);
  await page
    .locator(".cm-block-handle")
    .evaluateAll((els) =>
      els.forEach((el) => el.setAttribute("data-probe", "sentinel")),
    );

  await page.locator(".cm-line").filter({ hasText: "第二段" }).first().click();
  await page.keyboard.press("Home");
  await page.keyboard.type("# ");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("新段落");

  const retained = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".cm-block-handle"))
      .filter((el) => el.hasAttribute("data-probe"))
      .map((el) => Number(el.dataset.blockFrom)),
  );
  const expected = before
    .slice(0, affectedIndex)
    .map((h) => h.from)
    .sort((a, b) => a - b);
  expect(retained.sort((a, b) => a - b)).toEqual(expected);
  expect(retained.length).toBeGreaterThan(0);

  const headingKey = await page
    .locator(`[data-block-from="${affectedFrom}"]`)
    .getAttribute("data-handle-key");
  expect(headingKey).toBe(`${affectedIndex}:heading:H1Outlined:line:3`);

  await shot(page, "03-convert-insert", "convert-insert");
});

test("块滚出视口后该块手柄隐藏，滚回恢复且无残留", async ({ page }) => {
  const doc = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 段正文`).join(
    "\n\n",
  );
  await openMarkdownInEdit(page, doc, "hi-scroll");

  const target = page.locator(".cm-block-handle").nth(2);
  const key = await target.getAttribute("data-handle-key");
  if (!key) throw new Error("手柄缺少 data-handle-key");

  await expect.poll(() => displayOf(page, key)).not.toBe("none");
  await hoverLineLeft(
    page,
    page.locator(".cm-line").filter({ hasText: "第 2 段正文" }).first(),
  );
  await shot(page, "04-hover", "hover");

  await page.mouse.move(600, 400);
  for (let i = 0; i < 25; i += 1) await page.mouse.wheel(0, 400);

  await expect.poll(() => displayOf(page, key)).toBe("none");
  await expect
    .poll(async () => (await renderedHandleKeys(page)).includes(key))
    .toBe(false);
  await shot(page, "05-scrolled-out", "scrolled-out");

  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop = 0;
  });
  await expect.poll(() => displayOf(page, key)).not.toBe("none");
  await expect(page.locator(`[data-handle-key="${key}"]`)).toHaveCount(1);
});

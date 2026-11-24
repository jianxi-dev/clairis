import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1393";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const DOC = "> [!NOTE] 标题\n> 正文";

test.beforeEach(() => {
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
        `.artifacts/1393/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openCallout(page: Page): Promise<void> {
  await openMarkdownInEdit(page, DOC, "callout-color-entry");
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await card.locator(".cm-callout-content").click();
  await expect(page.locator('[data-testid="callout-color-bar"]')).toBeVisible();
}

test("点击高亮块浮条出现颜色图标，点开为三色面板", async ({ page }) => {
  await openCallout(page);
  const bar = page.locator('[data-testid="callout-color-bar"]');
  await expect(bar.locator('[data-testid="callout-color-entry"]')).toHaveCount(
    1,
  );
  await shot(page, "01-color-entry-icon", "color-entry-icon");

  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel).toBeVisible();
  await expect(panel.locator(".cm-color-row")).toHaveCount(3);
  await expect(panel.locator(".cm-color-row-label")).toHaveText([
    "字体颜色",
    "边框颜色",
    "填充颜色",
  ]);
  await expect(panel.locator('[data-testid="color-reset"]')).toHaveText(
    "恢复默认",
  );
  await shot(page, "02-three-color-panel", "three-color-panel");
});

test("改填充色写回首行并可一步撤销", async ({ page }) => {
  await openCallout(page);
  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await panel.locator('[data-class-name="mdb-bg-green"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("> [!NOTE]{bg=green} 标题\n> 正文");
  const card = page.locator(".cm-callout").first();
  await expect
    .poll(async () =>
      card.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--callout-bg").trim(),
      ),
    )
    .toContain("color-mix");

  await page.evaluate(() => {
    (document.querySelector(".cm-content") as HTMLElement).focus();
  });
  await page.keyboard.press(`${MOD}+Z`);
  await expect.poll(() => storeContent(page)).toBe(DOC);
  await shot(page, "03-one-undo-restore", "one-undo-restore");
});

test("浮条只有「颜色」一个按钮，无类型切换入口", async ({ page }) => {
  await openCallout(page);
  const bar = page.locator('[data-testid="callout-color-bar"]');
  await expect(bar.locator(".cm-callout-bar-btn")).toHaveCount(1);
  await expect(bar.locator('[data-testid="callout-color-entry"]')).toHaveCount(1);
  await expect(
    bar.locator('[data-testid="callout-type-entry"]'),
  ).toHaveCount(0);
  await shot(page, "04-no-type-entry", "no-type-entry");
});

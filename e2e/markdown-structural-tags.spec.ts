import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #255：未知结构标签独占行会触发 CommonMark type-7 HTML block，把紧随其后的
 * `## 标题` / 表格行吞成字面文本。预览必须清理这些行；语义编辑态隐藏；
 * 源码模式保留。
 */

const APP_URL = "http://localhost:1420";
const FIXTURE = path.resolve(process.cwd(), "e2e/fixtures/structural-tags.md");
const ART = path.resolve(process.cwd(), ".artifacts/263");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openFixture(page: Page): Promise<void> {
  const content = readFileSync(FIXTURE, "utf8");
  await page.evaluate(
    ({ p, c }) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (
            path: string,
            content: string,
            title: string,
          ) => void;
        }
      ).__biaoyue_openFile__(p, c, "structural-tags");
    },
    { p: FIXTURE, c: content },
  );
  await expect(page.locator(".preview-content").first()).toBeVisible({
    timeout: 10000,
  });
}

test("预览：结构标签不吞标题与表格", async ({ page }) => {
  await boot(page);
  await openFixture(page);

  const preview = page.locator(".preview-content").first();
  await expect(preview.locator("h2", { hasText: "核心原则" })).toHaveCount(1);
  await expect(preview.locator("h2", { hasText: "意图路由" })).toHaveCount(1);
  await expect(preview.locator("table")).toHaveCount(3);

  const text = await preview.innerText();
  expect(text).not.toMatch(/^\s*#{1,6}\s/m);
  expect(text).not.toContain("essential_principles");
  expect(text).not.toContain("</objective>");
  expect(text).not.toContain("|----------|");
  // 围栏内的同名标签是代码内容，必须可见
  await expect(preview.locator("code", { hasText: "fenced_tag" })).toHaveCount(
    1,
  );

  await page.screenshot({ path: path.join(ART, "preview.png") });
});

test("编辑态隐藏结构标签行，源码模式保留", async ({ page }) => {
  await boot(page);
  await openFixture(page);

  await page.locator('[data-testid="pane-mode"]').first().click();
  await expect(
    page.locator('[data-testid="pane-mode"]').first(),
  ).toHaveAttribute("data-mode", "edit");

  const content = page.locator(".cm-content").first();
  await expect(content).toBeVisible();
  await expect
    .poll(() => content.innerText())
    .not.toContain("essential_principles");
  expect(await content.innerText()).toContain("核心原则");
  expect(await content.innerText()).toContain("fenced_tag");

  await page.screenshot({ path: path.join(ART, "edit.png") });

  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await page.locator('[data-menu-item="source"]').click();
  await expect(content).toBeVisible();
  await expect
    .poll(() => content.innerText())
    .toContain("essential_principles");

  await page.screenshot({ path: path.join(ART, "source.png") });
});

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1524";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

async function setup(page: Page, doc: string) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const src = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 2000;
    c.height = 1400;
    const x = c.getContext("2d")!;
    x.fillStyle = "#336699";
    x.fillRect(0, 0, 2000, 1400);
    return c.toDataURL("image/png");
  });
  await page.evaluate(
    ({ doc: d, src }) => {
      const w = window as unknown as BW;
      w.__biaoyue_openFile__("/tmp/reset/reset.md", d.replaceAll("@SRC@", src), "reset.md");
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, src },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget img").first().waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const i = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!i && i.complete && i.naturalWidth > 0;
  });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const st = (window as unknown as BW).__biaoyue_store__.getState() as unknown as {
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

test("已裁剪图片：重置按钮清除 crop 并还原整图尺寸", async ({ page }) => {
  await setup(page, "![图](@SRC@){crop=200,200,1200,1000 width=600 height=500}\n");
  await page.locator(".cm-image-widget").first().click();
  const reset = page.getByTestId("img-toolbar-reset");
  await expect(reset).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/01-before-reset.png` });

  expect(await content(page)).toContain("crop=");
  await reset.click();
  await expect.poll(() => content(page), { timeout: 4000 }).not.toContain("crop=");
  await page.screenshot({ path: `${OUT}/02-after-reset.png` });

  const doc = await content(page);
  const width = Number(/width=(\d+)/.exec(doc)?.[1] ?? 0);
  expect(width).toBeGreaterThan(600);

  await page.locator(".cm-image-widget").first().click();
  await expect(page.getByTestId("img-toolbar-reset")).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-after-reset-selected.png` });
});

test("未裁剪图片：重置不改变文档", async ({ page }) => {
  await setup(page, "![图](@SRC@)\n");
  await page.locator(".cm-image-widget").first().click();
  const before = await content(page);
  await page.getByTestId("img-toolbar-reset").click();
  await page.waitForTimeout(300);
  expect(await content(page)).toBe(before);
  await page.screenshot({ path: `${OUT}/03-no-crop-noop.png` });
});

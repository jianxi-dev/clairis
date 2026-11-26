import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1523";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: {
    getState: () => {
      setEditorMode: (m: string) => void;
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
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
      w.__biaoyue_openFile__("/tmp/max/max.md", d.replaceAll("@SRC@", src), "max.md");
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
    const st = (window as unknown as BW).__biaoyue_store__.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

test("放大层有重置图片；点击后清 crop 并关闭", async ({ page }) => {
  await setup(page, "![图](@SRC@){crop=200,200,1200,1000 width=600 height=500}\n");
  await page.locator(".cm-image-widget").first().dblclick();
  const overlay = page.locator('[data-testid="img-maximize"]');
  await expect(overlay).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/01-maximize-open.png` });

  const reset = page.locator('[data-testid="img-max-clear-crop"]');
  await expect(reset).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-reset-button.png` });

  expect(await content(page)).toContain("crop=");
  await reset.click();
  await expect(overlay).toBeHidden({ timeout: 3000 });
  await expect.poll(() => content(page), { timeout: 4000 }).not.toContain("crop=");
  await page.screenshot({ path: `${OUT}/03-after-reset.png` });

  await page.locator(".cm-image-widget").first().dblclick();
  await expect(page.locator('[data-testid="img-maximize"]')).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-remaximize.png` });
});

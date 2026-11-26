import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.MEDIA_APP_URL ?? "http://localhost:1424";

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: {
    getState: () => { setEditorMode: (mode: string) => void };
  };
  __biaoyue_file_sizes__: Record<string, number>;
  __open_external_calls__: string[];
  __biaoyue_imported_media_bytes__: unknown[];
}

async function openDoc(
  page: Page,
  name: string,
  doc: string,
  sizes: Record<string, number> = {},
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((map: Record<string, number>) => {
    const w = window as unknown as BridgeWindow;
    w.__biaoyue_file_sizes__ = map;
    w.__open_external_calls__ = [];
  }, sizes);
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ name, doc }) => {
      const w = window as unknown as BridgeWindow;
      w.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { name, doc },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test("非图片附件渲染成附件卡：类型图标 + 文件名 + 非空大小", async ({
  page,
}) => {
  await openDoc(page, "m22zip", "![归档](assets/archive.zip)\n", {
    "/tmp/m22zip/assets/archive.zip": 12897485,
  });
  const card = page.locator('[data-testid="media-attachment"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator("svg[data-icon]")).toHaveCount(1);
  await expect(card.locator("svg[data-icon]")).toHaveAttribute(
    "data-icon",
    "text",
  );
  await expect(
    card.locator('[data-testid="media-attachment-name"]'),
  ).toHaveText("archive.zip");
  await expect(
    card.locator('[data-testid="media-attachment-size"]'),
  ).toHaveText("12.30MB");
});

test("点击附件卡调用系统打开 1 次", async ({ page }) => {
  await openDoc(page, "m22click", "![归档](assets/archive.zip)\n", {
    "/tmp/m22click/assets/archive.zip": 1536,
  });
  const card = page.locator('[data-testid="media-attachment"]');
  await expect(card).toHaveCount(1);
  await card.click();
  const calls = await page.evaluate(
    () => (window as unknown as BridgeWindow).__open_external_calls__,
  );
  expect(calls).toEqual(["/tmp/m22click/assets/archive.zip"]);
});

test("音频渲染成 <audio controls>，不再退化成链接", async ({ page }) => {
  await openDoc(page, "m22audio", "![song](assets/song.mp3)\n");
  const container = page.locator('.cm-media-widget[data-media-kind="audio"]');
  await expect(container).toHaveCount(1);
  const audio = container.locator("audio");
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveJSProperty("controls", true);
  await expect(audio).toHaveAttribute("src", /^media:\/\//);
  await expect(page.locator('[data-testid="media-unresolved"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="media-attachment"]')).toHaveCount(0);
});

test("pdf / md / html 仍内嵌，不出附件卡", async ({ page }) => {
  await openDoc(
    page,
    "m22embed",
    "![a](assets/a.pdf)\n\n![b](assets/b.md)\n\n![c](assets/c.html)\n",
  );
  await expect(page.locator(".cm-embed-widget")).toHaveCount(3);
  await expect(page.locator('[data-testid="media-attachment"]')).toHaveCount(0);
});

test("附件不复制入库：无导入副本", async ({ page }) => {
  await openDoc(page, "m22nocopy", "![归档](assets/archive.zip)\n");
  await expect(page.locator('[data-testid="media-attachment"]')).toHaveCount(1);
  const imported = await page.evaluate(
    () =>
      (window as unknown as BridgeWindow).__biaoyue_imported_media_bytes__ ?? [],
  );
  expect(imported).toEqual([]);
});

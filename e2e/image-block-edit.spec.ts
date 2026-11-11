import { test, expect, type Page } from "@playwright/test";

/**
 * 图片属性块编辑（#651）：拖拽改宽写入 `{width=N}`，路径里的 `(1)` 不被破坏。
 *
 * 旧实现把 `<!--w=N-->` 写在 `)` 后面，但 `[^)]+` 正则会在路径里的 `(1)`
 * 处截断，注释落进 URL。这里用真实拖拽验证：路径完整 + 属性块写对位置。
 */

interface BridgeState {
  setEditorMode: (mode: string) => void;
  tabs: Record<string, { content: string }>;
  activeTabId: string;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

async function openEditor(
  page: Page,
  doc: string,
  name: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("拖拽改宽：路径含括号的图片保持路径完整并写入 {width=", async ({
  page,
}) => {
  // alt 取长一点：悬停工具条压在容器左上角，图片太窄时把手会被工具条盖住
  // （既有 UI 限制，与本票无关），拖不到。
  await openEditor(
    page,
    "![带括号的图片实例](assets/image%20(1).png)\n",
    "imgparen",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);
  await expect(page.locator('.cm-content img[src^="asset://"]')).toHaveCount(1);

  const handle = page.locator('[data-testid="cm-image-resize"]');
  await expect(handle).toHaveCount(1);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toContain("{width=");
  const final = await content(page);
  expect(final).toContain("assets/image%20(1).png");
  expect(final).not.toContain("assets/image%20(1)<!--");
  expect(final).toMatch(
    /!\[带括号的图片实例\]\(assets\/image%20\(1\)\.png\)\{width=\d+\}/,
  );
});

test("拖拽改宽保留已有 height/align，只改宽度", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){width=200 height=120 align=left}\n",
    "imgkeep",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);

  const handle = page.locator('[data-testid="cm-image-resize"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
    steps: 4,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toContain("{width=");
  const final = await content(page);
  expect(final).toContain("height=120");
  expect(final).toContain("align=left");
  expect(final).not.toContain("width=200");
});

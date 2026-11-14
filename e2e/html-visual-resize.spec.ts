import { test, expect, type Frame, type Page } from "@playwright/test";

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif}div{padding:16px;border:1px solid #ddd;margin:0 120px}",
  "</style></head><body><div>区块内容</div></body></html>",
].join("");

async function openVisual(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/rz/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(1);
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

// tooltip 系统在 hover 时会把 iframe 的 title 转成 data-tip，按 title 选择器
// 在首次悬停后就失效；改用 frame 列表按 URL 取。
function visualFrame(page: Page): Frame {
  const frame = page.frames().find((f) => f.url() === "about:srcdoc");
  if (!frame) throw new Error("HTML 可视化编辑 frame 未就绪");
  return frame;
}

test("选中区块后拖右下角手柄调整宽高", async ({ page }) => {
  await openVisual(page);
  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await frame.locator("div").first().click();

  const handle = page.locator('[data-testid="html-resize-se"]');
  await expect(handle).toHaveCount(1);
  const box = await handle.boundingBox();
  if (!box) throw new Error("手柄不可测量");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 74, box.y + 54, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => content(page)).toMatch(/width:\s*\d+px/);
  const next = await content(page);
  expect(next).toMatch(/height:\s*\d+px/);
  expect(next).not.toContain("data-cm-");
});

// ── #759：尺寸拖拽稳定（指针捕获 + guide 四值 + 恢复尺寸） ──

test("e 边拖 100px：元素宽度 +100±2（A-7.1）", async ({ page }) => {
  await openVisual(page);
  const frame = visualFrame(page);
  await frame.locator("div").first().click();

  const node = frame.locator('[data-cm-node-id="div:0"]');
  const before = await node.evaluate((el) => el.getBoundingClientRect().width);

  const handle = page.locator('[data-testid="html-resize-e"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 100, hb.y + hb.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toMatch(/width:\s*\d+px/);
  const written = Number(/width:\s*(\d+)px/.exec(await content(page))![1]);
  expect(Math.abs(written - before - 100)).toBeLessThanOrEqual(2);
});

test("w 边向左拖 60px：guide left -60±2（A-7.2）", async ({ page }) => {
  await openVisual(page);
  const frame = visualFrame(page);
  await frame.locator("div").first().click();

  const guide = page.locator('[data-testid="html-resize-guides"]');
  await expect(guide).toBeVisible();
  const before = await guide.evaluate((el) => el.getBoundingClientRect().left);

  const handle = page.locator('[data-testid="html-resize-w"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 60, hb.y + hb.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  const after = await guide.evaluate((el) => el.getBoundingClientRect().left);
  expect(Math.abs(after - before + 60)).toBeLessThanOrEqual(2);
});

test("pointercancel 结束拖拽：guide 节点清零（A-7.3）", async ({ page }) => {
  await openVisual(page);
  const frame = visualFrame(page);
  await frame.locator("div").first().click();

  const guide = page.locator('[data-testid="html-resize-guides"]');
  await expect(guide).toBeVisible();

  const handle = page.locator('[data-testid="html-resize-se"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 24, hb.y + hb.height / 2 + 24, {
    steps: 4,
  });
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="html-resize-se"]')
      ?.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
  });

  await expect(guide).toHaveCount(0);
});

test("恢复尺寸：清除 inline 宽高（A-7.3）", async ({ page }) => {
  await openVisual(page);
  const frame = visualFrame(page);
  await frame.locator("div").first().click();

  const handle = page.locator('[data-testid="html-resize-se"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2 + 30, {
    steps: 6,
  });
  await page.mouse.up();

  const reset = page.locator('button[aria-label="恢复尺寸"]');
  await expect(reset).toBeVisible();
  await reset.click();

  await expect.poll(() => content(page)).not.toMatch(/width:\s*\d+px/);
  await expect
    .poll(async () => {
      const el = frame.locator('[data-cm-node-id="div:0"]');
      if ((await el.count()) === 0) return "missing";
      return await el.evaluate((n) => (n as HTMLElement).style.width);
    })
    .toBe("");
});

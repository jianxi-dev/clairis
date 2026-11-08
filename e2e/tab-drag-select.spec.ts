import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const SPLIT_RIGHT = "Control+Alt+ArrowRight";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFile(page: Page, p: string): Promise<void> {
  await page.evaluate((file) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__(
      file,
      `# ${file}\n\n正文段落，用于检查拖拽时的文字选择。`,
      "doc",
    );
  }, p);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

function selectionLength(page: Page): Promise<number> {
  return page.evaluate(() => window.getSelection()?.toString().length ?? 0);
}

function dragFlag(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    document.documentElement.getAttribute("data-tab-drag"),
  );
}

test("拖拽页签经过正文不选中文字", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/tds/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => page.locator("[data-pane-id]").count()).toBe(2);
  await openFile(page, "/tmp/tds/b.md");

  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  const box = await tab.boundingBox();
  if (!box) throw new Error("页签不可测量");
  const target = page.locator("[data-pane-id]").last();
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("目标栏不可测量");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, {
    steps: 3,
  });
  await expect.poll(() => dragFlag(page)).toBe("true");

  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );
  expect(await selectionLength(page)).toBe(0);

  await page.mouse.up();
  await expect.poll(() => dragFlag(page)).toBeNull();
  expect(await selectionLength(page)).toBe(0);
});

test("只有聚焦栏的活动页签保留类型色，栏目聚焦无蓝框", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/tds/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => page.locator("[data-pane-id]").count()).toBe(2);
  await openFile(page, "/tmp/tds/b.md");

  const focused = await page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: { getState: () => { focusedPaneId: string } };
        }
      ).__biaoyue_store__.getState().focusedPaneId,
  );
  const panes = page.locator("[data-pane-id]");
  const ids = await panes.evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-pane-id")),
  );

  for (const id of ids) {
    const active = page.locator(`[data-pane-id="${id}"] [data-tab-id]`).first();
    const fill = await active.locator("svg").first().getAttribute("fill");
    if (id === focused) {
      expect(fill).toContain("--type-markdown");
    } else {
      expect(fill).toBe("var(--app-chrome-rest)");
    }
    const shadow = await page
      .locator(`[data-pane-id="${id}"]`)
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toContain("inset");
  }

  const titleColor = await page
    .locator(`[data-pane-id="${focused}"] [data-tab-id]`)
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  const strong = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--app-text-strong)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(titleColor).toBe(strong);
});

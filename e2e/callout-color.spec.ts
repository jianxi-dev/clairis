import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.CALLOUT_APP_URL ?? "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const PATH = "/tmp/callout-color.md";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 30000 });
});

async function openDoc(page: Page, content: string, mode: "edit" | "preview" = "edit") {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: PATH, c: content },
  );
  await page.evaluate((m) => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode(m);
  }, mode);
  await page
    .locator(mode === "edit" ? ".cm-content" : ".preview-content")
    .first()
    .waitFor({ timeout: 10000 });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

const DOC = "> [!NOTE]+{bg=green border=red text=gray} 标题\n> 正文";

test("三色属性渲染为卡片计算色（填充软色、边框 / 文字实色）", async ({
  page,
}) => {
  await openDoc(page, DOC);

  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();

  const expectedBg = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "color-mix(in srgb, #419e34 10%, transparent)";
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  });

  await expect
    .poll(async () =>
      card.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe(expectedBg);
  await expect
    .poll(async () =>
      card.evaluate((el) => getComputedStyle(el).borderInlineStartColor),
    )
    .toBe("rgb(240, 0, 14)");
  await expect
    .poll(async () => card.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(139, 143, 150)");
  expect(
    await card.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--callout-bg").trim(),
    ),
  ).toContain("color-mix");
});

test("类型转换保留属性块与折叠标记", async ({ page }) => {
  await openDoc(page, DOC);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-type"]').hover();
  await page.locator('[data-type-key="tip"]').click();

  await expect.poll(() => storeContent(page)).toBe(
    "> [!tip]+{bg=green border=red text=gray} 标题\n> 正文",
  );
});

test("一次改色一步撤销", async ({ page }) => {
  await openDoc(page, DOC);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  await panel.locator('[data-class-name="mdb-border-green"]').click();

  await expect.poll(() => storeContent(page)).toContain("border=green");
  await page.evaluate(() => {
    (document.querySelector(".cm-content") as HTMLElement).focus();
  });
  await page.keyboard.press(`${MOD}+Z`);
  await expect.poll(() => storeContent(page)).toBe(DOC);
});

test("改色写回磁盘，重开后颜色仍在", async ({ page }) => {
  await openDoc(page, DOC);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  await panel.locator('[data-class-name="mdb-border-green"]').click();
  await expect.poll(() => storeContent(page)).toContain("border=green");

  await page.waitForFunction((p) => {
    const w = window as unknown as Record<string, any>;
    return (w.__saved_files__?.[p] ?? "").includes("border=green");
  }, PATH);
  const saved = await page.evaluate(
    (p) =>
      (window as unknown as Record<string, any>).__saved_files__?.[p] as string,
    PATH,
  );
  expect(saved).toContain("border=green");

  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: PATH, c: saved },
  );
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await expect
    .poll(async () =>
      card.evaluate((el) => getComputedStyle(el).borderInlineStartColor),
    )
    .toBe("rgb(65, 158, 52)");
});

test("类型浮层含「纯高亮」预设", async ({ page }) => {
  await openDoc(page, DOC);
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-type"]').hover();
  const option = page.locator('[data-type-key="highlight"]');
  await expect(option).toBeVisible();
  await expect(option).toContainText("纯高亮");
});

test("不做字符级 ==text== 高亮渲染", async ({ page }) => {
  await openDoc(page, "==高亮文本==\n", "preview");
  const preview = page.locator(".preview-content").first();
  await expect(preview).toContainText("==高亮文本==");
  await expect(preview.locator("mark")).toHaveCount(0);
});

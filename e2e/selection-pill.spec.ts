import { test, expect, type Page } from "@playwright/test";

const ARTIFACTS = ".artifacts/217";

const EDIT_DOC = "这是编辑态的正文段落，用来验证选区胶囊的改写翻译润色动作。";
const PREVIEW_DOC =
  "# 标题\n\n这是阅读态的正文段落，用来验证选区胶囊的复制解释翻译动作。";

async function bootstrap(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openDoc(
  page: Page,
  path: string,
  content: string,
): Promise<void> {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
}

async function setMode(page: Page, mode: "edit" | "preview"): Promise<void> {
  await page.evaluate((m) => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode(m);
  }, mode);
}

/** 确定性选区：在容器内取一个足够长的文本节点，按字符偏移选中一段。 */
async function selectRange(
  page: Page,
  selector: string,
  start: number,
  end: number,
): Promise<void> {
  await page.evaluate(
    ({ sel, s, e }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`容器不存在：${sel}`);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node && (node.textContent?.length ?? 0) < e) {
        node = walker.nextNode() as Text | null;
      }
      if (!node) throw new Error("没有足够长的文本节点");
      const range = document.createRange();
      range.setStart(node, s);
      range.setEnd(node, e);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    },
    { sel: selector, s: start, e: end },
  );
}

/** 真实指针拖拽选区。 */
async function dragSelect(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`找不到可测量的元素：${selector}`);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 4, 140), y, {
    steps: 12,
  });
  await page.mouse.up();
}

function pill(page: Page) {
  return page.locator("[data-selection-pill]");
}

async function pillLabels(page: Page): Promise<string[]> {
  return (await pill(page).locator("button").allInnerTexts()).map((t) =>
    t.trim(),
  );
}

test.describe("选区胶囊双模式", () => {
  test.beforeEach(async ({ page }) => {
    await bootstrap(page);
  });

  test("编辑态选区出胶囊：改写/翻译/润色", async ({ page }) => {
    await openDoc(page, "/tmp/pill-edit.md", EDIT_DOC);
    await setMode(page, "edit");
    await page.locator(".cm-content").waitFor({ state: "visible" });

    await selectRange(page, ".cm-content", 0, 6);
    await expect(pill(page)).toBeVisible({ timeout: 5000 });
    expect(await pill(page).getAttribute("data-selection-pill-mode")).toBe(
      "edit",
    );
    expect(await pillLabels(page)).toEqual(["改写", "翻译", "润色"]);
  });

  test("阅读态选区出胶囊：复制/解释/翻译", async ({ page }) => {
    await openDoc(page, "/tmp/pill-preview.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible({ timeout: 5000 });
    expect(await pill(page).getAttribute("data-selection-pill-mode")).toBe(
      "preview",
    );
    expect(await pillLabels(page)).toEqual(["复制", "解释", "翻译"]);
  });

  test("真实拖拽也能唤出胶囊", async ({ page }) => {
    await openDoc(page, "/tmp/pill-drag.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await dragSelect(page, ".preview-content p");
    await expect(pill(page)).toBeVisible({ timeout: 5000 });
    expect(await pill(page).getAttribute("data-selection-pill-mode")).toBe(
      "preview",
    );
  });

  test("阅读态复制写剪贴板并关闭胶囊", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openDoc(page, "/tmp/pill-copy.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    const selected = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );
    expect(selected.length).toBeGreaterThan(0);

    await pill(page).getByRole("button", { name: "复制" }).click();
    await expect(pill(page)).toHaveCount(0);

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(selected);
  });

  test("阅读态解释打开 AI 浮层并预填选区文本", async ({ page }) => {
    await openDoc(page, "/tmp/pill-explain.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    const selected = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );

    await pill(page).getByRole("button", { name: "解释" }).click();
    await expect(pill(page)).toHaveCount(0);
    await expect(page.locator("[data-ai-overlay]")).toBeVisible();
    await expect(page.locator("[data-ai-input]")).toHaveValue(
      new RegExp(selected.slice(0, 4)),
    );
  });

  test("阅读态翻译打开 AI 浮层并预填选区文本", async ({ page }) => {
    await openDoc(page, "/tmp/pill-translate.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();

    await pill(page).getByRole("button", { name: "翻译" }).click();
    await expect(pill(page)).toHaveCount(0);
    await expect(page.locator("[data-ai-overlay]")).toBeVisible();
    await expect(page.locator("[data-ai-input]")).not.toHaveValue("");
  });

  test("胶囊形状统一：选区胶囊、文件类型 chip、活跃页签圆角一致", async ({
    page,
  }) => {
    await openDoc(page, "/tmp/pill-shape.md", PREVIEW_DOC);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await page.locator('[data-testid="rail-edge"]').click();
    await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();

    const radii = await page.evaluate(() => {
      const pillEl = document.querySelector<HTMLElement>(
        "[data-selection-pill]",
      );
      const chip = document.querySelector<HTMLElement>(
        "[data-testid='rail-card-chip']",
      );
      const tab = document.querySelector<HTMLElement>("[data-tab-id]");
      return {
        pill: pillEl ? getComputedStyle(pillEl).borderRadius : null,
        chip: chip ? getComputedStyle(chip).borderRadius : null,
        tab: tab ? getComputedStyle(tab).borderRadius : null,
      };
    });

    expect(radii.pill).not.toBeNull();
    expect(radii.chip).not.toBeNull();
    expect(radii.tab).not.toBeNull();
    expect(radii.pill).toBe(radii.chip);
    expect(radii.pill).toBe(radii.tab);
    await page.screenshot({ path: `${ARTIFACTS}/03-capsule-unification.png` });
  });

  test("取消选区后无残留：Escape / 点击 / 滚动", async ({ page }) => {
    const longDoc =
      "# 标题\n\n" +
      "这是阅读态的正文段落，用来验证选区胶囊的无残留行为。".repeat(150);
    await openDoc(page, "/tmp/pill-residue.md", longDoc);
    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pill(page)).toHaveCount(0);
    await page.screenshot({ path: `${ARTIFACTS}/04-no-residue.png` });

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    await page.locator("[data-tab-id]").first().click();
    await expect(pill(page)).toHaveCount(0);

    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    const detached = page.waitForFunction(
      () => !document.querySelector("[data-selection-pill]"),
      null,
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      let node: HTMLElement | null = document.querySelector(".preview-content");
      while (node) {
        if (node.scrollHeight > node.clientHeight + 1) {
          node.dispatchEvent(new Event("scroll"));
          return;
        }
        node = node.parentElement;
      }
      window.dispatchEvent(new Event("scroll"));
    });
    await detached;
  });

  test("深浅色主题下分别截图", async ({ page }) => {
    await openDoc(page, "/tmp/pill-theme.md", EDIT_DOC);
    await setMode(page, "edit");
    await page.locator(".cm-content").waitFor({ state: "visible" });
    await selectRange(page, ".cm-content", 0, 6);
    await expect(pill(page)).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS}/01-editor-pill-light.png` });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: `${ARTIFACTS}/05-editor-pill-dark.png` });
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark"),
    );

    await setMode(page, "preview");
    await page.locator(".preview-content").waitFor({ state: "visible" });
    await selectRange(page, ".preview-content p", 0, 6);
    await expect(pill(page)).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS}/02-reading-pill-light.png` });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: `${ARTIFACTS}/06-reading-pill-dark.png` });
  });
});

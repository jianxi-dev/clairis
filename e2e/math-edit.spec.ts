import { expect, test, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page, body: string, name: string) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ p, b, n }) => {
      const w = window as unknown as Record<string, unknown>;
      (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
        p,
        b,
        n,
      );
      (
        w.__biaoyue_store__ as {
          getState: () => { setEditorMode: (m: string) => void };
        }
      )
        .getState()
        .setEditorMode("edit");
    },
    { p: `/tmp/${name}`, b: body, n: name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = window.__biaoyue_store__.getState();
    return store.tabs[store.activeTabId]?.content ?? "";
  });
}

test("点击公式开浮层，输入实时预览，Esc 提交且无 $ 残留", async ({
  page,
}) => {
  await boot(page, "行内 $E=mc^2$ 公式", "math-edit-inline.md");
  const editor = page.locator(".cm-content");
  await expect(page.locator(".cm-content .katex")).toHaveCount(1);

  await page.locator(".cm-content [data-math-from]").first().click();
  const overlay = page.locator('[data-testid="math-editor"]');
  await expect(overlay).toHaveCount(1);

  const input = page.locator('[data-testid="math-editor-input"]');
  await expect(input).toHaveValue("$E=mc^2$");
  const selected = await input.evaluate((el) => {
    const ta = el as HTMLTextAreaElement;
    return {
      start: ta.selectionStart,
      end: ta.selectionEnd,
      len: ta.value.length,
    };
  });
  expect(selected).toEqual({ start: 0, end: selected.len, len: selected.len });

  const formulaBox = await page
    .locator(".cm-content [data-math-from]")
    .first()
    .boundingBox();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox!.y).toBeGreaterThanOrEqual(
    formulaBox!.y + formulaBox!.height - 1,
  );

  await expect(
    page.locator('[data-testid="math-editor-preview"] .katex'),
  ).toHaveCount(1);

  await input.fill("$a^2+b^2=c^2$");
  await expect(
    page.locator('[data-testid="math-editor-preview"] .katex'),
  ).toHaveCount(1);

  await input.press("Enter");
  await expect(overlay).toHaveCount(1);
  expect((await input.inputValue()).endsWith("\n")).toBe(true);
  await input.fill("$a^2+b^2=c^2$");

  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  expect(await storeContent(page)).toContain("$a^2+b^2=c^2$");
  await expect(editor).not.toContainText("$");
  await expect(page.locator(".cm-content .katex")).toHaveCount(1);
});

test("点击浮层外部提交", async ({ page }) => {
  await boot(page, "正文段落。\n\n行内 $E=mc^2$ 公式", "math-edit-outside.md");
  await page.locator(".cm-content [data-math-from]").first().click();
  const overlay = page.locator('[data-testid="math-editor"]');
  await expect(overlay).toHaveCount(1);

  const input = page.locator('[data-testid="math-editor-input"]');
  await input.fill("$x^2$");
  await page.locator(".cm-content").getByText("正文段落").click();

  await expect(overlay).toHaveCount(0);
  expect(await storeContent(page)).toContain("$x^2$");
  await expect(page.locator(".cm-content .katex")).toHaveCount(1);
});

test("display 判定：align 为块级，align* 不是块级", async ({ page }) => {
  const body = [
    "$\\begin{align}a&=b\\end{align}$",
    "",
    "$\\begin{align*}a&=b\\end{align*}$",
  ].join("\n");
  await boot(page, body, "math-edit-display.md");
  await expect(page.locator(".cm-content .katex-display")).toHaveCount(1);
});

test("空公式与无效公式各显示一个占位且无 katex-error", async ({ page }) => {
  const body = ["$$\n\n$$", "", "$\\frac{1}{$", "", "正文"].join("\n");
  await boot(page, body, "math-edit-placeholder.md");
  await page.locator(".cm-content").getByText("正文").click();
  const placeholder = page.locator(".cm-content .math-placeholder");
  await expect(placeholder).toHaveCount(2);
  await expect(page.locator(".cm-content")).toContainText("添加 LaTeX 公式");
  await expect(page.locator(".cm-content")).toContainText("无效公式");
  await expect(page.locator(".cm-content .katex-error")).toHaveCount(0);
});

test("键入闭合 $…$ 立即渲染", async ({ page }) => {
  await boot(page, "公式 ", "math-edit-type.md");
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.type("$E=mc^2$");
  await expect(page.locator(".cm-content .katex")).toHaveCount(1);
  await expect(editor).not.toContainText("$");
});

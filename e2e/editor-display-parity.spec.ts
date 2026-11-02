import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 一级标题",
  "",
  "这是一段**加粗**、*斜体*和 `行内代码` 的正文，还有 [链接](https://example.com)。",
  "",
  "## 二级标题",
  "",
  "- 无序列表项一",
  "  - 嵌套子项甲",
  "- 无序列表项二",
  "",
  "- [ ] 待办未完成",
  "- [x] 待办已完成",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "> 引用第一行",
  "> 引用第二行",
  "",
  "> [!TIP] 高亮块标题",
  "> 高亮块正文",
  "",
].join("\n");

async function openInEditMode(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/display-parity.md",
      body,
      "display-parity.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function readEditSurface(page: Page) {
  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      ".cm-editor .cm-content",
    );
    const line = document.querySelector<HTMLElement>(".cm-editor .cm-line");
    const h1 = document.querySelector<HTMLElement>(".cm-editor .cm-h1");
    if (!content || !line || !h1) return null;
    const cs = getComputedStyle(content);
    return {
      gutterCount: document.querySelectorAll(".cm-editor .cm-gutters").length,
      foldCount: document.querySelectorAll(".cm-editor .cm-foldGutter").length,
      backgroundColor: cs.backgroundColor,
      fontFamily: cs.fontFamily,
      maxWidth: cs.maxWidth,
      fontSize: cs.fontSize,
      padding: cs.padding,
      lineMaxWidth: getComputedStyle(line).maxWidth,
      h1Color: getComputedStyle(h1).color,
    };
  });
}

async function readPreviewSurface(page: Page) {
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".preview-content");
    const h1 = document.querySelector<HTMLElement>(".preview-content h1");
    if (!content || !h1) return null;
    const cs = getComputedStyle(content);
    return {
      backgroundColor: cs.backgroundColor,
      fontFamily: cs.fontFamily,
      maxWidth: cs.maxWidth,
      fontSize: cs.fontSize,
      h1Color: getComputedStyle(h1).color,
    };
  });
}

test("编辑态与预览态同貌：纸面、字体、标题色一致且无行号槽", async ({
  page,
}) => {
  await openInEditMode(page);

  const edit = await readEditSurface(page);
  expect(edit).not.toBeNull();

  expect(edit!.gutterCount).toBe(0);
  expect(edit!.foldCount).toBe(0);
  expect(edit!.fontFamily).not.toContain("monospace");
  expect(edit!.padding).toBe("40px 32px 96px");

  const preview = await readPreviewSurface(page);
  expect(preview).not.toBeNull();

  expect(edit!.backgroundColor).toBe(preview!.backgroundColor);
  expect(edit!.fontFamily).toBe(preview!.fontFamily);
  expect(edit!.maxWidth).toBe(preview!.maxWidth);
  expect(edit!.fontSize).toBe(preview!.fontSize);
  expect(edit!.h1Color).toBe(preview!.h1Color);

  // 正文走窄通道：与预览 `> *` 的 --type-measure 同宽
  expect(edit!.lineMaxWidth).toBe("1080px");
});

test("编辑态代码围栏与行内元素沿用预览排版", async ({ page }) => {
  await openInEditMode(page);

  const typography = await page.evaluate(() => {
    const fence = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-fenced-code",
    );
    const checkbox = document.querySelector<HTMLElement>(
      ".cm-editor .cm-task-checkbox",
    );
    const quote = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-quote",
    );
    if (!fence || !quote) return null;
    return {
      fenceFont: getComputedStyle(fence).fontFamily,
      fenceSize: getComputedStyle(fence).fontSize,
      quoteBorder: getComputedStyle(quote).borderInlineStartColor,
      checkboxRadius: checkbox ? getComputedStyle(checkbox).borderRadius : null,
    };
  });

  expect(typography).not.toBeNull();
  expect(typography!.fenceFont).toContain("SF Mono");
  expect(typography!.fenceSize).toBe("14.96px");
  expect(typography!.quoteBorder).not.toBe("rgb(99, 102, 241)");
  expect(typography!.checkboxRadius).toBe("50%");
});

test("语法高亮不改写标题排版", async ({ page }) => {
  await openInEditMode(page);

  const decorations = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        ".cm-editor .cm-h1, .cm-editor .cm-h2",
      ),
    ].map((el) => getComputedStyle(el).textDecorationLine),
  );

  expect(decorations.length).toBeGreaterThan(0);
  expect(decorations.every((line) => line === "none")).toBe(true);
});

test("块级组合：引用单卡、高亮块不套引用、围栏不占空行、嵌套列表", async ({
  page,
}) => {
  await openInEditMode(page);

  const state = await page.evaluate(() => {
    const quoteLines = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line.cm-quote"),
    ];
    const calloutQuote = quoteLines.filter((el) =>
      (el.textContent ?? "").includes("高亮块正文"),
    ).length;
    const quotePads = quoteLines.map((el) => ({
      text: (el.textContent ?? "").trim(),
      paddingTop: getComputedStyle(el).paddingTop,
    }));

    const fenceStart = document.querySelector<HTMLElement>(
      ".cm-fenced-fence-start",
    );
    const fenceEnd = document.querySelector<HTMLElement>(
      ".cm-fenced-fence-end",
    );

    const nested = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ].find((el) => (el.textContent ?? "").includes("嵌套子项甲"));
    const topLevel = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ].find((el) => (el.textContent ?? "").trim() === "无序列表项一");

    return {
      calloutQuote,
      quotePads,
      fenceStartHeight: fenceStart?.getBoundingClientRect().height ?? null,
      fenceEndHeight: fenceEnd?.getBoundingClientRect().height ?? null,
      nestedClass: nested?.className ?? "",
      nestedText: (nested?.textContent ?? "").trim(),
      nestedPad: nested
        ? parseFloat(getComputedStyle(nested).paddingInlineStart)
        : null,
      topLevelPad: topLevel
        ? parseFloat(getComputedStyle(topLevel).paddingInlineStart)
        : null,
    };
  });

  expect(state.calloutQuote).toBe(0);

  const first = state.quotePads[0];
  const second = state.quotePads[1];
  expect(parseFloat(first.paddingTop)).toBeGreaterThan(0);
  expect(parseFloat(second.paddingTop)).toBe(0);

  expect(state.fenceStartHeight).not.toBeNull();
  expect(state.fenceStartHeight!).toBeLessThan(30);
  expect(state.fenceEndHeight!).toBeLessThan(20);

  expect(state.nestedClass).toContain("cm-list-depth-1");
  expect(state.nestedText).toBe("嵌套子项甲");
  expect(state.nestedPad!).toBeGreaterThan(state.topLevelPad!);
});

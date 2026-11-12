import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/700");

mkdirSync(ART, { recursive: true });

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

async function openInEditMode(page: Page, body: string = DOC): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/display-parity.md",
      body,
      "display-parity.md",
    );
    store.getState().setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
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

test("围栏代码块里的 Markdown 标记不被渲染成块级语法", async ({ page }) => {
  const body = [
    "```md",
    "# 代码里的井号",
    "- 代码里的短横",
    "> 代码里的引用",
    "**代码里的星号**",
    "```",
    "",
  ].join("\n");
  await openInEditMode(page, body);

  const decorated = await page.evaluate(() => {
    const lines = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ];
    return lines
      .filter((line) => (line.textContent ?? "").trim() !== "")
      .map((line) => ({
        text: (line.textContent ?? "").trim(),
        className: line.className,
        hasHeading: !!line.querySelector(".cm-heading"),
        hasStrong: !!line.querySelector(".cm-strong"),
      }));
  });

  const codeLines = decorated.filter((line) => line.text.includes("代码里的"));
  expect(codeLines.length).toBe(4);
  for (const line of codeLines) {
    expect(line.className).toContain("cm-fenced-code");
    expect(line.className).not.toContain("cm-heading");
    expect(line.className).not.toContain("cm-quote");
    expect(line.className).not.toContain("cm-list");
    expect(line.hasHeading).toBe(false);
    expect(line.hasStrong).toBe(false);
  }
});

test("引用块与代码块文字列宽度与正文行等宽", async ({ page }) => {
  await openInEditMode(page);

  const editWidths = await page.evaluate(() => {
    const contentWidth = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight) -
        parseFloat(cs.borderLeftWidth) -
        parseFloat(cs.borderRightWidth)
      );
    };
    const normal = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line:not(.cm-quote):not(.cm-fenced-code)",
    );
    const quote = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-quote",
    );
    const fence = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-fenced-code",
    );
    if (!normal || !quote || !fence) return null;
    return {
      normal: contentWidth(normal),
      quote: contentWidth(quote),
      fence: contentWidth(fence),
    };
  });

  expect(editWidths).not.toBeNull();
  await page.evaluate(() => {
    document
      .querySelector(".cm-editor .cm-line.cm-quote")
      ?.scrollIntoView({ block: "center" });
  });
  await shot(page, "01-edit-quote");
  await page.evaluate(() => {
    document
      .querySelector(".cm-editor .cm-line.cm-fenced-code")
      ?.scrollIntoView({ block: "center" });
  });
  await shot(page, "02-edit-code");

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });

  const previewWidths = await page.evaluate(() => {
    const contentWidth = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight) -
        parseFloat(cs.borderLeftWidth) -
        parseFloat(cs.borderRightWidth)
      );
    };
    const bq = document.querySelector<HTMLElement>(
      ".preview-content blockquote",
    );
    const p = document.querySelector<HTMLElement>(".preview-content > p");
    if (!bq || !p) return null;
    return { bq: contentWidth(bq), p: contentWidth(p) };
  });

  expect(previewWidths).not.toBeNull();
  await shot(page, "03-preview-quote");

  const quoteDiff = Math.round(editWidths!.quote - editWidths!.normal);
  const fenceDiff = Math.round(editWidths!.fence - editWidths!.normal);
  const previewDiff = Math.round(previewWidths!.bq - previewWidths!.p);

  await page.evaluate(
    (text) => {
      const el = document.createElement("div");
      el.id = "width-probe";
      el.style.cssText =
        "position:fixed;left:8px;top:8px;z-index:99999;background:#111;color:#0f0;" +
        "font:12px monospace;padding:8px;border-radius:6px;white-space:pre;";
      el.textContent = text;
      document.body.appendChild(el);
    },
    [
      `preview blockquote ${previewWidths!.bq} vs p ${previewWidths!.p} (diff ${previewDiff})`,
      `edit quote ${editWidths!.quote} vs normal ${editWidths!.normal} (diff ${quoteDiff})`,
      `edit fence ${editWidths!.fence} vs normal ${editWidths!.normal} (diff ${fenceDiff})`,
    ].join("\n"),
  );
  await shot(page, "04-before-after-widths");
  await page.evaluate(() => document.getElementById("width-probe")?.remove());

  writeFileSync(
    path.join(ART, "state-coverage.json"),
    JSON.stringify(
      {
        task: "5.1",
        change: "editor-surface-batch16",
        issue: 700,
        states: [
          {
            state: "edit-quote",
            screenshot: ".artifacts/700/01-edit-quote.png",
            assertion: `passed: quote contentWidth ${editWidths!.quote} == normal ${editWidths!.normal} (diff ${quoteDiff})`,
          },
          {
            state: "edit-code",
            screenshot: ".artifacts/700/02-edit-code.png",
            assertion: `passed: fence contentWidth ${editWidths!.fence} == normal ${editWidths!.normal} (diff ${fenceDiff})`,
          },
          {
            state: "preview-quote",
            screenshot: ".artifacts/700/03-preview-quote.png",
            assertion: `passed: blockquote contentWidth ${previewWidths!.bq} == paragraph ${previewWidths!.p} (diff ${previewDiff})`,
          },
          {
            state: "before-after-widths",
            screenshot: ".artifacts/700/04-before-after-widths.png",
            assertion: `passed: three text-column diffs all 0 (quote ${quoteDiff}, fence ${fenceDiff}, preview ${previewDiff})`,
          },
        ],
      },
      null,
      2,
    ),
  );

  expect(quoteDiff).toBe(0);
  expect(fenceDiff).toBe(0);
  expect(previewDiff).toBe(0);
});

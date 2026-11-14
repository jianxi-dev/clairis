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

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";
const PNG_BASE64 = PNG_DATA_URL.replace(/^data:image\/png;base64,/, "");

async function openEditor(
  page: Page,
  doc: string,
  name: string,
  imageSrc?: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (imageSrc) {
    // Chromium 解不了 asset://，换成可解码的小图，图片才有真实尺寸。
    await page.addInitScript((src: string) => {
      const win = window as unknown as Record<string, any>;
      win.__convertedMediaPaths__ = [];
      win.__TAURI_INTERNALS__.convertFileSrc = (path: string) => {
        win.__convertedMediaPaths__.push(path);
        return src;
      };
    }, imageSrc);
  }
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

  // 缩放把手只在选中态存在（#655）。
  await page.locator(".cm-image-widget").click();
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

  await page.locator(".cm-image-widget").click();
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

test("点击选中：data-selected + 4 个角点", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgselect", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await expect(widget).toHaveCount(1);
  await expect(widget).toHaveAttribute("data-selected", "false");

  await widget.click();

  await expect(widget).toHaveAttribute("data-selected", "true");
  await expect(widget.locator(".cm-image-corner")).toHaveCount(4);
});

test("选中图片有 8 个缩放把手，e 是第一个", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "imghandles",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await expect(widget).toHaveCount(1);
  await expect(widget.locator(".cm-image-handle")).toHaveCount(0);

  await widget.click();

  await expect(widget.locator(".cm-image-handle")).toHaveCount(8);
  const kinds = await widget.evaluate((el) =>
    Array.from(el.querySelectorAll(".cm-image-handle")).map((node) =>
      node.getAttribute("data-handle"),
    ),
  );
  expect(kinds).toEqual(["e", "w", "n", "s", "ne", "nw", "se", "sw"]);
  await expect(page.locator('[data-testid="cm-image-resize"]')).toHaveCount(1);
});

test("拖拽 e 右移 120px：宽度增加并写入 {width=", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgedrag", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const img = widget.locator("img");
  const before = await img.evaluate((el) => el.getBoundingClientRect().width);

  const handle = page.locator('[data-handle="e"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toMatch(/\{width=\d+\}/);
  const after = await img.evaluate((el) => el.getBoundingClientRect().width);
  expect(after).toBeGreaterThan(before);
});

test("拖拽 se：同时写入 width 与 height（保持比例）", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgsedrag", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const handle = page.locator('[data-handle="se"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 120,
    box.y + box.height / 2 + 120,
    {
      steps: 8,
    },
  );
  await page.mouse.up();

  await expect.poll(() => content(page)).toMatch(/\{width=\d+ height=\d+\}/);
});

test("点击把手不移动：不写文档", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "imgclick", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const handle = page.locator('[data-handle="e"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  expect(await content(page)).toBe(doc);
});

test("取消选中：移除全部 8 个把手", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n\n第二段\n",
    "imgdeselecthandles",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await expect(widget.locator(".cm-image-handle")).toHaveCount(8);

  await page.mouse.click(600, 600);

  await expect(widget.locator(".cm-image-handle")).toHaveCount(0);
});

test("工具条 9 按钮，水平居中于图片（±2px）", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "imgtoolbar",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();

  const toolbar = page.getByTestId("img-toolbar");
  await expect(toolbar).toBeVisible();
  const testids = [
    "img-toolbar-ai",
    "img-toolbar-crop",
    "img-toolbar-comment",
    "img-toolbar-align-left",
    "img-toolbar-align-center",
    "img-toolbar-align-right",
    "img-toolbar-cut",
    "img-toolbar-copy",
    "img-toolbar-delete",
  ];
  for (const id of testids) {
    await expect(page.getByTestId(id)).toHaveCount(1);
  }
  await expect(toolbar.locator("svg")).toHaveCount(9);
  const iconWidths = await toolbar
    .locator("svg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(iconWidths.every((width) => width > 0)).toBe(true);

  // 剪切与裁剪是两个不同图形：路径数据不能相同。
  const pathsOf = (testid: string) =>
    page.getByTestId(testid).evaluate((el) =>
      Array.from(el.querySelectorAll("path"))
        .map((path) => path.getAttribute("d"))
        .join("|"),
    );
  expect(await pathsOf("img-toolbar-cut")).not.toBe(
    await pathsOf("img-toolbar-crop"),
  );

  const widgetBox = (await widget.boundingBox())!;
  const toolbarBox = (await toolbar.boundingBox())!;
  const widgetCenter = widgetBox.x + widgetBox.width / 2;
  const toolbarCenter = toolbarBox.x + toolbarBox.width / 2;
  expect(Math.abs(widgetCenter - toolbarCenter)).toBeLessThanOrEqual(2);
});

test("裁剪按钮启用：打开裁剪框，Esc 取消无文档改动", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "imgcrop", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  const crop = page.getByTestId("img-toolbar-crop");
  await expect(crop).toBeEnabled();
  await crop.click();
  const frame = page.getByTestId("img-crop-frame");
  await expect(frame).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(frame).toHaveCount(0);
  expect(await content(page)).toBe(doc);
});

test("图片圆角 12px", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgradius", PNG_DATA_URL);
  const img = page.locator(".cm-image-widget img");
  await expect(img).toHaveCount(1);
  const clip = await img.evaluate((el) => getComputedStyle(el).clipPath);
  expect(clip).toContain("12px");
});

test("双击放大：浮层出现，Esc 关闭，文档不变", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "imgmax", PNG_DATA_URL);
  const img = page.locator(".cm-image-widget img");
  await img.dblclick();

  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
  expect(await content(page)).toBe(doc);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
});

test("点击外部取消选中", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n\n第二段\n",
    "imgdeselect",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await expect(widget).toHaveAttribute("data-selected", "true");

  await page.mouse.click(600, 600);

  await expect(widget).toHaveAttribute("data-selected", "false");
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
});

test("居中清除 align 属性", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){align=left}\n",
    "imgalign",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-align-center").click();
  await expect.poll(() => content(page)).toBe("![pic](assets/pic.png)\n");
});

test("复制把图片 markdown（含属性块）写入剪贴板", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){width=100}\n",
    "imgcopy",
    PNG_DATA_URL,
  );
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__clipboard__ = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (win.__clipboard__ as string[]).push(text);
          return Promise.resolve();
        },
      },
    });
  });
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-copy").click();
  const clipped = await page.evaluate(
    () => (window as unknown as Record<string, string[]>).__clipboard__,
  );
  expect(clipped).toEqual(["![pic](assets/pic.png){width=100}"]);
});

test("删除移除图片行", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgdelete", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-delete").click();
  await expect.poll(() => content(page)).toBe("");
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
});

test("粘贴剪贴板图片：导入并插入 markdown，光标落在引用之后", async ({
  page,
}) => {
  await openEditor(page, "", "pasteimg", PNG_DATA_URL);
  await page.locator(".cm-content").click();

  await page.locator(".cm-content").evaluate((el, base64) => {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
  }, PNG_BASE64);

  await expect.poll(() => content(page)).toContain("assets/");
  expect(await content(page)).toContain("![pasted.png](assets/pasted.png)");

  // 插入后的图片走文档相对路径解析，并真实解码出尺寸。
  const img = page.locator(".cm-image-widget img");
  await expect(img).toHaveCount(1);
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const converted = await page.evaluate(
    () =>
      (window as unknown as Record<string, string[]>).__convertedMediaPaths__,
  );
  expect(converted).toContain("/tmp/pasteimg/assets/pasted.png");

  // 光标落在引用之后：再敲一个字符应追加在末尾
  await page.keyboard.type("X");
  await expect
    .poll(() => content(page))
    .toBe("![pasted.png](assets/pasted.png)X");
});

test("粘贴超过 20MB 的图片：不插入并提示", async ({ page }) => {
  await openEditor(page, "", "pastebig", PNG_DATA_URL);
  await page.locator(".cm-content").click();

  await page.locator(".cm-content").evaluate((el) => {
    const bytes = new Uint8Array(21 * 1024 * 1024);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "big.png", { type: "image/png" }));
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
  });

  await expect(page.getByTestId("paste-notice")).toContainText("20MB");
  expect(await content(page)).toBe("");
});

// --- 描述行（#657） -----------------------------------------------------------

test("描述行占位：选中无描述图片显示「输入图片描述」", async ({ page }) => {
  await openEditor(
    page,
    `![示例图片](${PNG_DATA_URL})\n`,
    "imgcaptionempty",
    PNG_DATA_URL,
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);
  await page.locator(".cm-image-widget").click();
  const caption = page.locator('[data-testid="img-caption"]');
  await expect(caption).toHaveCount(1);
  await expect(caption).toHaveText("输入图片描述");
});

test("描述行提交：写入源码标题并在预览态显示图注", async ({ page }) => {
  await openEditor(
    page,
    `![示例图片](${PNG_DATA_URL})\n`,
    "imgcaptionsubmit",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();
  await page.locator('[data-testid="img-caption"]').click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("雾山");
  await input.press("Enter");

  await expect.poll(() => content(page)).toContain('"雾山"');
  const final = await content(page);
  expect(final).toContain(`![示例图片](${PNG_DATA_URL} "雾山")`);

  // 提交后描述行回到文本态并显示标题；输入框随 widget 重建后默认隐藏。
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText("雾山");
  await expect(page.locator('[data-testid="img-caption-input"]')).toBeHidden();

  // 预览态出现图注
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  const figcaption = page.locator(".preview-content figcaption");
  await expect(figcaption).toHaveCount(1);
  await expect(figcaption).toHaveText("雾山");
});

test("描述行点击折叠/展开：aria-expanded 切换，标题数据保留", async ({
  page,
}) => {
  await openEditor(
    page,
    `![示例图片](${PNG_DATA_URL} "已有描述")\n`,
    "imgcaptioncollapse",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();
  const caption = page.locator('[data-testid="img-caption"]');
  await expect(caption).toHaveText("已有描述");
  await expect(caption).toHaveAttribute("aria-expanded", "true");
  await caption.click();
  await expect(caption).toHaveAttribute("aria-expanded", "false");
  await expect(caption).toHaveText("显示描述");
  await expect.poll(() => content(page)).toContain('"已有描述"');
  await caption.click();
  await expect(caption).toHaveAttribute("aria-expanded", "true");
  await expect(caption).toHaveText("已有描述");
});

test("描述行取消：Esc 回到占位态，文档无残留改动", async ({ page }) => {
  const doc = `![示例图片](${PNG_DATA_URL})\n`;
  await openEditor(page, doc, "imgcaptionesc", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  await page.locator('[data-testid="img-caption"]').click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("不会被提交");
  await input.press("Escape");

  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "输入图片描述",
  );
  await expect(page.locator('[data-testid="img-caption-input"]')).toHaveCount(
    0,
  );
  expect(await content(page)).toBe(doc);
});

// --- 描述按钮（#708） ----------------------------------------------------------

test("描述按钮：打开输入不插引用行，写入标题并重开回显", async ({ page }) => {
  const doc = `![示例图片](${PNG_DATA_URL}){width=100}\n`;
  await openEditor(page, doc, "imgcaptionbtn", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await widget.click();

  const desc = page.getByTestId("img-toolbar-comment");
  await desc.click();

  // 点击描述按钮只打开输入，不插入 `> 评论：`
  expect(await content(page)).toBe(doc);
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);

  await input.fill("示意图");
  await input.press("Enter");
  await expect.poll(() => content(page)).toContain('"示意图"');
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "示意图",
  );
  await expect(input).toBeHidden();

  // 重开文档：描述行按源码回显，{width=100} 属性块不受影响
  const saved = await content(page);
  expect(saved).toContain("{width=100}");
  await page.evaluate(
    ({ saved, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, saved, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { saved, name: "imgcaptionbtn" },
  );
  await widget.click();
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "示意图",
  );

  // 再次点击描述：输入框回填原值
  await desc.click();
  await expect(input).toHaveCount(1);
  await expect(input).toHaveValue("示意图");

  await expect(desc.locator('svg[data-icon="TextEditOutlined"]')).toHaveCount(
    1,
  );
});

test("描述按钮：Esc 取消不写入且无残留输入", async ({ page }) => {
  const doc = `![示例图片](${PNG_DATA_URL})\n`;
  await openEditor(page, doc, "imgcaptionescbtn", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-comment").click();

  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("不应保存");
  await input.press("Escape");

  await expect(input).toHaveCount(0);
  expect(await content(page)).toBe(doc);
});

test("描述输入框默认隐藏，点添加描述显示并可再收起；按钮仅图标", async ({
  page,
}) => {
  await openEditor(
    page,
    `![示例图片](${PNG_DATA_URL} "已有描述")\n`,
    "imgcaptiontoggle",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();

  const desc = page.getByTestId("img-toolbar-comment");
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await expect(input).toBeHidden();
  expect(await input.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );

  // 「添加描述」只留图标：无可见文字标签，aria-label / title 保留。
  await expect(desc.locator(".cm-image-toolbar-label")).toHaveCount(0);
  expect((await desc.innerText()).trim()).toBe("");
  await expect(desc).toHaveAttribute("aria-label", "添加描述");

  await desc.click();
  await expect(input).toBeVisible();
  expect(await input.evaluate((el) => getComputedStyle(el).display)).not.toBe(
    "none",
  );
  await expect(input).toHaveValue("已有描述");

  await desc.click();
  await expect(input).toBeHidden();
  expect(await input.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );

  await page.mouse.click(600, 600);
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
  await expect(input).toHaveCount(0);
});

// --- 无损裁剪（#656） ---------------------------------------------------------

const CROP_DOC = `![示例图片](${PNG_DATA_URL})\n`;

async function imgBox(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const img = document.querySelector(".cm-image-widget img");
    if (!img) return { width: 0, height: 0 };
    const rect = img.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}
async function openCropFrame(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
}

async function dragHandle(
  page: Page,
  handle: string,
  dx: number,
  dy: number,
): Promise<void> {
  const el = page.locator(`.cm-image-crop-frame [data-handle="${handle}"]`);
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    {
      steps: 4,
    },
  );
  await page.mouse.up();
}

test("裁剪拖动：地址不变、可见变小、源码出现裁剪矩形", async ({ page }) => {
  await openEditor(page, CROP_DOC, "imgcrop1", PNG_DATA_URL);
  const before = await imgBox(page);
  await openCropFrame(page);
  await dragHandle(page, "nw", 4, 4);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  expect(final).toMatch(/\{crop=\d+,\d+,\d+,\d+\}/);
  expect(final.startsWith(`![示例图片](${PNG_DATA_URL}){crop=`)).toBe(true);
  const after = await imgBox(page);
  expect(after.width).toBeLessThan(before.width);
  expect(after.height).toBeLessThan(before.height);
});

test("再次打开裁剪：矩形按上次还原，扩大后可见区域变大", async ({ page }) => {
  await openEditor(page, CROP_DOC, "imgcrop2", PNG_DATA_URL);
  await openCropFrame(page);
  await dragHandle(page, "e", 2, 0);
  await expect.poll(() => content(page)).toContain("{crop=");

  const first = await imgBox(page);
  await openCropFrame(page);
  const frameBox = (await page.getByTestId("img-crop-frame").boundingBox())!;
  expect(Math.abs(frameBox.width - first.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameBox.height - first.height)).toBeLessThanOrEqual(2);

  await dragHandle(page, "e", 2, 0);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  const second = await imgBox(page);
  expect(second.width).toBeGreaterThan(first.width);
});

test("恢复整图：显示回到完整图，源码无裁剪属性", async ({ page }) => {
  await openEditor(page, CROP_DOC, "imgcrop3", PNG_DATA_URL);
  await openCropFrame(page);
  await dragHandle(page, "nw", -20, -20);
  await expect.poll(() => content(page)).toContain("{crop=");
  expect((await imgBox(page)).width).toBeLessThan(32);

  await openCropFrame(page);
  await dragHandle(page, "se", 40, 40);
  await expect.poll(() => content(page)).toBe(CROP_DOC);
  expect((await imgBox(page)).width).toBe(32);
});

test("Esc 取消裁剪：显示与源码均无变化", async ({ page }) => {
  await openEditor(page, CROP_DOC, "imgcrop4", PNG_DATA_URL);
  await openCropFrame(page);

  const handle = page.locator('.cm-image-crop-frame [data-handle="e"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, {
    steps: 4,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  expect(await content(page)).toBe(CROP_DOC);
  expect((await imgBox(page)).width).toBe(32);
});

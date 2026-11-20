import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";

async function dpbRecord(
  page: Page,
  dir: string,
  state: string,
): Promise<void> {
  const ART = path.resolve(process.cwd(), `.artifacts/${dir}`);
  mkdirSync(ART, { recursive: true });
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: dir, states }, null, 2)}\n`,
  );
}

const BODY = Array.from({ length: 120 }, (_, i) => `段落 ${i} 内容。`).join(
  "\n\n",
);

const EMBED_DOC = `---
title: 嵌入测试
tags:
  - 甲
count: 42
---

# 正文标题

${BODY}
`;

const NO_FRONTMATTER_DOC = "第一段\n\n第二段";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(
  page: Page,
  content = EMBED_DOC,
  fileName = "embed.md",
): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, args.name);
    },
    { path: `/Users/test/${fileName}`, content, name: fileName },
  );
}

async function setMode(page: Page, mode: "preview" | "edit" | "source") {
  await page.evaluate((m) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setEditorMode: (m: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setEditorMode(m as "preview" | "edit" | "source");
  }, mode);
}

async function setVariant(page: Page, variant: "A" | "B") {
  await page.evaluate((v) => {
    (window as unknown as Record<string, any>).__biaoyue_doc_property__
      .getState()
      .setVariant(v);
  }, variant);
}

/** 在行的左缘 25% 召唤区里移动指针（D5：只有左 25% 召唤手柄）。 */
async function hoverLineLeft(page: Page, line: Locator) {
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
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test("悬停正文首块：手柄 data-block-from 指向正文起点（posAtCoords 不偏移）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const embed = page.locator(".cm-content > .cm-dpb-embed");
  await expect(embed).toBeVisible();

  const bodyStart = EMBED_DOC.indexOf("# 正文标题");
  expect(bodyStart).toBeGreaterThan(0);
  const firstBodyLine = page
    .locator(".cm-line")
    .filter({ hasText: "正文标题" })
    .first();
  await expect(firstBodyLine).toBeVisible();
  await hoverLineLeft(page, firstBodyLine);

  const handle = page.locator(
    `.cm-block-handle[data-block-from="${bodyStart}"]`,
  );
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  await dpbRecord(page, "1215", "00-hover-first-body-block");
});

test("编辑态：属性块是正文流首块并渲染面板", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const embed = page.locator(".cm-content > .cm-dpb-embed");
  await expect(embed).toHaveCount(1);
  await expect(embed.locator('[data-testid="dpb-a"]')).toBeVisible();

  const beforeFirstLine = await page
    .locator(".cm-content")
    .first()
    .evaluate((el) => {
      const block = el.querySelector(":scope > .cm-dpb-embed");
      const line = el.querySelector(":scope > .cm-line");
      if (!block || !line) return false;
      return (
        (block.compareDocumentPosition(line) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
      );
    });
  expect(beforeFirstLine).toBe(true);
  await dpbRecord(page, "1215", "01-edit-first-block");
});

test("编辑态：无 frontmatter 的文档保持内容区上方固定宿主", async ({
  page,
}) => {
  await openDoc(page, NO_FRONTMATTER_DOC, "plain.md");
  await setMode(page, "edit");
  await expect(page.locator(".cm-dpb-embed")).toHaveCount(0);

  const host = page.locator('[data-testid="doc-property-host"]');
  await expect(host).toBeVisible();
  const insideScroll = await host.evaluate(
    (el) => el.closest(".content-scroll") !== null,
  );
  expect(insideScroll).toBe(false);
  await expect(page.locator('[data-testid="dpb-empty"]')).toBeVisible();
  await dpbRecord(page, "1215", "07-no-frontmatter-fixed-host");
});

test("编辑态：折叠后折叠条嵌入正文流（无摘要标签），展开恢复卡片", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toHaveCount(1);

  await page.locator('[data-testid="dpb-collapse"]').click();
  // 折叠条随正文流滚动；正文不再出现「文档属性 · N 个字段」摘要标签。
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toHaveCount(1);
  await expect(page.locator(".cm-fmh-summary")).toHaveCount(0);
  const a = page.locator('.cm-dpb-embed [data-testid="dpb-a"]');
  await expect(a).toBeVisible();
  await expect(a.locator(".dpb-a-summary")).toContainText("已折叠");
  await dpbRecord(page, "1226", "01-collapsed-bar-in-body");

  await page.locator('.cm-dpb-embed [data-testid="dpb-collapse"]').click();
  await expect(a.locator(".dpb-a-summary")).toHaveCount(0);
  await expect(a.locator(".dpb-a-meta")).toBeVisible();
  await expect(
    page.locator('.cm-dpb-embed [data-testid="dpb-row"]'),
  ).toHaveCount(2);
  await dpbRecord(page, "1226", "02-expanded-restored");
});

test("双窗格：两格各渲染一份属性嵌入（宿主按格自查，#1226）", async ({
  page,
}) => {
  const DOC_A = `---\ntitle: 分屏甲\ntags:\n  - 甲\n---\n\n# 甲\n`;
  const DOC_B = `---\ntitle: 分屏乙\ntags:\n  - 乙\n---\n\n# 乙\n`;
  await openDoc(page, DOC_A, "split-embed-a.md");
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { splitPane: (d: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .splitPane("right");
  });
  await openDoc(page, DOC_B, "split-embed-b.md");

  const paneIds = await page
    .locator("[data-pane-id][data-pane-kind='tabs']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-pane-id")!));
  expect(paneIds).toHaveLength(2);
  for (const id of paneIds) {
    await page.evaluate((pid) => {
      (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => {
              setPaneEditorMode: (id: string, m: string) => void;
            };
          };
        }
      ).__biaoyue_store__
        .getState()
        .setPaneEditorMode(pid, "edit");
    }, id);
  }

  for (const id of paneIds) {
    const pane = page.locator(`[data-pane-id="${id}"]`);
    await expect(pane.locator(".cm-content > .cm-dpb-embed")).toHaveCount(1);
    await expect(
      pane.locator('.cm-dpb-embed [data-testid="dpb-a"]'),
    ).toHaveCount(1);
  }
  await dpbRecord(page, "1226", "03-dual-pane-both-embed");
});

test("编辑态：键入标签提交后焦点保留（widget DOM 复用，不随写回重建）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const tagInput = page.locator('.cm-dpb-embed [data-testid="dpb-tag-input"]');
  await expect(tagInput).toBeVisible();
  await tagInput.click();
  await tagInput.fill("新标签");
  // Enter 提交 → frontmatter 写回 → 文档变更 → 装饰重建。
  await tagInput.press("Enter");
  await expect(tagInput).toBeFocused();
  await expect(tagInput).toHaveValue("");
  await expect(
    page.locator('.cm-dpb-embed [data-testid="dpb-tag-name"]').filter({
      hasText: "新标签",
    }),
  ).toHaveCount(1);
  await dpbRecord(page, "1215", "10-focus-retained");
});

test("无 frontmatter 文档：添加首字段后转为嵌入形态且面板保持可用", async ({
  page,
}) => {
  await openDoc(page, NO_FRONTMATTER_DOC, "plain.md");
  await setMode(page, "edit");
  await expect(page.locator(".cm-dpb-embed")).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-empty"]')).toBeVisible();

  await page.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();

  await expect(page.locator(".cm-dpb-embed")).toHaveCount(1);
  await expect(
    page.locator(".cm-dpb-embed [data-testid='dpb-a']"),
  ).toBeVisible();
  // 新字段自动进入改名聚焦：面板在嵌入宿主里保持挂载与交互。
  await expect(
    page.locator(".cm-dpb-embed [data-testid='dpb-rename-input']"),
  ).toBeFocused();
  await dpbRecord(page, "1215", "11-transition-to-embed");
});

test("编辑态：滚动正文时属性块随内容移出视口（不固定）", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const embed = page.locator(".cm-content > .cm-dpb-embed");
  await expect(embed).toBeVisible();
  const before = (await embed.boundingBox())!;

  await page
    .locator(".cm-scroller")
    .first()
    .evaluate((el) => {
      el.scrollTop = 600;
    });
  await expect
    .poll(async () => {
      const box = await embed.boundingBox();
      return box ? box.y : 0;
    })
    .toBeLessThan(0);
  const after = (await embed.boundingBox())!;
  expect(after.y).toBeLessThan(before.y);
  await dpbRecord(page, "1215", "02-edit-scrolled-away");
});

test("预览态：属性块在正文标题之前且只读", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "preview");
  const block = page.locator(".preview-content > .doc-property-embed-preview");
  await expect(block).toHaveCount(1);
  await expect(block.locator('[data-testid="dpb-a"]')).toBeVisible();

  const beforeTitle = await page
    .locator(".content-scroll")
    .first()
    .evaluate((el) => {
      const b = el.querySelector(
        ".preview-content > .doc-property-embed-preview",
      );
      const h1 = el.querySelector(".preview-content h1");
      if (!b || !h1) return false;
      return (
        (b.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    });
  expect(beforeTitle).toBe(true);

  await block.locator('[data-key="count"] [data-testid="dpb-value"]').click();
  await expect(block.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  await expect(block.locator('[data-testid="dpb-collapse"]')).toHaveCount(0);
  await dpbRecord(page, "1215", "03-preview-top-readonly");
});

test("预览态：属性块宿主与预览纸面同宽同底（A/B 两态，#1243）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "preview");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>(
        '[data-testid="doc-property-host"]',
      );
      const paper = document.querySelector<HTMLElement>(".preview-content");
      if (!host || !paper) return null;
      const h = host.getBoundingClientRect();
      const p = paper.getBoundingClientRect();
      return {
        insidePaper: paper.contains(host),
        hostLeft: h.left,
        hostWidth: h.width,
        paperLeft: p.left,
        paperWidth: p.width,
        hostBg: getComputedStyle(host).backgroundColor,
        paperBg: getComputedStyle(paper).backgroundColor,
      };
    });
    expect(m).not.toBeNull();
    expect(m!.insidePaper).toBe(true);
    expect(Math.abs(m!.hostLeft - m!.paperLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(m!.hostWidth - m!.paperWidth)).toBeLessThanOrEqual(1);
    expect(m!.hostBg).toBe(m!.paperBg);
    await dpbRecord(
      page,
      "1243",
      variant === "A"
        ? "01-preview-paper-aligned-a"
        : "02-preview-paper-aligned-b",
    );
  }
});

test("编辑态：属性块面板宽度等于正文列（A/B 两态，#1243）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(
        ".cm-content > .cm-dpb-embed .dpb-panel",
      );
      const line = document.querySelector<HTMLElement>(
        ".cm-content > .cm-line",
      );
      if (!panel || !line) return null;
      return {
        panelW: panel.getBoundingClientRect().width,
        lineW: line.getBoundingClientRect().width,
        panelBg: getComputedStyle(panel).backgroundColor,
        contentBg: getComputedStyle(
          document.querySelector<HTMLElement>(".cm-content")!,
        ).backgroundColor,
      };
    });
    expect(m).not.toBeNull();
    expect(Math.abs(m!.panelW - m!.lineW)).toBeLessThanOrEqual(2);
    expect(m!.panelBg).toBe(m!.contentBg);
    await dpbRecord(
      page,
      "1243",
      variant === "A" ? "03-edit-width-a" : "04-edit-width-b",
    );
  }
});

test("源码态：不渲染属性块，YAML 完整可见", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "source");
  await expect(page.locator(".cm-dpb-embed")).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-a"]')).toBeHidden();
  const host = page.locator('[data-testid="doc-property-host"]');
  await expect(host).toHaveCSS("display", "none");
  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("title: 嵌入测试");
  await expect(cm).toContainText("---");
  await dpbRecord(page, "1215", "04-source-yaml-visible");
});

test("⌘⇧Y 隐藏并恢复正文流内的属性块", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const embed = page.locator(".cm-content > .cm-dpb-embed");
  await expect(embed).toHaveCount(1);

  await page.keyboard.press("Meta+Shift+Y");
  await expect(embed).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-a"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-hidden-note"]')).toBeVisible();
  await dpbRecord(page, "1215", "05-hidden-note");
  await dpbRecord(page, "1226", "04-hidden-note");

  await page.keyboard.press("Meta+Shift+Y");
  await expect(embed).toHaveCount(1);
  await expect(page.locator('[data-testid="dpb-a"]')).toBeVisible();
  await expect(page.locator('[data-testid="dpb-hidden-note"]')).toHaveCount(0);
  await dpbRecord(page, "1215", "06-restored");
});

test("双击揭示 frontmatter 后单击恢复：属性块重新挂到新宿主（#1244）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const embed = page.locator(".cm-content > .cm-dpb-embed");
  await expect(embed).toHaveCount(1);
  await expect(embed.locator(".dpb-panel")).toHaveCount(1);
  await dpbRecord(page, "1244", "00-initial-embed");

  // 双击属性块上沿外侧（编辑区顶部内边距）：选中 frontmatter 组 → 隐藏撤销、
  // 源码揭示。这是既有契约（选区落入块内不隐藏，防编辑盲区），此处只复现。
  const point = await page.evaluate(() => {
    const content = document
      .querySelector(".cm-content")!
      .getBoundingClientRect();
    const embed = document
      .querySelector(".cm-dpb-embed")!
      .getBoundingClientRect();
    return { x: content.x + 200, y: embed.y - 8 };
  });
  await page.mouse.dblclick(point.x, point.y);
  await expect(embed).toHaveCount(0);
  await expect(page.locator(".cm-content > .cm-line").first()).toHaveText(
    "---",
  );
  await dpbRecord(page, "1244", "01-revealed-source");

  // 单击同一位置：光标落回块起点 → 隐藏恢复、widget DOM 重建。宿主若仍指向
  // 被销毁的旧节点，portal 会渲染进 detached 节点 → 属性块不可见（#1244）。
  await page.mouse.click(point.x, point.y);
  await expect(embed).toHaveCount(1);
  await expect(embed.locator(".dpb-panel")).toHaveCount(1);
  await expect(embed.locator('[data-testid="dpb-a"]')).toBeVisible();
  await expect(page.locator(".cm-content > .cm-line").first()).not.toHaveText(
    "---",
  );
  await dpbRecord(page, "1244", "02-recovered-host");

  // 恢复后面板仍可交互（折叠条在嵌入宿主内）。
  await embed.locator('[data-testid="dpb-collapse"]').click();
  await expect(
    embed.locator('[data-testid="dpb-a"] .dpb-a-summary'),
  ).toContainText("已折叠");
  await dpbRecord(page, "1244", "03-recovered-interactive");
});

test("宽度：属性块与正文测量列同宽（A/B 两态）", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    await page.waitForTimeout(150);
    const panel = page
      .locator(".cm-content > .cm-dpb-embed")
      .locator(".dpb-panel");
    await expect(panel).toHaveCount(1);
    const boxes = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>(
        ".cm-content > .cm-dpb-embed .dpb-panel",
      );
      const line = document.querySelector<HTMLElement>(
        ".cm-content > .cm-line",
      );
      if (!p || !line) return null;
      return {
        panelW: p.getBoundingClientRect().width,
        lineW: line.getBoundingClientRect().width,
      };
    });
    expect(boxes).not.toBeNull();
    expect(Math.abs(boxes!.panelW - boxes!.lineW)).toBeLessThanOrEqual(2);
    await dpbRecord(
      page,
      "1217",
      variant === "A" ? "01-a-width-aligned" : "02-b-width-aligned",
    );
  }
});

test("窄窗：属性块不横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await openDoc(page);
  await setMode(page, "edit");
  const panel = page
    .locator(".cm-content > .cm-dpb-embed")
    .locator(".dpb-panel");
  await expect(panel).toBeVisible();
  const overflow = await page.evaluate(() => {
    const p = document.querySelector<HTMLElement>(
      ".cm-content > .cm-dpb-embed .dpb-panel",
    )!;
    return { scroll: p.scrollWidth, client: p.clientWidth };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  await dpbRecord(page, "1217", "03-narrow-no-overflow");
  await setVariant(page, "B");
  await page.waitForTimeout(200);
  const b = await page.evaluate(() => {
    const p = document.querySelector<HTMLElement>(
      ".cm-content > .cm-dpb-embed .dpb-panel",
    )!;
    return { scroll: p.scrollWidth, client: p.clientWidth };
  });
  expect(b.scroll).toBeLessThanOrEqual(b.client + 1);
  await dpbRecord(page, "1217", "04-narrow-b-no-overflow");
});

test("编辑态：属性块下方间距 ≈ 一个正文行高，且不依赖文档空行（#1227）", async ({
  page,
}) => {
  const measure = () =>
    page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(
        ".cm-content > .cm-dpb-embed .dpb-panel",
      );
      const line = document.querySelector<HTMLElement>(
        ".cm-content > .cm-line",
      );
      const content = document.querySelector<HTMLElement>(".cm-content");
      if (!card || !line || !content) return null;
      const c = card.getBoundingClientRect();
      const l = line.getBoundingClientRect();
      // 正文行高取 .cm-content 计算值（标题行有独立行高，不能拿首行高度当行高）。
      const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
      return { gap: l.top - c.bottom, lineHeight };
    });

  await openDoc(page);
  await setMode(page, "edit");
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toBeVisible();
  const withBlank = await measure();
  expect(withBlank).not.toBeNull();
  expect(withBlank!.gap).toBeGreaterThanOrEqual(withBlank!.lineHeight - 2);
  expect(withBlank!.gap).toBeLessThanOrEqual(withBlank!.lineHeight + 6);
  await dpbRecord(page, "1227", "01-edit-gap-one-line");

  // 删掉 frontmatter 后的空行：间距不变（来自 margin，不来自空行）。
  const NO_BLANK = EMBED_DOC.replace("---\n\n# 正文标题", "---\n# 正文标题");
  await page.evaluate((content) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { updateContent: (c: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .updateContent(content);
  }, NO_BLANK);
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toBeVisible();
  const noBlank = await measure();
  expect(noBlank).not.toBeNull();
  expect(noBlank!.gap).toBeGreaterThanOrEqual(noBlank!.lineHeight - 2);
  expect(noBlank!.gap).toBeLessThanOrEqual(noBlank!.lineHeight + 6);
  await dpbRecord(page, "1227", "02-edit-gap-no-blank-line");
});

test("编辑态：折叠条下方间距同样 ≈ 一个正文行高（#1227）", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toBeVisible();
  const m = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(
      ".cm-content > .cm-dpb-embed .dpb-panel",
    );
    const line = document.querySelector<HTMLElement>(".cm-content > .cm-line");
    const content = document.querySelector<HTMLElement>(".cm-content");
    if (!card || !line || !content) return null;
    const c = card.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
    return { gap: l.top - c.bottom, lineHeight };
  });
  expect(m).not.toBeNull();
  expect(m!.gap).toBeGreaterThanOrEqual(m!.lineHeight - 2);
  expect(m!.gap).toBeLessThanOrEqual(m!.lineHeight + 6);
  await dpbRecord(page, "1227", "03-collapsed-gap-one-line");
});

test("预览态：属性卡片与正文段落同轴（左右缘对齐，#1227）", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "preview");
  const block = page.locator(".preview-content > .doc-property-embed-preview");
  await expect(block).toBeVisible();
  await expect(page.locator(".preview-content h1")).toBeVisible();
  const align = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(
      ".doc-property-embed-preview .dpb-panel",
    );
    const p = document.querySelector<HTMLElement>(".preview-prose > p");
    if (!card || !p) return null;
    const c = card.getBoundingClientRect();
    const r = p.getBoundingClientRect();
    return {
      cardLeft: c.left,
      cardRight: c.right,
      pLeft: r.left,
      pRight: r.right,
    };
  });
  expect(align).not.toBeNull();
  expect(Math.abs(align!.cardLeft - align!.pLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(align!.cardRight - align!.pRight)).toBeLessThanOrEqual(2);
  await dpbRecord(page, "1227", "04-preview-column-aligned");
});

import { test, expect, type Locator, type Page } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1676 后续三处修正（fix/callout-mark-fix3）：
 *
 * - A：`{bg=red border=red}` 打开高亮面板 → 深档 background 行无选中（未命中
 *   不能把「无」默认格标 active），中档行选中 `hl-fill-red`，边框行选中
 *   `hl-border-red`。
 * - B：`{bg=green border=red text=blue}` 打开标注面板 → 三行各恰 1 个选中，
 *   分别为 `mdb-bg-green` / `mdb-border-red` / `mdb-color-blue`。
 * - C：高亮块内边距上下 ≥8px、左右 ≥12px（编辑态 + 预览态）。
 * - D：取色器「最近」与「动物」页签的 `.cm-callout-emoji-body` 高度差 ≤1px。
 */

interface BridgeWindow extends Window {
  __biaoyue_store__: {
    getState: () => {
      tabs: Record<string, { content: string }>;
      activeTabId: string;
      setEditorMode: (mode: string) => void;
    };
  };
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function switchToPreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

/** 点块内容 → 工具条颜色入口，返回浮层 wrap（data-testid=callout-color-panel）。 */
async function openPanel(page: Page, mark: boolean): Promise<Locator> {
  const block = mark
    ? page.locator(".cm-callout-mark").first()
    : page.locator(".cm-callout").first();
  await expect(block).toBeVisible();
  await block.locator(".cm-callout-content").click();
  const entry = page.locator('[data-testid="callout-color-entry"]');
  await expect(entry).toBeVisible({ timeout: 3000 });
  await entry.hover();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  return panel;
}

const activeOf = (panel: Locator, kind: string): Locator =>
  panel.locator(
    `.cm-color-row[data-kind="${kind}"] .cm-color-swatch[data-active="true"]`,
  );

/** 高亮块两行填充（深档 / 中档）各自的选中格。 */
function activeFillByRow(panel: Locator): [Locator, Locator] {
  const rows = panel.locator('.cm-color-row[data-kind="background"]');
  return [
    rows.nth(0).locator('.cm-color-swatch[data-active="true"]'),
    rows.nth(1).locator('.cm-color-swatch[data-active="true"]'),
  ];
}

async function openEmojiPicker(page: Page): Promise<void> {
  const icon = page.locator(".cm-callout-icon").first();
  await expect(icon).toBeVisible();
  await icon.dispatchEvent("mousedown", { bubbles: true, cancelable: true });
  await page
    .locator('[data-testid="cm-callout-emoji-picker"]')
    .waitFor({ timeout: 3000 });
}

test("A：未命中色名不误标默认格（深档 0 / 中档 hl-fill-red / 边框 hl-border-red）", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{bg=red border=red}\n> 高亮正文\n",
    "callout-fix3-a",
  );
  const panel = await openPanel(page, true);

  const [deep, mid] = activeFillByRow(panel);
  await expect(deep).toHaveCount(0);
  await expect(mid).toHaveCount(1);
  await expect(mid).toHaveAttribute("data-class-name", "hl-fill-red");
  await expect(activeOf(panel, "border")).toHaveCount(1);
  await expect(activeOf(panel, "border")).toHaveAttribute(
    "data-class-name",
    "hl-border-red",
  );
});

test("B：标注三色各恰 1 个选中（bg=green border=red text=blue）", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "> [!NOTE]{bg=green border=red text=blue} 标题\n> 正文\n",
    "callout-fix3-b",
  );
  const panel = await openPanel(page, false);

  await expect(activeOf(panel, "background")).toHaveCount(1);
  await expect(activeOf(panel, "background")).toHaveAttribute(
    "data-class-name",
    "mdb-bg-green",
  );
  await expect(activeOf(panel, "border")).toHaveCount(1);
  await expect(activeOf(panel, "border")).toHaveAttribute(
    "data-class-name",
    "mdb-border-red",
  );
  await expect(activeOf(panel, "font")).toHaveCount(1);
  await expect(activeOf(panel, "font")).toHaveAttribute(
    "data-class-name",
    "mdb-color-blue",
  );
});

test("C：高亮块内边距上下 ≥8px、左右 ≥12px（编辑态 + 预览态）", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{bg=red border=red}\n> 高亮正文\n",
    "callout-fix3-c",
  );

  const readPadding = (
    el: Element,
  ): { top: number; bottom: number; left: number; right: number } => {
    const cs = getComputedStyle(el);
    return {
      top: Number.parseFloat(cs.paddingTop),
      bottom: Number.parseFloat(cs.paddingBottom),
      left: Number.parseFloat(cs.paddingLeft),
      right: Number.parseFloat(cs.paddingRight),
    };
  };

  const editCard = page.locator(".cm-callout.cm-callout-mark").first();
  await expect(editCard).toBeVisible();
  const editPad = await editCard.evaluate(readPadding);
  expect(editPad.top).toBeGreaterThanOrEqual(8);
  expect(editPad.bottom).toBeGreaterThanOrEqual(8);
  expect(editPad.left).toBeGreaterThanOrEqual(12);
  expect(editPad.right).toBeGreaterThanOrEqual(12);

  await switchToPreview(page);
  const previewCard = page
    .locator(".preview-content .callout.callout-mark")
    .first();
  await expect(previewCard).toBeVisible();
  const previewPad = await previewCard.evaluate(readPadding);
  expect(previewPad.top).toBeGreaterThanOrEqual(8);
  expect(previewPad.bottom).toBeGreaterThanOrEqual(8);
  expect(previewPad.left).toBeGreaterThanOrEqual(12);
  expect(previewPad.right).toBeGreaterThanOrEqual(12);
});

test("D：取色器「最近」与「动物」页签 body 等高（差 ≤1px）", async ({
  page,
}) => {
  await openMarkdownInEdit(page, "> [!NOTE]\n> 正文\n", "callout-fix3-d");
  await openEmojiPicker(page);

  const body = page.locator(".cm-callout-emoji-body");
  await expect(body).toBeVisible();
  const recentHeight = await body.evaluate(
    (el) => el.getBoundingClientRect().height,
  );

  const tabs = page.locator('[data-testid="cm-callout-emoji-tab"]');
  await expect(tabs).toHaveCount(8);
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveClass(/cm-callout-emoji-tab-active/);
  const animalHeight = await body.evaluate(
    (el) => el.getBoundingClientRect().height,
  );

  expect(Math.abs(animalHeight - recentHeight)).toBeLessThanOrEqual(1);
});

test("E：标注面板选中态可见（描边 2px），随机后选中态移动", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    "> [!NOTE]{bg=green border=red text=blue} 标题\n> 正文\n",
    "callout-fix3-e",
  );
  const panel = await openPanel(page, false);
  const actives = panel.locator('.cm-color-swatch[data-active="true"]');
  await expect(actives).toHaveCount(3);

  const outlines = await actives.evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    }),
  );
  for (const outline of outlines) {
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
  }

  const readActive = () =>
    panel
      .locator('.cm-color-swatch[data-active="true"]')
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).dataset.className ?? ""),
      );
  const before = await readActive();
  await panel.locator('[data-testid="color-random-callout"]').click();
  await expect
    .poll(() => storeContent(page))
    .toMatch(/\{bg=[a-z]+ border=[a-z]+[^}]*\}/);
  const after = await readActive();
  expect(after).not.toEqual(before);
  expect(await panel.locator(".cm-highlight-color-panel").count()).toBe(0);
  const afterOutline = await panel
    .locator('.cm-color-swatch[data-active="true"]')
    .first()
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(afterOutline).toBe("solid");
});

test("F：随机三元组按对比度选色（高亮 + 标注）", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{bg=blue border=blue text=yellow}\n> 高亮正文\n",
    "callout-fix3-f1",
  );
  const panel = await openPanel(page, true);
  for (let i = 0; i < 3; i += 1) {
    await panel.locator('[data-testid="color-random"]').click();
    const firstLine = (await storeContent(page)).split("\n")[0] ?? "";
    expect((firstLine.match(/\{/g) ?? [])).toHaveLength(1);
  }
  await expect.poll(() => storeContent(page)).toMatch(/\{bg=[a-z]+ border=[a-z]+/);

  const hl = await page.evaluate(() => {
    const root = document.documentElement;
    const read = (name: string, fallback: string): string => {
      const v = getComputedStyle(root).getPropertyValue(name).trim();
      return v === "" ? fallback : v;
    };
    const content = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { tabs: Record<string, { content: string }>; activeTabId: string };
        };
      }
    ).__biaoyue_store__.getState().tabs;
    const active = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { activeTabId: string };
        };
      }
    ).__biaoyue_store__.getState().activeTabId;
    const text = content[active]?.content ?? "";
    const m = /\{bg=([a-z]+) border=([a-z]+)[^}]*\}/.exec(text);
    const textM = /text=([a-z]+)/.exec(text);
    const fill = read(`--hl-fill-${m?.[1] ?? ""}`, "#ffffff");
    const font = textM ? read(`--hl-font-${textM[1]}`, "#000000") : read("--app-text", "#24262b");
    const parse = (hex: string): [number, number, number] => {
      const n = Number.parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const lum = ([r, g, b]: [number, number, number]): number => {
      const f = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: [number, number, number], b: [number, number, number]): number => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    return { ratio: ratio(parse(font), parse(fill)) };
  });
  expect(hl.ratio).toBeGreaterThanOrEqual(4);

  await openMarkdownInEdit(
    page,
    "> [!NOTE]{bg=red border=red text=yellow} 标题\n> 正文\n",
    "callout-fix3-f2",
  );
  const calloutPanel = await openPanel(page, false);
  await calloutPanel.locator('[data-testid="color-random-callout"]').click();
  await expect
    .poll(() => storeContent(page))
    .toMatch(/\{bg=[a-z]+ border=[a-z]+[^}]*\}/);

  const note = await page.evaluate(() => {
    const root = document.documentElement;
    const read = (name: string, fallback: string): string => {
      const v = getComputedStyle(root).getPropertyValue(name).trim();
      return v === "" ? fallback : v;
    };
    const state = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            tabs: Record<string, { content: string }>;
            activeTabId: string;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const text = state.tabs[state.activeTabId]?.content ?? "";
    const m = /\{bg=([a-z]+) border=([a-z]+)[^}]*\}/.exec(text);
    const textM = /text=([a-z]+)/.exec(text);
    const bgHex = read(`--hl-fill-${m?.[1] ?? ""}`, "#f0000e");
    const surface = read("--app-surface", "#fbfaf8");
    const font = textM ? read(`--hl-font-${textM[1]}`, "#000000") : read("--app-text", "#24262b");
    const parse = (hex: string): [number, number, number] => {
      const n = Number.parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const bg = parse(bgHex);
    const s = parse(surface);
    const tint: [number, number, number] = [
      Math.round(bg[0] * 0.1 + s[0] * 0.9),
      Math.round(bg[1] * 0.1 + s[1] * 0.9),
      Math.round(bg[2] * 0.1 + s[2] * 0.9),
    ];
    const lum = ([r, g, b]: [number, number, number]): number => {
      const f = (c: number): number => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const la = lum(parse(font));
    const lb = lum(tint);
    return { ratio: (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05), text: textM?.[1] ?? "" };
  });
  expect(note.ratio).toBeGreaterThanOrEqual(4);
});

import { test, expect, type Locator, type Page } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";
import {
  contrastRatio,
  parseHexColor,
  mixOver,
  rgbToHex,
} from "../../src/editors/orchestration/color-contrast";

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

test("F：随机三元组按对比度选色且文字每次变化（高亮 + 标注）", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{bg=blue border=blue text=yellow}\n> 高亮正文\n",
    "callout-fix3-f1",
  );
  const panel = await openPanel(page, true);

  const readMark = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      const read = (name: string): string =>
        getComputedStyle(root).getPropertyValue(name).trim();
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
      const line = (state.tabs[state.activeTabId]?.content ?? "").split("\n")[0] ?? "";
      const bg = /bg=([a-z]+)/.exec(line)?.[1] ?? "";
      const text = /text=([a-z]+)/.exec(line)?.[1] ?? "";
      return {
        line,
        bg,
        text,
        fill: read(`--hl-fill-${bg}`),
        font: text === "" ? read("--app-text") : read(`--hl-font-${text}`),
      };
    });

  const seenText: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await panel.locator('[data-testid="color-random"]').click();
    const got = await readMark();
    expect((got.line.match(/\{/g) ?? [])).toHaveLength(1);
    expect(got.text).not.toBe("");
    const fill = parseHexColor(got.fill);
    const font = parseHexColor(got.font);
    expect(fill).not.toBeNull();
    expect(font).not.toBeNull();
    expect(contrastRatio(font!, fill!)).toBeGreaterThanOrEqual(3);
    seenText.push(got.text);
  }
  expect(new Set(seenText).size).toBeGreaterThanOrEqual(2);

  await openMarkdownInEdit(
    page,
    "> [!NOTE]{bg=red border=red text=yellow} 标题\n> 正文\n",
    "callout-fix3-f2",
  );
  const calloutPanel = await openPanel(page, false);
  const readNoteText = () =>
    page.evaluate(() => {
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
      const line = (state.tabs[state.activeTabId]?.content ?? "").split("\n")[0] ?? "";
      return { line, text: /text=([a-z]+)/.exec(line)?.[1] ?? "" };
    });
  const noteSeen: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await calloutPanel.locator('[data-testid="color-random-callout"]').click();
    const got = await readNoteText();
    expect((got.line.match(/\{/g) ?? [])).toHaveLength(1);
    expect(got.text).not.toBe("");
    noteSeen.push(got.text);
  }
  expect(new Set(noteSeen).size).toBeGreaterThanOrEqual(2);
  await expect(calloutPanel).toBeVisible();
  // 三次随机各是一步撤销：撤三次回到随机前。
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(100);
  }
  await expect
    .poll(() => storeContent(page))
    .toMatch(/\{bg=red border=red text=yellow\}/);
});

test("G：随机只改被点击的块，不串到第一个块", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    "> [!NOTE] 一\n> A\n\n> [!highlight]\n> B\n\n> [!TIP] 三\n> C\n",
    "callout-fix3-g",
  );
  const calloutLines = async (): Promise<string[]> =>
    (await storeContent(page))
      .split("\n")
      .filter((line) => /^>\s*\[!/.test(line));

  for (let i = 0; i < 3; i += 1) {
    const before = await calloutLines();
    const card = page.locator(".cm-callout").nth(i);
    const type = await card.getAttribute("data-callout-type");
    await card.locator(".cm-callout-content").click();
    const entry = page.locator('[data-testid="callout-color-entry"]');
    await expect(entry).toBeVisible({ timeout: 3000 });
    await entry.hover();
    const panel = page.locator('[data-testid="callout-color-panel"]');
    await expect(panel).toBeVisible({ timeout: 3000 });
    if (type === "highlight") {
      await panel.locator('[data-testid="color-random"]').click();
    } else {
      await panel.locator('[data-testid="color-random-callout"]').click();
    }
    await expect.poll(() => storeContent(page)).not.toBe(before.join("\n"));
    const after = await calloutLines();
    const changed = after
      .map((line, index) => (line === before[index] ? -1 : index))
      .filter((index) => index >= 0);
    expect(changed).toEqual([i]);
    await page.keyboard.press("Meta+z");
    await expect.poll(() => calloutLines()).toEqual(before);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
});

import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #1411：附件卡（MediaWidget kind="file"，如 `![报告](assets/report.docx)`）
 * 的「居中对齐」此前不生效——面板点居中后源码没写回，data-align 仍是 left。
 *
 * 三条断言各自钉住一个可观测面：
 * - 居中：卡片左外边距 ≈（行宽−卡宽）/2（±2px），源码写回 align=center；
 * - 左 / 右：左缘贴行左缘、右缘贴行右缘（±2px）；
 * - 预览态：同一引用在预览里按居中渲染，切回编辑态对齐保持、无残留。
 */

const APP_URL = "http://localhost:1420";
const ART = ".artifacts/1411";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const SIZES: Record<string, number> = {
  "/tmp/e1411/assets/report.docx": 12345,
  "/tmp/e1411/assets/archive.zip": 1536,
};

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: {
    getState: () => {
      setEditorMode: (mode: string) => void;
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
  __biaoyue_file_sizes__: Record<string, number>;
}

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((sizes) => {
    (window as unknown as BridgeWindow).__biaoyue_file_sizes__ = sizes;
  }, SIZES);
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(
  page: Page,
  name: string,
  doc: string,
  mode: "edit" | "preview" = "edit",
): Promise<void> {
  await page.evaluate(
    ({ name, doc, mode }) => {
      const w = window as unknown as BridgeWindow;
      w.__biaoyue_openFile__(`/tmp/e1411/${name}.md`, doc, `${name}.md`);
      w.__biaoyue_store__.getState().setEditorMode(mode);
    },
    { name, doc, mode },
  );
  await page
    .locator(mode === "edit" ? ".cm-content" : ".preview-content")
    .waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window as unknown as BridgeWindow;
    const st = w.__biaoyue_store__.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

interface AlignMetrics {
  cardLeft: number;
  cardRight: number;
  cardWidth: number;
  cardOuterLeft: number;
  cardOuterRight: number;
  lineLeft: number;
  lineRight: number;
  lineWidth: number;
  contentLeft: number;
  contentRight: number;
  align: string | null;
  lineTextAlign: string;
}

function measureCard(page: Page): Promise<AlignMetrics | null> {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(
      '.cm-media-widget[data-media-kind="file"]',
    );
    if (!card) return null;
    const line = card.closest(".cm-line") as HTMLElement | null;
    if (!line) return null;
    const c = card.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const marginLeft = parseFloat(cs.marginLeft) || 0;
    const marginRight = parseFloat(cs.marginRight) || 0;
    const lcs = getComputedStyle(line);
    const padLeft = parseFloat(lcs.paddingLeft) || 0;
    const padRight = parseFloat(lcs.paddingRight) || 0;
    return {
      cardLeft: c.left,
      cardRight: c.right,
      cardWidth: c.width,
      cardOuterLeft: c.left - marginLeft,
      cardOuterRight: c.right + marginRight,
      lineLeft: l.left,
      lineRight: l.right,
      lineWidth: l.width,
      contentLeft: l.left + padLeft,
      contentRight: l.right - padRight,
      align: card.dataset.align ?? null,
      lineTextAlign: getComputedStyle(line).textAlign,
    };
  });
}

async function selectCard(page: Page): Promise<void> {
  const card = page.locator('.cm-media-widget[data-media-kind="file"]');
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.locator('[data-testid="embed-panel"]')).toBeVisible();
  await expect(card).toHaveAttribute("data-selected", "true");
}

test("居中：卡片水平居中且源码写回 align=center", async ({ page }) => {
  await openDoc(page, "center", "![报告](assets/report.docx)\n");
  await selectCard(page);

  await expect
    .poll(async () => {
      const m = await measureCard(page);
      return m?.lineTextAlign;
    })
    .toBe("start");

  await page.locator('[data-testid="embed-panel-align-center"]').click();

  await expect
    .poll(async () => (await measureCard(page))?.align)
    .toBe("center");
  await expect.poll(() => content(page)).toContain("align=center");

  const m = (await measureCard(page))!;
  const contentWidth = m.contentRight - m.contentLeft;
  const expected = m.contentLeft + (contentWidth - m.cardWidth) / 2;
  expect(Math.abs(m.cardLeft - expected)).toBeLessThanOrEqual(2);
  expect(m.lineTextAlign).toBe("center");

  await shot(page, "01-center", "center-aligned");

  // 重开文档：对齐从源码恢复，不依赖会话态。
  const saved = await content(page);
  await page.evaluate(
    (doc) => {
      const w = window as unknown as BridgeWindow;
      w.__biaoyue_openFile__("/tmp/e1411/reopen.md", doc, "reopen.md");
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    saved,
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  const reopenedCard = page.locator('.cm-media-widget[data-media-kind="file"]');
  await expect(reopenedCard).toHaveAttribute("data-align", "center");
  const reopened = (await measureCard(page))!;
  const reopenedContentWidth = reopened.contentRight - reopened.contentLeft;
  expect(
    Math.abs(
      reopened.cardLeft -
        (reopened.contentLeft +
          (reopenedContentWidth - reopened.cardWidth) / 2),
    ),
  ).toBeLessThanOrEqual(2);
});

test("左 / 右对齐：分别贴行左缘与行右缘", async ({ page }) => {
  await openDoc(page, "leftright", "![报告](assets/report.docx)\n");
  await selectCard(page);

  await page.locator('[data-testid="embed-panel-align-left"]').click();
  await expect
    .poll(async () => (await measureCard(page))?.align)
    .toBe("left");
  await expect.poll(() => content(page)).toContain("align=left");
  const left = (await measureCard(page))!;
  expect(Math.abs(left.cardOuterLeft - left.contentLeft)).toBeLessThanOrEqual(2);

  await page.locator('[data-testid="embed-panel-align-right"]').click();
  await expect
    .poll(async () => (await measureCard(page))?.align)
    .toBe("right");
  await expect.poll(() => content(page)).toContain("align=right");
  const right = (await measureCard(page))!;
  expect(
    Math.abs(right.cardOuterRight - right.contentRight),
  ).toBeLessThanOrEqual(2);
  expect(right.lineTextAlign).toBe("right");

  await shot(page, "02-left-right", "left-right-aligned");
});

test("预览态：同一引用居中渲染，切回编辑态对齐保持且无残留", async ({
  page,
}) => {
  await openDoc(page, "preview", "![报告](assets/report.docx){align=center}\n");

  const card = page.locator('.cm-media-widget[data-media-kind="file"]');
  await expect(card).toHaveAttribute("data-align", "center");
  const edit = (await measureCard(page))!;
  const editContentWidth = edit.contentRight - edit.contentLeft;
  expect(
    Math.abs(
      edit.cardLeft -
        (edit.contentLeft + (editContentWidth - edit.cardWidth) / 2),
    ),
  ).toBeLessThanOrEqual(2);

  await page.evaluate(() => {
    const w = window as unknown as BridgeWindow;
    w.__biaoyue_store__.getState().setEditorMode("preview");
  });
  const figure = page.locator(".preview-content figure");
  await expect(figure).toHaveCount(1);
  await expect(figure).toHaveAttribute("style", /text-align:center/);
  const img = figure.locator("img");
  await expect(img).toHaveAttribute("style", /margin-inline:auto/);

  const preview = await page.evaluate(() => {
    const fig = document.querySelector<HTMLElement>(".preview-content figure");
    const image = fig?.querySelector("img");
    if (!fig || !image) return null;
    const f = fig.getBoundingClientRect();
    const r = image.getBoundingClientRect();
    return {
      figLeft: f.left,
      figRight: f.right,
      imgLeft: r.left,
      imgRight: r.right,
    };
  });
  expect(preview).not.toBeNull();
  const expectedPreviewLeft =
    preview!.figLeft + (preview!.figRight - preview!.figLeft - (preview!.imgRight - preview!.imgLeft)) / 2;
  expect(Math.abs(preview!.imgLeft - expectedPreviewLeft)).toBeLessThanOrEqual(2);

  await shot(page, "03-preview", "preview-centered");

  await page.evaluate(() => {
    const w = window as unknown as BridgeWindow;
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await expect(card).toHaveAttribute("data-align", "center");
  await expect(page.locator('[data-testid="embed-panel"]')).toHaveCount(0);
  const back = (await measureCard(page))!;
  const backContentWidth = back.contentRight - back.contentLeft;
  expect(
    Math.abs(
      back.cardLeft -
        (back.contentLeft + (backContentWidth - back.cardWidth) / 2),
    ),
  ).toBeLessThanOrEqual(2);
});

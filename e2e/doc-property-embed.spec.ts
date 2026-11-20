import { test, expect, type Page } from "@playwright/test";
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

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(page: Page, content = EMBED_DOC): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, "embed.md");
    },
    { path: "/Users/test/embed.md", content },
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

test.beforeEach(async ({ page }) => {
  await boot(page);
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
  const block = page.locator(".content-scroll > .doc-property-embed-preview");
  await expect(block).toHaveCount(1);
  await expect(block.locator('[data-testid="dpb-a"]')).toBeVisible();

  const beforeTitle = await page
    .locator(".content-scroll")
    .first()
    .evaluate((el) => {
      const b = el.querySelector(":scope > .doc-property-embed-preview");
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

test("源码态：不渲染属性块，YAML 完整可见", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "source");
  await expect(page.locator(".cm-dpb-embed")).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-a"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="doc-property-host"]')).toHaveCount(
    0,
  );
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

  await page.keyboard.press("Meta+Shift+Y");
  await expect(embed).toHaveCount(1);
  await expect(page.locator('[data-testid="dpb-a"]')).toBeVisible();
  await expect(page.locator('[data-testid="dpb-hidden-note"]')).toHaveCount(0);
  await dpbRecord(page, "1215", "06-restored");
});

test("宽度：属性块与正文测量列同宽（A/B 两态）", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await page.evaluate((v) => {
      (window as any).__biaoyue_doc_property__.getState().setVariant(v);
    }, variant);
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
  await page.evaluate(() => {
    (window as any).__biaoyue_doc_property__.getState().setVariant("B");
  });
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

import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = "http://localhost:1424";
// 复现文档的 fixture（原文件是用户 iCloud 读书笔记，这里只取三处目标块所在的
// 小节，逐字保留围栏与列表嵌套结构，保证测试可移植）。
const DOC_PATH = path.resolve(
  process.cwd(),
  "e2e/fixtures/mermaid-handle-anchor-repro.md",
);
const ART = path.resolve(process.cwd(), ".artifacts/836");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const TARGETS = [
  {
    name: "pseudo-timeline",
    marker: "subgraph 力量传导过程",
    shot: "handle-anchored",
  },
  {
    name: "icon-enhanced",
    marker: "💣 危机火药",
    shot: "icon-enhanced-handle",
  },
  {
    name: "color-coded",
    marker: "A[自满状态]:::red",
    shot: "color-coded-handle",
  },
];

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
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

async function openDoc(page: Page, content: string) {
  await page.evaluate((c) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/mermaid-handle-anchor.md",
      c,
      "mermaid-handle-anchor.md",
    );
  }, content);
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  return editor;
}

/** 滚动到目标 mermaid 块挂载，并让它居于编辑区垂直中部。 */
async function mountAndCenter(page: Page, marker: string) {
  const loc = page.locator(
    `.cm-mermaid-block:has(pre.mermaid:has-text("${marker}"))`,
  );
  await page.mouse.move(600, 400);
  for (let i = 0; i < 60; i += 1) {
    if ((await loc.count()) > 0) break;
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
  }
  await expect(loc).toHaveCount(1, { timeout: 5000 });
  await page.evaluate((m) => {
    const blocks = Array.from(
      document.querySelectorAll(".cm-mermaid-block"),
    ) as HTMLElement[];
    const hit = blocks.find((b) =>
      (b.querySelector("pre.mermaid")?.textContent ?? "").includes(m),
    );
    hit?.scrollIntoView({ block: "center" });
  }, marker);
  await page.waitForTimeout(250);
  return loc.first();
}

interface Geom {
  widgetFrom: string;
  widget: { left: number; top: number; right: number; bottom: number };
  base: { left: number; top: number };
  content: { left: number; width: number };
  editorBottom: number;
}

async function geometry(page: Page, marker: string): Promise<Geom> {
  return page.evaluate((m) => {
    const view = document.querySelector(".cm-editor") as HTMLElement;
    const base = view.getBoundingClientRect();
    const blocks = Array.from(
      document.querySelectorAll(".cm-mermaid-block"),
    ) as HTMLElement[];
    const hit = blocks.find((b) =>
      (b.querySelector("pre.mermaid")?.textContent ?? "").includes(m),
    )!;
    const r = hit.getBoundingClientRect();
    const contentEl = document.querySelector(".cm-content") as HTMLElement;
    const cr = contentEl.getBoundingClientRect();
    return {
      widgetFrom: hit.dataset.mermaidFrom ?? "",
      widget: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      base: { left: base.left, top: base.top },
      content: { left: cr.left, width: cr.width },
      editorBottom: base.bottom,
    };
  }, marker);
}

interface HandleBox {
  from: number;
  cx: number;
  cy: number;
}

async function visibleHandles(page: Page): Promise<HandleBox[]> {
  return page.evaluate(() => {
    const view = document.querySelector(".cm-editor") as HTMLElement;
    const base = view.getBoundingClientRect();
    return Array.from(
      document.querySelectorAll(".cm-block-handle.cm-block-handle-visible"),
    ).map((h) => {
      const r = (h as HTMLElement).getBoundingClientRect();
      return {
        from: Number(h.getAttribute("data-block-from")),
        cx: r.left + r.width / 2 - base.left,
        cy: r.top + r.height / 2 - base.top,
      };
    });
  });
}

async function menuCenterY(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="block-menu"]',
    ) as HTMLElement;
    const view = document.querySelector(".cm-editor") as HTMLElement;
    const base = view.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 - base.top;
  });
}

test("复现文档三处 mermaid 手柄各 1 且锚定到块装饰矩形", async ({ page }) => {
  const content = readFileSync(DOC_PATH, "utf-8");
  await openDoc(page, content);
  await page.waitForTimeout(500);

  const anchored: HandleBox[] = [];
  for (const target of TARGETS) {
    await mountAndCenter(page, target.marker);
    const geom = await geometry(page, target.marker);
    expect(geom.widgetFrom).not.toBe("");

    const editorCenterY = (geom.base.top + geom.editorBottom) / 2;
    const hoverY = Math.max(
      geom.widget.top + 16,
      Math.min(editorCenterY, geom.widget.bottom - 16),
    );
    const hoverX = geom.content.left + geom.content.width * 0.1;
    await page.mouse.move(20, 20);
    await page.waitForTimeout(120);
    await page.mouse.move(hoverX, hoverY, { steps: 4 });
    await page.waitForTimeout(450);

    const mine = (await visibleHandles(page)).filter(
      (h) => h.from === Number(geom.widgetFrom),
    );
    expect(mine, `${target.name} 手柄节点数`).toHaveLength(1);

    // 锚定判据：手柄中心在块装饰左缘之左，而不是停在右缘（A-3.1 / D1）。
    const widgetLeft = geom.widget.left - geom.base.left;
    const widgetTop = geom.widget.top - geom.base.top;
    const widgetBottom = geom.widget.bottom - geom.base.top;
    expect(mine[0].cx, `${target.name} 手柄锚定到块左缘`).toBeLessThan(
      widgetLeft,
    );
    expect(
      mine[0].cy,
      `${target.name} 手柄夹在块矩形内`,
    ).toBeGreaterThanOrEqual(widgetTop);
    expect(mine[0].cy, `${target.name} 手柄夹在块矩形内`).toBeLessThanOrEqual(
      widgetBottom,
    );

    await shot(page, target.shot, `${target.name}-handle`);
    anchored.push(mine[0]);
  }
  expect(anchored).toHaveLength(3);
});

test("伪动画时间轴转换菜单垂直中心与手柄中心偏差 ≤2px", async ({ page }) => {
  const content = readFileSync(DOC_PATH, "utf-8");
  await openDoc(page, content);
  await page.waitForTimeout(500);

  const target = TARGETS[0];
  await mountAndCenter(page, target.marker);
  const geom = await geometry(page, target.marker);
  const editorCenterY = (geom.base.top + geom.editorBottom) / 2;
  const hoverY = Math.max(
    geom.widget.top + 16,
    Math.min(editorCenterY, geom.widget.bottom - 16),
  );
  await page.mouse.move(20, 20);
  await page.waitForTimeout(120);
  await page.mouse.move(geom.content.left + geom.content.width * 0.1, hoverY, {
    steps: 4,
  });
  await page.waitForTimeout(450);

  const mine = (await visibleHandles(page)).filter(
    (h) => h.from === Number(geom.widgetFrom),
  );
  expect(mine).toHaveLength(1);
  const handle = mine[0];

  await page.mouse.move(geom.base.left + handle.cx, geom.base.top + handle.cy, {
    steps: 3,
  });
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
  const menuY = await menuCenterY(page);
  expect(Math.abs(menuY - handle.cy)).toBeLessThanOrEqual(2);

  await shot(page, "menu-attached", "menu-attached");
  await shot(page, "menu-center-aligned", "menu-center-aligned");
});

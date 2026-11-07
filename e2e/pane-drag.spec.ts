import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 拖拽换位与四向落区（layout-portal 5.1 / #175）。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 App 暴露的 `window.__biaoyue_store__`
 * 桥驱动与断言状态；拖拽用真实 pointer 事件（非 HTML5 DnD）。
 * ⌘ 会被宿主 chrome 抢走，用 Control 作 meta 修饰键（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1420";
const SPLIT_RIGHT = "Control+Alt+ArrowRight";
const SPLIT_DOWN = "Control+Alt+ArrowDown";
const ART = path.resolve(process.cwd(), ".artifacts/175");
const ART272 = path.resolve(process.cwd(), ".artifacts/272");

mkdirSync(ART, { recursive: true });
mkdirSync(ART272, { recursive: true });

type Store = {
  getState: () => {
    scene: string;
    focusedPaneId: string;
    paneRoot: unknown;
    tabs: Record<string, { path: string | null }>;
    paneLayoutJson: () => string;
    setPaneRatio: (branchId: string, ratio: number) => void;
    focusPane: (id: string) => void;
  };
};

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openFile(page: Page, p: string): Promise<void> {
  await page.evaluate((file) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__(file, `# ${file.split("/").pop()}\n\n内容。`, "doc");
  }, p);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { __biaoyue_store__: Store }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

async function paneIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator("[data-pane-id]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-pane-id")));
}

async function focusedId(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __biaoyue_store__: Store }
      ).__biaoyue_store__.getState().focusedPaneId,
  );
}

async function paneTabPaths(
  page: Page,
  paneId: string,
): Promise<(string | null)[]> {
  return page.evaluate((id) => {
    const st = (
      window as unknown as { __biaoyue_store__: Store }
    ).__biaoyue_store__.getState();
    type Leaf = { type: string; id: string; tabs: string[] };
    type Node = { type: string; children: [unknown, unknown] };
    const find = (node: unknown): Leaf | null => {
      const n = node as Leaf | Node;
      if (n.type === "leaf") return (n as Leaf).id === id ? (n as Leaf) : null;
      const br = n as Node;
      return find(br.children[0]) ?? find(br.children[1]);
    };
    const leaf = find(st.paneRoot);
    return leaf ? leaf.tabs.map((t) => st.tabs[t]?.path ?? null) : [];
  }, paneId);
}

async function layoutJson(page: Page): Promise<string> {
  return page.evaluate(() =>
    (window as unknown as { __biaoyue_store__: Store }).__biaoyue_store__
      .getState()
      .paneLayoutJson(),
  );
}

/** 在格头里找一个不属于页签/按钮的空白点（拖拽源）。 */
async function emptyHeaderPoint(
  page: Page,
  paneId: string,
): Promise<{ x: number; y: number }> {
  const header = page.locator(
    `[data-pane-id="${paneId}"] [data-testid="pane-header"]`,
  );
  const box = await header.boundingBox();
  if (!box) throw new Error("格头不可测量");
  const y = box.y + box.height / 2;
  for (const frac of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
    const x = box.x + box.width * frac;
    const ok = await page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py);
        return (
          !!el &&
          !el.closest('[data-tab-id],button,input,[data-testid="pane-menu"]')
        );
      },
      [x, y],
    );
    if (ok) return { x, y };
  }
  throw new Error("格头没有可拖拽的空白区");
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 6, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

function shot(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART, `${name}.png`) });
}

function shot272(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART272, `${name}.png`) });
}

test("中心释放：两格互换，各自页签随行、比例锚定不变", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");

  const p2 = await focusedId(page);
  expect(p2).not.toBe("main");

  // 比例设成非默认 0.4：互换后必须仍是 0.4（ratio 锚在结构位置）
  await page.evaluate(() => {
    const s = (
      window as unknown as { __biaoyue_store__: Store }
    ).__biaoyue_store__.getState();
    const root = s.paneRoot as { type: string; id: string };
    s.setPaneRatio(root.id, 0.4);
  });
  const before = JSON.parse(await layoutJson(page));
  expect(before.root.ratio).toBeCloseTo(0.4, 3);

  const from = await emptyHeaderPoint(page, "main");
  const p2box = await page.locator(`[data-pane-id="${p2}"]`).boundingBox();
  if (!p2box) throw new Error("目标格不可测量");
  await drag(page, from, {
    x: p2box.x + p2box.width / 2,
    y: p2box.y + p2box.height / 2,
  });

  // 落区预览：中心
  const indicator = page.locator('[data-testid="pane-drop-indicator"]');
  await expect(indicator).toHaveAttribute("data-drop-zone", "center");
  await shot(page, "pane-drag-center-indicator");
  await page.mouse.up();

  // 位置互换：main 的格移到原来 p2 的位置（右），各自页签不变
  await expect.poll(() => paneIds(page)).toEqual([p2, "main"]);
  expect(await paneTabPaths(page, "main")).toEqual(["/tmp/pd/a.md"]);
  expect(await paneTabPaths(page, p2)).toEqual(["/tmp/pd/b.md"]);
  // 比例维持结构位置不变
  const after = JSON.parse(await layoutJson(page));
  expect(after.root.ratio).toBeCloseTo(0.4, 3);
  await expect(page.locator('[data-testid="pane-drop-indicator"]')).toHaveCount(
    0,
  );
  await shot(page, "after-swap");
});

test("右边释放：源格移动为目标右邻格，无残留指示", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");
  const p2 = await focusedId(page);

  const from = await emptyHeaderPoint(page, "main");
  const p2box = await page.locator(`[data-pane-id="${p2}"]`).boundingBox();
  if (!p2box) throw new Error("目标格不可测量");
  await drag(page, from, {
    x: p2box.x + p2box.width * 0.85,
    y: p2box.y + p2box.height / 2,
  });
  await expect(
    page.locator('[data-testid="pane-drop-indicator"]'),
  ).toHaveAttribute("data-drop-zone", "right");
  await shot(page, "pane-drag-edge-indicator");
  await page.mouse.up();

  // 顺序：[b 的格, a 的格] —— a 成了 b 的右邻
  await expect.poll(() => paneIds(page)).toEqual([p2, "main"]);
  expect(await paneTabPaths(page, p2)).toEqual(["/tmp/pd/b.md"]);
  expect(await paneTabPaths(page, "main")).toEqual(["/tmp/pd/a.md"]);
  await expect(page.locator('[data-testid="pane-drop-indicator"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-testid="root-drop-indicator"]')).toHaveCount(
    0,
  );
});

test("窗口右缘释放：源格提到根层独立格", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");
  const p2 = await focusedId(page);
  await page.keyboard.press(SPLIT_DOWN);
  await expect.poll(() => paneIds(page)).toHaveLength(3);

  const from = await emptyHeaderPoint(page, "main");
  const vp = page.viewportSize();
  if (!vp) throw new Error("视口不可测量");
  await drag(page, from, { x: vp.width - 4, y: vp.height / 2 });

  await expect(
    page.locator('[data-testid="root-drop-indicator"]'),
  ).toHaveAttribute("data-drop-zone", "root-right");
  await shot(page, "pane-drag-root-indicator");
  await page.mouse.up();

  // main 变成根分支的直接子格（深度 1），另一支是原来挂 p2/p3 的分支
  const root = (await page.evaluate(
    () =>
      (
        window as unknown as { __biaoyue_store__: Store }
      ).__biaoyue_store__.getState().paneRoot,
  )) as {
    type: string;
    dir: string;
    children: Array<{ type: string; id?: string }>;
  };
  expect(root.type).toBe("node");
  expect(root.dir).toBe("row");
  expect(root.children[1].type).toBe("leaf");
  expect(root.children[1].id).toBe("main");
  expect(root.children[0].type).toBe("node");
  // p2 仍在树里
  expect(await paneTabPaths(page, p2)).toEqual(["/tmp/pd/b.md"]);
  await expect(page.locator('[data-testid="root-drop-indicator"]')).toHaveCount(
    0,
  );
});

test("Esc 取消拖拽：布局 JSON 逐字节不变、无残留指示", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");
  const p2 = await focusedId(page);

  // 先让源格获得焦点：mousedown 触发聚焦是既有点击行为，不算拖拽残留
  await page.evaluate(() => {
    (window as unknown as { __biaoyue_store__: Store }).__biaoyue_store__
      .getState()
      .focusPane("main");
  });

  const before = await layoutJson(page);
  const from = await emptyHeaderPoint(page, "main");
  const p2box = await page.locator(`[data-pane-id="${p2}"]`).boundingBox();
  if (!p2box) throw new Error("目标格不可测量");
  await drag(page, from, {
    x: p2box.x + p2box.width / 2,
    y: p2box.y + p2box.height / 2,
  });
  await expect(page.locator('[data-testid="pane-drop-indicator"]')).toHaveCount(
    1,
  );

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="pane-drop-indicator"]')).toHaveCount(
    0,
  );
  await page.mouse.up();

  expect(await layoutJson(page)).toBe(before);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
});

test("文件拖到右半区：右侧分裂出新格，文件只在新格", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await expect.poll(() => paneIds(page)).toHaveLength(1);

  // 左侧阅读空间：mock 配置里已有最近文件，悬停展开后作为拖拽源
  await page.hover('[data-testid="rail-edge"]');
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
  const row = page
    .locator('[data-rail-path="/Users/test/测试文档.md"]')
    .first();
  await expect(row).toBeVisible();

  const from = await row.boundingBox();
  const mainBox = await page.locator('[data-pane-id="main"]').boundingBox();
  if (!from || !mainBox) throw new Error("拖拽目标不可测量");
  await drag(
    page,
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: mainBox.x + mainBox.width * 0.85, y: mainBox.y + mainBox.height / 2 },
  );

  await expect(
    page.locator('[data-testid="pane-drop-indicator"]'),
  ).toHaveAttribute("data-drop-zone", "right");
  await page.mouse.up();

  await expect.poll(() => paneIds(page)).toHaveLength(2);
  const ids = await paneIds(page);
  const newPane = ids.find((id) => id !== "main") ?? "";
  expect(newPane).not.toBe("");
  expect(await paneTabPaths(page, newPane)).toEqual([
    "/Users/test/测试文档.md",
  ]);
  expect(await paneTabPaths(page, "main")).toEqual(["/tmp/pd/a.md"]);
  await expect(page.locator('[data-testid="pane-drop-indicator"]')).toHaveCount(
    0,
  );
  await shot(page, "file-drop-right-split");
});

type LayoutNode = {
  type: "node" | "leaf";
  id: string;
  ratio?: number;
  children?: [LayoutNode, LayoutNode];
  tabs?: string[];
};

async function layout(page: Page): Promise<LayoutNode> {
  const parsed = JSON.parse(await layoutJson(page)) as { root: LayoutNode };
  return parsed.root;
}

test("拖动根分隔线只改自己的分支，内层分支比例不变（#272）", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");

  // 左侧再竖分一次：root = row[ col[main, p3], p2 ]
  await page.evaluate(() => {
    (window as unknown as { __biaoyue_store__: Store }).__biaoyue_store__
      .getState()
      .focusPane("main");
  });
  await page.keyboard.press(SPLIT_DOWN);
  await expect.poll(() => paneIds(page)).toHaveLength(3);

  const before = await layout(page);
  const innerId = before.children![0].id;
  await page.evaluate((id) => {
    (window as unknown as { __biaoyue_store__: Store }).__biaoyue_store__
      .getState()
      .setPaneRatio(id, 0.3);
  }, innerId);
  const rooted = await layout(page);
  expect(rooted.children![0].ratio).toBeCloseTo(0.3, 3);

  const divider = page.locator(`[data-pane-divider="${before.id}"]`);
  const box = await divider.boundingBox();
  if (!box) throw new Error("分隔线不可测量");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 8 });
  await page.mouse.up();

  const after = await layout(page);
  expect(after.ratio).not.toBeCloseTo(0.5, 3);
  expect(after.children![0].ratio).toBeCloseTo(0.3, 3);
  await shot272(page, "divider-independent");
});

test("拖页签跨格：页签搬走、格数量不变（#272）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/b.md");
  const p2 = await focusedId(page);

  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  const tabBox = await tab.boundingBox();
  const target = page.locator(`[data-pane-id="${p2}"]`);
  const targetBox = await target.boundingBox();
  if (!tabBox || !targetBox) throw new Error("拖拽端点不可测量");

  await page.mouse.move(
    tabBox.x + tabBox.width / 2,
    tabBox.y + tabBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 10 },
  );
  // 目标格落区环 + 插入轨迹
  await expect(target).toHaveAttribute("data-tab-drop", "true");
  await expect(
    page.locator('[data-testid="tab-drag-placeholder"]'),
  ).toBeVisible();
  await shot272(page, "tab-drag-track");
  await page.mouse.up();

  await expect.poll(() => paneIds(page)).toHaveLength(2);
  expect(await paneTabPaths(page, "main")).toEqual([]);
  expect(await paneTabPaths(page, p2)).toEqual([
    "/tmp/pd/b.md",
    "/tmp/pd/a.md",
  ]);
});

test("页签右键分栏把文件搬进新格（#272）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await expect.poll(() => paneIds(page)).toHaveLength(1);

  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  await tab.click({ button: "right" });
  await page.getByText("向右分栏", { exact: true }).click();

  await expect.poll(() => paneIds(page)).toHaveLength(2);
  expect(await paneTabPaths(page, "main")).toEqual([]);
  const ids = await paneIds(page);
  const newPane = ids.find((id) => id !== "main") ?? "";
  expect(newPane).not.toBe("");
  expect(await paneTabPaths(page, newPane)).toEqual(["/tmp/pd/a.md"]);
  await shot272(page, "context-split-moved");
});

test("关闭页签后布局仍可拖拽分隔线（#272）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pd/a.md");
  await openFile(page, "/tmp/pd/b.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneIds(page)).toHaveLength(2);
  await openFile(page, "/tmp/pd/c.md");

  // 关掉 main 的第一个页签：main 仍有另一个页签，布局保留
  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  await tab.hover();
  await tab.locator("button").click();
  await expect.poll(() => paneTabPaths(page, "main")).toEqual(["/tmp/pd/b.md"]);

  const before = await layout(page);
  const divider = page.locator(`[data-pane-divider="${before.id}"]`);
  const box = await divider.boundingBox();
  if (!box) throw new Error("分隔线不可测量");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy, { steps: 8 });
  await page.mouse.up();

  expect((await layout(page)).ratio).not.toBeCloseTo(0.5, 3);
  await shot272(page, "close-tab-layout");
});

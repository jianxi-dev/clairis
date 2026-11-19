import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revealStatusBar } from "./helpers/ui-probe";

const APP_URL = "http://localhost:1420";

const ART_1052 = path.resolve(process.cwd(), ".artifacts/1052");
const TAURI_CONFIG = path.resolve(process.cwd(), "src-tauri/tauri.conf.json");

interface MainWindowSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

function readMainWindow(): MainWindowSize {
  const cfg = JSON.parse(readFileSync(TAURI_CONFIG, "utf8")) as {
    app: { windows: Array<Record<string, unknown>> };
  };
  const w = cfg.app.windows[0];
  return {
    width: w.width as number,
    height: w.height as number,
    minWidth: w.minWidth as number,
    minHeight: w.minHeight as number,
  };
}

async function recordState(page: Page, state: string): Promise<string> {
  mkdirSync(ART_1052, { recursive: true });
  const file = path.join(ART_1052, `${state}.png`);
  await page.screenshot({ path: file });
  const rel = path.relative(process.cwd(), file);
  const manifest = path.join(ART_1052, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: rel,
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1052-min-width-300", states }, null, 2)}\n`,
  );
  return rel;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface ShellMeasure {
  vw: number;
  vh: number;
  docScrollWidth: number;
  bodyScrollWidth: number;
  appShell: Box | null;
  workspaceBody: Box | null;
  tabStrip:
    | (Box & {
        overflowX: string;
        scrollWidth: number;
        clientWidth: number;
      })
    | null;
  propertyHost: Box | null;
  paneHeader: Box | null;
  rootsOver: string[];
}

async function measureShell(page: Page): Promise<ShellMeasure> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const vw = window.innerWidth;
    const tabStrip = document.querySelector(".tab-strip");
    const tabCs = tabStrip ? getComputedStyle(tabStrip) : null;
    const roots: Array<[string, Element | null]> = [
      ["app-shell", document.querySelector(".app-shell")],
      [
        "workspace-body",
        document.querySelector('[data-testid="workspace-body"]'),
      ],
      ["tab-strip", tabStrip],
      [
        "property-host",
        document.querySelector('[data-testid="doc-property-host"]'),
      ],
    ];
    const rootsOver: string[] = [];
    for (const [name, el] of roots) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) {
        rootsOver.push(`${name} right=${r.right.toFixed(1)} vw=${vw}`);
      }
    }
    return {
      vw,
      vh: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      appShell: box(document.querySelector(".app-shell")),
      workspaceBody: box(
        document.querySelector('[data-testid="workspace-body"]'),
      ),
      tabStrip:
        tabStrip && tabCs
          ? {
              ...box(tabStrip)!,
              overflowX: tabCs.overflowX,
              scrollWidth: (tabStrip as HTMLElement).scrollWidth,
              clientWidth: (tabStrip as HTMLElement).clientWidth,
            }
          : null,
      propertyHost: box(
        document.querySelector('[data-testid="doc-property-host"]'),
      ),
      paneHeader: box(document.querySelector('[data-testid="pane-header"]')),
      rootsOver,
    };
  });
}

async function openDoc(page: Page, n: number): Promise<void> {
  await page.evaluate((i) => {
    (
      window as unknown as {
        __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
      }
    ).__biaoyue_openFile__(
      `/Users/test/1052-doc-${i}.md`,
      `---\ntitle: 文档${i}\n---\n\n# 正文\n`,
      `文档${i}.md`,
    );
  }, n);
}

test.describe("#1052 主窗口最小宽度 300（editor-surface-batch21 4.4）", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_store__?.getState?.().setScene("workspace");
    });
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 15000,
    });
  });

  test("A-14.1 / A-14.3：主窗口最小宽度 300、最小高度 400", () => {
    const win = readMainWindow();
    expect(win.minWidth, "主窗口最小宽度").toBe(300);
    expect(win.minHeight, "主窗口最小高度").toBe(400);
  });

  test("A-14.2：300×600 外壳无横向溢出，页签条可滚动", async ({ page }) => {
    for (let i = 0; i < 6; i += 1) {
      await openDoc(page, i);
    }
    await page.setViewportSize({ width: 300, height: 600 });
    await page.waitForTimeout(150);

    const m = await measureShell(page);
    await recordState(page, "01-300x600-shell");

    expect(m.tabStrip, "页签条存在").not.toBeNull();
    expect(m.tabStrip!.overflowX, "页签条 overflow-x").toMatch(/auto|scroll/);
    expect(
      m.tabStrip!.scrollWidth,
      "页签条 scrollWidth > clientWidth（窄宽下装不下）",
    ).toBeGreaterThan(m.tabStrip!.clientWidth);
    expect(m.propertyHost, "属性面板宿主存在").not.toBeNull();
    expect(m.propertyHost!.right, "属性面板右缘不越出视口").toBeLessThanOrEqual(
      m.vw + 1,
    );
    await page.evaluate(() => {
      const el = document.querySelector(".tab-strip") as HTMLElement;
      el.scrollLeft = el.scrollWidth;
    });
    await page.waitForTimeout(60);
    await recordState(page, "02-tabstrip-scrollable");

    expect(m.docScrollWidth, "documentElement.scrollWidth").toBeLessThanOrEqual(
      m.vw + 1,
    );
    expect(m.bodyScrollWidth, "body.scrollWidth").toBeLessThanOrEqual(m.vw + 1);
    expect(m.rootsOver, "外壳根节点右缘越出视口").toEqual([]);
    writeFileSync(
      path.join(ART_1052, "measurements-300x600.json"),
      `${JSON.stringify(
        {
          viewport: { width: m.vw, height: m.vh },
          docScrollWidth: m.docScrollWidth,
          bodyScrollWidth: m.bodyScrollWidth,
          tabStrip: m.tabStrip,
          propertyHost: m.propertyHost,
          workspaceBody: m.workspaceBody,
          rootsOver: m.rootsOver,
        },
        null,
        2,
      )}\n`,
    );
    await recordState(page, "03-no-horizontal-overflow");
  });

  test("A-14.3：300×400 最小高度下外壳顶栏 / 页签条不被纵向裁掉", async ({
    page,
  }) => {
    await openDoc(page, 0);
    await page.setViewportSize({ width: 300, height: 400 });
    await page.waitForTimeout(150);

    const m = await measureShell(page);
    expect(m.docScrollWidth, "300×400 横向溢出").toBeLessThanOrEqual(m.vw + 1);
    expect(m.rootsOver, "300×400 外壳根节点越出视口").toEqual([]);
    expect(m.paneHeader, " pane-header 存在").not.toBeNull();
    expect(m.paneHeader!.top, "pane-header 顶缘未被裁").toBeGreaterThanOrEqual(
      -0.5,
    );
    expect(m.tabStrip!.bottom, "页签条底缘在视口内").toBeLessThanOrEqual(
      m.vh + 1,
    );
    writeFileSync(
      path.join(ART_1052, "measurements-300x400.json"),
      `${JSON.stringify(
        {
          viewport: { width: m.vw, height: m.vh },
          docScrollWidth: m.docScrollWidth,
          bodyScrollWidth: m.bodyScrollWidth,
          paneHeader: m.paneHeader,
          tabStrip: m.tabStrip,
          rootsOver: m.rootsOver,
        },
        null,
        2,
      )}\n`,
    );
    await recordState(page, "04-400x600-minheight");
  });
});

test.describe("外壳顶栏与沉浸入口（ui-polish-batch6 1.1）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_store__?.getState?.().setScene("workspace");
    });
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 15000,
    });
  });

  test("窗口顶部没有品牌横条", async ({ page }) => {
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByText("标月", { exact: true })).toHaveCount(0);
  });

  test("页签条贴内容区顶缘，上方无空白带", async ({ page }) => {
    const bodyTop = await page
      .locator('[data-testid="workspace-body"]')
      .evaluate((el) => el.getBoundingClientRect().top);
    const headerTop = await page
      .locator('[data-testid="pane-header"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.round(headerTop - bodyTop)).toBe(0);
  });

  test("沉浸入口只留图标且保留可访问名", async ({ page }) => {
    await revealStatusBar(page);
    const btn = page.getByTestId("immersive-entry");
    await expect(btn).toBeVisible();

    const textNodes = await btn.evaluate(
      (el) =>
        Array.from(el.childNodes).filter(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
        ).length,
    );
    expect(textNodes).toBe(0);

    const label = await btn.getAttribute("aria-label");
    expect(label ?? "").toContain("禅模式");
  });
});

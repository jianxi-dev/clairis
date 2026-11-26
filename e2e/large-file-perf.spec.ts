import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #1556 大文件录入卡顿：性能探针 + 回归门禁。
 *
 * 真实链路：打开约 14KB（含图片 / 高亮块 / 表格 / 围栏等装饰元素）的 Markdown
 * 进入编辑态，用真实键盘逐键输入，测量：
 *   - 单键「输入 → 下一帧」的主线程耗时（rAF 帧间隔，用户可感知卡顿的口径）
 *   - 装饰全量重建次数与累计耗时（`__biaoyue_decor_perf__` 桥，模块级计数器）
 *   - 连续输入 100 字符无崩溃、无页面异常
 *
 * 对照 60KB 文档（应触发 50K 快路径）：同口径测量，用于判定「阈值断层」是否
 * 为根因——若 60KB 单键耗时显著低于 14KB，说明快路径有效而 14KB 未享受。
 *
 * 计时一律走 performance.now / rAF，不用固定 sleep 充当性能测量。
 */

const APP_URL = "http://localhost:1425";
const ART = path.resolve(process.cwd(), ".artifacts/1556");
mkdirSync(ART, { recursive: true });

const MOD = process.platform === "darwin" ? "Meta" : "Control";

interface BridgeState {
  setEditorMode: (mode: string) => void;
  tabs: Record<string, { content: string; contentRevision?: number }>;
  activeTabId: string;
}

interface DecorPerf {
  getDecorationBuildCount: () => number;
  getDecorationBuildMs: () => number;
  resetDecorationGuards: () => void;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
  __biaoyue_decor_perf__: DecorPerf;
}

/** 约 14KB 的装饰密集型文档：图片 / 高亮块 / 表格 / 围栏 / 列表 / 行内标记。 */
function doc14KB(): string {
  const para =
    "这是一段用于压测的正文，含 **加粗**、*斜体*、`行内代码` 与 [链接](https://example.com)，长度足够跨过段落边界。";
  const image = `![示意图](assets/missing.png){width=600}`;
  const callout = [
    "> [!WARNING]{bg=darkred border=green text=yellow}",
    "> 标注正文，含 `行内代码` 与 **粗体**，继续把块撑高。",
    "> 第二行。",
  ].join("\n");
  const table = [
    "| 列 A | 列 B | 列 C |",
    "| --- | --- | --- |",
    "| 内容甲 | 内容乙 | 内容丙 |",
    "| 内容丁 | 内容戊 | 内容己 |",
  ].join("\n");
  const fence = ["```ts", "const value = 1;", "console.log(value);", "```"].join(
    "\n",
  );
  const list = [
    "1. 第一项",
    "2. 第二项",
    "   - [ ] 子项一",
    "   - [x] 子项二",
    "- 无序甲",
    "- 无序乙",
  ].join("\n");
  const block = [
    para,
    "",
    image,
    "",
    callout,
    "",
    table,
    "",
    fence,
    "",
    list,
    "",
  ].join("\n");
  return `# 压测标题\n\n${block}\n`.repeat(40);
}

/** 约 60KB 的同结构文档（重复更多次），用于触发 50K 快路径对照。 */
function doc60KB(): string {
  const para =
    "这是一段用于压测的正文，含 **加粗**、*斜体*、`行内代码` 与 [链接](https://example.com)，长度足够跨过段落边界。";
  const image = "![示意图](assets/missing.png){width=600}";
  const callout = ["> [!TIP] 提示", "> 标注正文，含 `行内代码` 与 **粗体**。"].join(
    "\n",
  );
  const block = [para, "", image, "", callout, ""].join("\n");
  return `# 压测标题\n\n${block}\n`.repeat(320);
}

interface KeyTiming {
  /** 单键「键入 → 下一帧」的毫秒数（rAF 帧间隔口径）。 */
  frameMs: number;
  /** 到下一键开始前累计的装饰全量重建次数。 */
  builds: number;
  /** 到下一键开始前累计的装饰重建耗时（ms）。 */
  buildMs: number;
  /** PerformanceObserver 抓到的长任务（>50ms）累计耗时。 */
  longTaskMs: number;
}

interface Sample {
  docLabel: string;
  docChars: number;
  timings: KeyTiming[];
  pageErrors: string[];
  /** 连续输入 N 字符的总耗时（ms）。 */
  totalMs: number;
}

function installConsole(page: Page): void {
  page.on("console", (msg) => {
    if (msg.type() === "log") console.log(`[browser] ${msg.text()}`);
  });
}

async function openDoc(page: Page, body: string, name: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__longTasks1556 = [];
    new PerformanceObserver((list) => {
      const tasks = (window as unknown as Record<string, unknown>)
        .__longTasks1556 as number[];
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    }).observe({ entryTypes: ["longtask"] });
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ body, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/1556/${name}.md`, body, `${name}.md`);
    },
    { body, name },
  );
  // 页签自身的 editorMode 优先于全局（ContentArea 取 activeTab.editorMode），
  // 必须走真实模式按钮，否则 cmVisible=false、文档不灌进 CM6。
  const btn = page.locator('[data-testid="pane-mode"]').first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  if ((await btn.getAttribute("data-mode")) !== "edit") await btn.click();
  await expect(btn).toHaveAttribute("data-mode", "edit");
  await page.locator(".cm-content").waitFor({ timeout: 15000 });
  // 等文档全文灌进编辑器（大文档首屏同步有解析成本）。
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const cm = document.querySelector(".cm-content");
          return cm ? cm.querySelectorAll(".cm-line").length : 0;
        }),
      { timeout: 20000 },
    )
    .toBeGreaterThan(10);
}

/**
 * 装一个「下一帧」哨兵：记录起始时间与装饰计数器基线，不 resolve。
 *
 * 键入发生在哨兵装好之后；键入结束再调 `readProbe` 等**两帧**，用「键入开始
 * → 第二帧」的间隔覆盖键入当帧的主线程代价。计数器增量同样取到第二帧，
 * 否则键入当帧的重建会被算进下一键（上一版探针 builds/key 恒为 0 的原因）。
 */
async function armFrameProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const perf = (window as unknown as BridgeWindow).__biaoyue_decor_perf__;
    (window as unknown as Record<string, unknown>).__probe1556 = {
      t0: performance.now(),
      count: perf.getDecorationBuildCount(),
      ms: perf.getDecorationBuildMs(),
      longTasks: 0,
    };
  });
}

async function readProbe(page: Page): Promise<KeyTiming> {
  return page.evaluate(
    () =>
      new Promise<KeyTiming>((resolve, reject) => {
        const probe = (window as unknown as Record<string, unknown>).__probe1556 as
          | {
              t0: number;
              count: number;
              ms: number;
              longTasks: number;
            }
          | undefined;
        if (!probe) {
          reject(new Error("探针未装"));
          return;
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const perf = (window as unknown as BridgeWindow).__biaoyue_decor_perf__;
            resolve({
              frameMs: performance.now() - probe.t0,
              builds: perf.getDecorationBuildCount() - probe.count,
              buildMs: perf.getDecorationBuildMs() - probe.ms,
              longTaskMs: probe.longTasks,
            });
          });
        });
      }),
  );
}

async function measureTyping(
  page: Page,
  docLabel: string,
  docChars: number,
  keys: number,
): Promise<Sample> {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  // 光标落在正文首行（文末空行无装饰，键入不触达装饰路径，会测出假绿灯）。
  const cm = page.locator(".cm-content").first();
  await cm.click({ position: { x: 280, y: 40 } });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__longTasks1556 = [];
  });

  const timings: KeyTiming[] = [];
  const startedAt = await page.evaluate(() => performance.now());

  for (let i = 0; i < keys; i += 1) {
    const longBefore = await page.evaluate(
      () =>
        (
          (window as unknown as Record<string, unknown>).__longTasks1556 as number[]
        ).reduce((sum, d) => sum + d, 0),
    );
    await armFrameProbe(page);
    await page.keyboard.type("字");
    const timing = await readProbe(page);
    const longAfter = await page.evaluate(
      () =>
        (
          (window as unknown as Record<string, unknown>).__longTasks1556 as number[]
        ).reduce((sum, d) => sum + d, 0),
    );
    timing.longTaskMs = longAfter - longBefore;
    timings.push(timing);
  }

  const totalMs = await page.evaluate(
    (start) => performance.now() - start,
    startedAt,
  );
  return { docLabel, docChars, timings, pageErrors, totalMs };
}

function summarize(sample: Sample): {
  p50: number;
  p95: number;
  max: number;
  buildsPerKey: number;
  buildMsPerKey: number;
  longTaskMs: number;
} {
  const frames = sample.timings.map((t) => t.frameMs).sort((a, b) => a - b);
  const pct = (p: number): number =>
    frames.length === 0
      ? 0
      : frames[Math.min(frames.length - 1, Math.floor(p * frames.length))];
  const builds = sample.timings.reduce((sum, t) => sum + t.builds, 0);
  const buildMs = sample.timings.reduce((sum, t) => sum + t.buildMs, 0);
  const longTaskMs = sample.timings.reduce((sum, t) => sum + t.longTaskMs, 0);
  return {
    p50: pct(0.5),
    p95: pct(0.95),
    max: frames[frames.length - 1] ?? 0,
    buildsPerKey: builds / sample.timings.length,
    buildMsPerKey: buildMs / sample.timings.length,
    longTaskMs,
  };
}

test("14KB 与 60KB 文档逐键录入性能对照", async ({ page }) => {
  installConsole(page);
  const small = doc14KB();
  const large = doc60KB();
  console.log(`[#1556] 14KB 文档字符数=${small.length} 60KB 文档字符数=${large.length}`);
  expect(small.length).toBeGreaterThan(12_000);
  expect(small.length).toBeLessThan(20_000);
  expect(large.length).toBeGreaterThan(50_000);

  await openDoc(page, small, "doc14k");
  const s14 = await measureTyping(page, "14KB", small.length, 100);
  const sum14 = summarize(s14);
  console.log(
    `[#1556] 14KB: p50=${sum14.p50.toFixed(1)}ms p95=${sum14.p95.toFixed(1)}ms ` +
      `max=${sum14.max.toFixed(1)}ms builds/key=${sum14.buildsPerKey.toFixed(2)} ` +
      `buildMs/key=${sum14.buildMsPerKey.toFixed(1)} longTask=${sum14.longTaskMs.toFixed(0)}ms ` +
      `total=${s14.totalMs.toFixed(0)}ms errors=${s14.pageErrors.length}`,
  );

  await openDoc(page, large, "doc60k");
  const s60 = await measureTyping(page, "60KB", large.length, 100);
  const sum60 = summarize(s60);
  console.log(
    `[#1556] 60KB: p50=${sum60.p50.toFixed(1)}ms p95=${sum60.p95.toFixed(1)}ms ` +
      `max=${sum60.max.toFixed(1)}ms builds/key=${sum60.buildsPerKey.toFixed(2)} ` +
      `buildMs/key=${sum60.buildMsPerKey.toFixed(1)} longTask=${sum60.longTaskMs.toFixed(0)}ms ` +
      `total=${s60.totalMs.toFixed(0)}ms errors=${s60.pageErrors.length}`,
  );

  await page.screenshot({ path: path.join(ART, "after-typing.png") });

  expect(s14.pageErrors).toEqual([]);
  expect(s60.pageErrors).toEqual([]);

  // 视觉零差异：快路径的最终态由延迟补建那次全量重建给出，装饰 DOM 必须完整。
  const decor = await page.evaluate(() => {
    const cm = document.querySelector(".cm-content");
    if (!cm) return { classes: 0, lines: 0 };
    return {
      classes: new Set(
        Array.from(cm.querySelectorAll("[class]")).flatMap((el) =>
          Array.from(el.classList).filter((c) => c.startsWith("cm-")),
        ),
      ).size,
      lines: cm.querySelectorAll(".cm-line").length,
    };
  });
  console.log(`[#1556] 装饰 DOM：classes=${decor.classes} lines=${decor.lines}`);
  expect(decor.classes).toBeGreaterThan(5);
  expect(decor.lines).toBeGreaterThan(5);

  // 回归门禁（票面验收锚点二选一）：14KB 单键 p50 ≤16ms，或相对 before
  // (56.9ms) 改善 ≥50%。取后者为主——CI 与其他用例争用 CPU 时 16ms 会抖动，
  // 而「快路径把每键重建从 1.00 次降到 0」是结构性事实，不受负载影响。
  const beforeP50 = 56.9;
  const improved = sum14.p50 <= beforeP50 * 0.5;
  expect(improved || sum14.p50 <= 16).toBe(true);
  // 结构性门禁：快路径必须生效（每键全量重建次数为 0）。
  expect(sum14.buildsPerKey).toBe(0);
});

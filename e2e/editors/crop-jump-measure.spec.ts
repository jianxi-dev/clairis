import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1560（change=editor-surface-batch23/1.2）首次裁剪确认瞬间的跳动量化。
 *
 * 真实链路：打开「文本行 + 一张图」→ 点图 → 点裁剪 → 拖裁剪框 → 双击确认。
 * 确认前后用 rAF 逐帧采样两路信号：
 *   - `.cm-scroller` 的 scrollTop（视口滚动位置）
 *   - `.cm-image-widget` 的 getBoundingClientRect().top（图片在视口中的位置）
 * 各采 ≥20 帧，原始数组整段 console.log 到测试输出（Playwright 会把浏览器
 * console 打进报告），断言确认前后最大位移 ≤ 1px。
 *
 * 判定口径（贴票用）：
 *   - 若位移主要出现在「确认后头几帧、且 widget top 与 scrollTop 同向变化」，
 *     来源是 cleanup 尾部的 1px 滚动回弹（滚动只改合成位置，图片跟着动）。
 *   - 若 scrollTop 不动而 widget top 变，来源是裁剪显示尺寸缓存未命中的   过渡帧
 *     （图片自身高度塌陷 / 重算）。
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

const IMG = makePngDataUrl(600, 400, [90, 140, 200]);
const FRAMES = 24;

interface Sample {
  t: number;
  scrollTop: number;
  /** 确认前那个 widget 节点的视口 top；脱流后恒 0。 */
  widgetTop: number;
  /** 同一文档偏移的新 widget 节点的视口 top；重建后即它。 */
  freshTop: number;
  /** 旧节点是否还在文档里：false = 确认后组件被重建。 */
  widgetConnected: boolean;
  scrollHeight: number;
  /** 裁剪窗口高度（进入裁剪态才有）；用于识别首帧塌陷。 */
  winH?: number;
  /** 内图高度（塌陷时 ≠ 窗口高度）。 */
  imgH?: number;
}

function installSampler(page: Page): void {
  page.on("console", (msg) => {
    if (msg.type() === "log") console.log(`[browser] ${msg.text()}`);
  });
}

/**
 * rAF 逐帧采样：返回确认前 `FRAMES` 帧 + 确认后 `FRAMES` 帧。
 *
 * 两路信号都钉在**确认前那一帧已存在的节点**上：确认会重建 widget，若每帧
 * 重新 querySelector，量到的可能是新节点（位置天然为 0），位移就被抹平。
 * 钉住旧节点才是「用户看到的这一帧」的连续画面。
 *
 * 采样与确认同帧相接：先排一个 rAF，回调里取基线 → 派发确认 → 从下一帧
 * 起采样，避免两次 page.evaluate 之间的间隙把过渡帧漏掉。
 */
async function sampleAroundConfirm(page: Page): Promise<{
  before: Sample[];
  after: Sample[];
}> {
  return page.evaluate(
    async (frames) => {
      const scroller = document.querySelector<HTMLElement>(".cm-scroller");
      const widget = document.querySelector<HTMLElement>(".cm-image-widget");
      if (!scroller || !widget) {
        throw new Error("采样前缺 scroller 或 widget");
      }
      const from = widget.dataset.imageFrom ?? "";
      const read = (): Sample => {
        const fresh = scroller.querySelector<HTMLElement>(
          `.cm-image-widget[data-image-from="${from}"]`,
        );
        return {
          t: Math.round(performance.now()),
          scrollTop: scroller.scrollTop,
          widgetTop: widget.getBoundingClientRect().top,
          freshTop: fresh ? fresh.getBoundingClientRect().top : 0,
          widgetConnected: widget.isConnected,
          scrollHeight: scroller.scrollHeight,
        };
      };
      const before: Sample[] = [];
      await new Promise<void>((resolve) => {
        const step = (): void => {
          before.push(read());
          if (before.length >= frames) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      // 与最后一个 before 采样同一帧派发确认：确认的副作用（清理 / 重建）
      // 落在下一帧的布局里，被 after 的第一帧捕获。
      const after: Sample[] = [];
      await new Promise<void>((resolve) => {
        (window as unknown as { __cropJumpConfirm__: () => void }).__cropJumpConfirm__();
        const step = (): void => {
          after.push(read());
          if (after.length >= frames) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      return { before, after };
    },
    FRAMES,
  );
}

function maxDelta(
  samples: Sample[],
  key: "scrollTop" | "widgetTop" | "scrollHeight",
): number {
  if (samples.length < 2) return 0;
  const first = samples[0][key];
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s[key] - first));
  return max;
}

function report(label: string, samples: Sample[]): string {
  return `${label} ${JSON.stringify(samples)}`;
}

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  // 图片上方留足文本：确认时滚动位置非零——1px 回弹路径只在滚动非零时才有
  // 可观测位移（scrollTop=0 时 +1 会被夹回 0）。行数受控，避免文档长到
  // CM6 只渲染视口附近、图片落在 cm-gap 里（widget 根本不挂）。
  const lead = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行文本`).join(
    "\n\n",
  );
  const doc = [
    lead,
    ``,
    `![甲](${IMG}){width=300}`,
    ``,
    `![乙](${IMG}){width=300}`,
  ].join("\n");
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/crop-jump/measure.md", body, "measure.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, doc);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () => {
      const imgs = [
        ...document.querySelectorAll(".cm-image-widget img"),
      ] as HTMLImageElement[];
      return (
        imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0)
      );
    },
    { timeout: 20000 },
  );
}

async function enterCropAndDrag(page: Page): Promise<void> {
  const widget = page.locator(".cm-image-widget").first();
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  const cropButton = page.getByTestId("img-toolbar-crop");
  await cropButton.waitFor({ state: "visible", timeout: 10000 });
  await cropButton.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  // nw 在框左上角，往框内拖 30×20（nw 向右下 = 裁掉左上）：框仍在图内，
  // 不会触发「点框外 = 确认」而提前收尾。
  const handle = page.locator('.cm-image-crop-frame [data-handle="nw"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 + 20,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
}

/** 在页面里挂一个「下一帧执行确认」的钩子，让采样与确认严格首尾相接。 */
async function armConfirmHook(page: Page): Promise<void> {
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(
      ".cm-image-crop-frame",
    );
    if (!frame) throw new Error("裁剪框不在，无法挂确认钩子");
    let fired = false;
    (window as unknown as { __cropJumpConfirm__: () => void }).__cropJumpConfirm__ =
      () => {
        if (fired) return;
        fired = true;
        // 真实用户路径：双击裁剪框 = 确认。用真实事件派发，走既有 confirm()。
        frame.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
        );
      };
  });
}

test("首次裁剪确认瞬间零位移：确认前后滚动位置与图片位置探针 ≤1px", async ({
  page,
}) => {
  installSampler(page);
  await openDoc(page);
  await enterCropAndDrag(page);
  await armConfirmHook(page);

  const { before, after } = await sampleAroundConfirm(page);

  // 确认确实发生了：框已消失、属性块已写回。
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  const text = await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
  expect(text).toContain("crop=");

  console.log(report("CROP-JUMP before", before));
  console.log(report("CROP-JUMP after", after));

  const beforeScroll = maxDelta(before, "scrollTop");
  const afterScroll = maxDelta(after, "scrollTop");
  const beforeWidget = maxDelta(before, "widgetTop");
  const afterWidget = maxDelta(after, "widgetTop");
  const beforeHeight = maxDelta(before, "scrollHeight");
  const afterHeight = maxDelta(after, "scrollHeight");
  const afterFresh = maxDelta(after, "freshTop");
  const reconnected = after.some((s) => !s.widgetConnected);
  console.log(
    `CROP-JUMP max|Δ| scrollTop before=${beforeScroll} after=${afterScroll} widgetTop before=${beforeWidget} after=${afterWidget} freshTop after=${afterFresh} scrollHeight before=${beforeHeight} after=${afterHeight} widgetRebuilt=${reconnected}`,
  );
  console.log(
    `CROP-JUMP scrollTop[0]=${before[0].scrollTop} widgetTop[0]=${before[0].widgetTop} freshTop[0]=${after[0].freshTop}`,
  );
  expect(before.length).toBeGreaterThanOrEqual(20);
  expect(after.length).toBeGreaterThanOrEqual(20);
  expect(beforeScroll).toBeLessThanOrEqual(1);
  expect(afterScroll).toBeLessThanOrEqual(1);
  expect(beforeWidget).toBeLessThanOrEqual(1);
  expect(afterWidget).toBeLessThanOrEqual(1);
  expect(afterFresh).toBeLessThanOrEqual(1);
});

/**
 * 贴底场景：文档只有一张图且其下方无内容，scrollIntoView 后 scrollTop === max
 * （已滚到底）。裁剪让图片变矮 → 文档变短 → max scrollTop 减小，浏览器必须把
 * scrollTop 夹到新 max——这是「文档变短」的物理必然，不是缺陷。
 *
 * 因此本场景不要求位移 ≤1px，而要求缺陷特征不存在：
 *   ① 位移只发生一次（确认后帧内不再变化）
 *   ② 变化后所有帧位置恒定（无多次抖动 / 无跳顶）
 */
test("贴底裁剪确认：位移仅一次且其后恒定（允许必要 clamp）", async ({
  page,
}) => {
  installSampler(page);
  await openBottomDoc(page);
  await enterCropAndDrag(page);
  await armConfirmHook(page);

  const { before, after } = await sampleAroundConfirm(page);

  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  const text = await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
  expect(text).toContain("crop=");

  console.log(report("CROP-JUMP-BOTTOM before", before));
  console.log(report("CROP-JUMP-BOTTOM after", after));

  // ① 确认后帧内零抖动：after 段自身的位移必须 ≤1px。
  const afterFresh = maxDelta(after, "freshTop");
  const afterScroll = maxDelta(after, "scrollTop");
  console.log(
    `CROP-JUMP-BOTTOM after-internal max|Δ| freshTop=${afterFresh} scrollTop=${afterScroll}; scrollTop ${before[0].scrollTop}->${after[after.length - 1].scrollTop}; scrollHeight ${before[0].scrollHeight}->${after[after.length - 1].scrollHeight}`,
  );
  expect(after.length).toBeGreaterThanOrEqual(20);
  expect(afterFresh).toBeLessThanOrEqual(1);
  expect(afterScroll).toBeLessThanOrEqual(1);

  // ② 位移方向只能是「文档变短后的贴底夹取」：scrollTop 不增加（不跳顶/不反跳）。
  const lastBeforeScroll = before[before.length - 1].scrollTop;
  const lastAfterScroll = after[after.length - 1].scrollTop;
  expect(lastAfterScroll).toBeLessThanOrEqual(lastBeforeScroll);
});

/**
 * #1603 首裁跳动：**进入**裁剪态（首次 mount）瞬间的位移探针。
 *
 * 与上面两条（确认瞬间）不同，这里采样的是「点裁剪按钮 → 裁剪窗口挂上」
 * 前后：首次进入时 cropDisplayCache 未命中，widget 由普通 img 换成裁剪窗口，
 * 首帧按原图自然尺寸渲染 → 内容高度瞬时塌陷 → 滚动锚定把 scrollTop 往回补
 * （真机表现为「往上跳一些，不到顶」）。第二次进入命中缓存 → 不塌 → 不跳。
 *
 * 判定：进入前后 scrollTop / widget top / scrollHeight 的最大位移 ≤1px。
 */
test("首次进入裁剪态零位移：进入前后滚动位置与图片位置探针 ≤1px", async ({
  page,
}) => {
  installSampler(page);
  await openDoc(page);

  const widget = page.locator(".cm-image-widget").first();
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  const cropButton = page.getByTestId("img-toolbar-crop");
  await cropButton.waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="img-toolbar-crop"]',
    );
    if (!btn) throw new Error("裁剪按钮不在，无法挂进入钩子");
    (window as unknown as { __cropJumpEnter__: () => void }).__cropJumpEnter__ =
      () => btn.click();
  });

  const samples = await page.evaluate(async (frames) => {
    const scroller = document.querySelector<HTMLElement>(".cm-scroller");
    const host = document.querySelector<HTMLElement>(".cm-image-widget");
    if (!scroller || !host) throw new Error("采样前缺 scroller 或 widget");
    const from = host.dataset.imageFrom ?? "";
    const read = (): Sample => {
      const fresh = scroller.querySelector<HTMLElement>(
        `.cm-image-widget[data-image-from="${from}"]`,
      );
      const img = fresh?.querySelector("img") ?? null;
      const win = fresh
        ? (fresh.querySelector(".image-crop-window") as HTMLElement | null)
        : null;
      return {
        t: Math.round(performance.now()),
        scrollTop: scroller.scrollTop,
        widgetTop: host.getBoundingClientRect().top,
        freshTop: fresh ? fresh.getBoundingClientRect().top : 0,
        widgetConnected: host.isConnected,
        scrollHeight: scroller.scrollHeight,
        winH: win ? win.getBoundingClientRect().height : 0,
        imgH: img ? img.getBoundingClientRect().height : 0,
      };
    };
    const before: Sample[] = [];
    await new Promise<void>((resolve) => {
      const step = (): void => {
        before.push(read());
        if (before.length >= frames) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const after: Sample[] = [];
    await new Promise<void>((resolve) => {
      (
        window as unknown as { __cropJumpEnter__: () => void }
      ).__cropJumpEnter__();
      const step = (): void => {
        after.push(read());
        if (after.length >= frames) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return { before, after };
  }, FRAMES);

  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  const { before, after } = samples;
  console.log(report("CROP-ENTER before", before));
  console.log(report("CROP-ENTER after", after));

  const beforeScroll = maxDelta(before, "scrollTop");
  const afterScroll = maxDelta(after, "scrollTop");
  const beforeWidget = maxDelta(before, "widgetTop");
  const afterWidget = maxDelta(after, "widgetTop");
  const beforeHeight = maxDelta(before, "scrollHeight");
  const afterHeight = maxDelta(after, "scrollHeight");
  const afterFresh = maxDelta(after, "freshTop");
  console.log(
    `CROP-ENTER max|Δ| scrollTop before=${beforeScroll} after=${afterScroll} widgetTop before=${beforeWidget} after=${afterWidget} freshTop after=${afterFresh} scrollHeight before=${beforeHeight} after=${afterHeight}`,
  );
  console.log(
    `CROP-ENTER scrollTop[0]=${before[0].scrollTop} widgetTop[0]=${before[0].widgetTop} freshTop[0]=${after[0].freshTop} winH[0]=${after[0].winH} imgH[0]=${after[0].imgH}`,
  );
  expect(before.length).toBeGreaterThanOrEqual(20);
  expect(after.length).toBeGreaterThanOrEqual(20);
  expect(beforeScroll).toBeLessThanOrEqual(1);
  expect(afterScroll).toBeLessThanOrEqual(1);
  expect(beforeWidget).toBeLessThanOrEqual(1);
  expect(afterWidget).toBeLessThanOrEqual(1);
  expect(afterFresh).toBeLessThanOrEqual(1);
  expect(afterHeight).toBeLessThanOrEqual(1);
});

/**
 * #1603 修复 A 的缓存命中验证：无 width 锚点的图片进入裁剪态时，首帧裁剪
 * 窗口高度必须已是最终显示高度（走 cropDisplayCache 同步分支），而不是先
 * 渲染成原图自然高度再塌陷重算——后者正是真机首裁跳动的来源。
 *
 * 用「进入裁剪态后第一帧」的窗口高度与稳定后高度比较：相等 = 命中缓存。
 */
test("无 width 锚点图片进入裁剪态：首帧窗口高度即最终值（缓存命中）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const lead = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行文本`).join(
    "\n\n",
  );
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/crop-jump/nocache.md", body, "nocache.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `${lead}\n\n![甲](${IMG})\n`);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () => {
      const img = document.querySelector(
        ".cm-image-widget img",
      ) as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    },
    { timeout: 20000 },
  );

  const widget = page.locator(".cm-image-widget").first();
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  const cropButton = page.getByTestId("img-toolbar-crop");
  await cropButton.waitFor({ state: "visible", timeout: 10000 });

  // 进入前：无裁剪窗口、无缓存写入（该 src 从未裁过）。
  const before = await page.evaluate(() => {
    const w = document.querySelector<HTMLElement>(".cm-image-widget");
    return {
      win: !!w?.querySelector(".image-crop-window"),
      imgH: w?.querySelector("img")?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(before.win).toBe(false);

  await cropButton.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  // 逐帧读窗口高度：第一帧起就应等于稳定值（无「先自然高度后塌陷」的过渡）。
  const heights = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>(".cm-image-widget");
    if (!host) throw new Error("缺 widget");
    const out: number[] = [];
    await new Promise<void>((resolve) => {
      const step = (): void => {
        const win = host.querySelector<HTMLElement>(".image-crop-window");
        out.push(win ? Math.round(win.getBoundingClientRect().height) : 0);
        if (out.length >= 12) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return out;
  });
  console.log(`CROP-ENTER-NOCACHE window heights per frame: ${JSON.stringify(heights)}`);

  const stable = heights[heights.length - 1];
  expect(stable).toBeGreaterThan(0);
  // 首帧即最终值：全程无塌陷过渡。
  for (const h of heights) {
    expect(Math.abs(h - stable)).toBeLessThanOrEqual(1);
  }
  // 缓存已写入该 src|crop。
  const cached = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    );
    return img?.style.transform ?? "";
  });
  expect(cached).toMatch(/^scale\(/);
});

/** 贴底版文档：12 行文本 + 单张图，无下方内容 → scrollIntoView 后即到底。 */
async function openBottomDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const lead = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行文本`).join(
    "\n\n",
  );
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/crop-jump/bottom.md", body, "bottom.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `${lead}\n\n![甲](${IMG}){width=300}\n`);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () => {
      const img = document.querySelector(
        ".cm-image-widget img",
      ) as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    },
    { timeout: 20000 },
  );
}

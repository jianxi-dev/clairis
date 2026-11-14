import { test, expect, type Page } from "@playwright/test";
import http from "node:http";
import { makePngDataUrl } from "./helpers/png";

/**
 * 含图片文档可滚动回顶部（#808 / change editor-surface-batch18 3.1）。
 *
 * 复现文档的裁剪图带 `{width=884 height=520 crop=1655,973,5405,3181}`：裁剪矩形
 * 宽 5405 大于容器宽，旧渲染把 5405×3181 直接写成显示盒，宽度被 max-width 夹到
 * 容器宽而高度不变，得到远超容器的空白布局盒。这里用真实尺寸（3012×1772）的
 * 图片与同一裁剪矩形复现，断言显示盒受容器约束、高度按比例，且滚动可达顶部。
 */

const DOC_PATH = "/tmp/biaoyue-808/doc.md";
const CROP_W = 5405;
const CROP_H = 3181;
const CROP_RATIO = CROP_H / CROP_W;
const REAL_IMAGE = makePngDataUrl(3012, 1772, [90, 140, 200]);

const PARAGRAPHS = Array.from(
  { length: 48 },
  (_, i) =>
    `第 ${i + 1} 段：用于产生可滚动高度的正文内容，验证含图片文档的滚动可达性。`,
).join("\n\n");

const DOC = [
  "# 滚动回顶复现文档",
  "",
  "先把这份稿子拆成一张分层全景图，再给结构化整理。",
  "",
  `![概况梯度](assets/crop.jpg){width=884 height=520 crop=1655,973,${CROP_W},${CROP_H}}`,
  "",
  PARAGRAPHS,
  "",
  "![异步图片](assets/slow.jpg)",
  "",
].join("\n");

interface MediaMap {
  [absolutePath: string]: string;
}

async function openPreview(
  page: Page,
  doc: string,
  media: MediaMap,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((map) => {
    const win = window as unknown as {
      __TAURI_INTERNALS__: { convertFileSrc: (p: string) => string };
    };
    win.__TAURI_INTERNALS__.convertFileSrc = (p) =>
      map[p] ?? "asset://localhost/" + encodeURIComponent(p);
  }, media);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ([p, c]) => {
      const win = window as unknown as {
        __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      };
      win.__biaoyue_openFile__(p, c, p.split("/").pop() ?? p);
    },
    [DOC_PATH, doc],
  );
  await page.evaluate(() => {
    const win = window as unknown as {
      __biaoyue_store__: {
        getState: () => { setEditorMode: (m: string) => void };
      };
    };
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.waitForFunction(
    () => {
      const img = document.querySelector(".preview-content img");
      return !!img && img.complete && img.naturalWidth > 0;
    },
    { timeout: 8000 },
  );
}

async function scrollMetrics(page: Page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll(".content-scroll")];
    const el =
      all.find((e) =>
        e
          .querySelector(".preview-content")
          ?.textContent?.includes("先把这份稿子拆成一张分层全景图"),
      ) ?? all[0];
    const pc = el.querySelector(".preview-content");
    const imgs = pc
      ? [...pc.querySelectorAll("img")].map((img) => {
          const r = img.getBoundingClientRect();
          return {
            src: (img.getAttribute("src") ?? "").slice(-12),
            style: img.getAttribute("style") ?? "",
            box: [Math.round(r.width), Math.round(r.height)] as [
              number,
              number,
            ],
            natural: [img.naturalWidth, img.naturalHeight] as [number, number],
            complete: img.complete,
          };
        })
      : [];
    const first = pc ? pc.firstElementChild : null;
    const fr = first ? first.getBoundingClientRect() : null;
    const cr = el.getBoundingClientRect();
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      previewWidth: pc ? Math.round(pc.getBoundingClientRect().width) : 0,
      imgs,
      first: fr
        ? {
            tag: first?.tagName ?? "",
            top: Math.round(fr.top - cr.top),
            bottom: Math.round(fr.bottom - cr.top),
          }
        : null,
    };
  });
}

function cropImage(metrics: Awaited<ReturnType<typeof scrollMetrics>>) {
  return metrics.imgs.find((img) => img.style.includes("object-fit:none"))!;
}

function slowImage(metrics: Awaited<ReturnType<typeof scrollMetrics>>) {
  return metrics.imgs.find((img) => img.src.includes("slow.png"))!;
}

test("含裁剪图的文档滚到底部后滚轮向上可回到 scrollTop 0 且首块可见", async ({
  page,
}) => {
  await openPreview(page, DOC, {
    ["/tmp/biaoyue-808/assets/crop.jpg"]: REAL_IMAGE,
    ["/tmp/biaoyue-808/assets/slow.jpg"]: REAL_IMAGE,
  });

  const before = await scrollMetrics(page);
  expect(before.scrollTop).toBe(0);
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  // 滚到底部
  await page.evaluate(() => {
    const el = document.querySelector(".content-scroll") as HTMLElement;
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  const bottom = await scrollMetrics(page);
  expect(bottom.scrollTop).toBe(bottom.scrollHeight - bottom.clientHeight);

  // 滚轮向上直到顶部
  let minTop = Infinity;
  for (let i = 0; i < 80; i++) {
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(40);
    const m = await scrollMetrics(page);
    minTop = Math.min(minTop, m.scrollTop);
    if (m.scrollTop === 0) break;
  }
  const top = await scrollMetrics(page);
  expect(top.scrollTop).toBe(0);
  expect(minTop).toBe(0);
  expect(top.first).not.toBeNull();
  expect(top.first!.top).toBeLessThanOrEqual(40);
  expect(top.first!.bottom).toBeGreaterThan(0);
});

test("滚动条路径：scrollTop 赋回 0 后首块回到视口", async ({ page }) => {
  await openPreview(page, DOC, {
    ["/tmp/biaoyue-808/assets/crop.jpg"]: REAL_IMAGE,
    ["/tmp/biaoyue-808/assets/slow.jpg"]: REAL_IMAGE,
  });

  await page.evaluate(() => {
    const el = document.querySelector(".content-scroll") as HTMLElement;
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const el = document.querySelector(".content-scroll") as HTMLElement;
    el.scrollTop = 0;
  });
  await page.waitForTimeout(150);
  const m = await scrollMetrics(page);
  expect(m.scrollTop).toBe(0);
  expect(m.first).not.toBeNull();
  expect(m.first!.top).toBeLessThanOrEqual(40);
});

test("异步加载的图片完成后内容增高，仍可回到 scrollTop 0", async ({ page }) => {
  // 延迟 1.5s 返回真实尺寸图片，模拟打开后图片才到。
  const server = http.createServer((req, res) => {
    const send = () => {
      const body = Buffer.from(REAL_IMAGE.split(",")[1], "base64");
      res.writeHead(200, { "content-type": "image/png" });
      res.end(body);
    };
    if (req.url === "/slow.png") setTimeout(send, 1500);
    else send();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const slowUrl = `http://127.0.0.1:${port}/slow.png`;

  try {
    await openPreview(page, DOC, {
      ["/tmp/biaoyue-808/assets/crop.jpg"]: REAL_IMAGE,
      ["/tmp/biaoyue-808/assets/slow.jpg"]: slowUrl,
    });

    // 图片未到位时先滚到底部（此时内容较矮）
    await page.evaluate(() => {
      const el = document.querySelector(".content-scroll") as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);
    const early = await scrollMetrics(page);
    expect(slowImage(early).complete).toBe(false);

    // 等异步图片加载完成，内容高度增大
    await expect
      .poll(async () => (await scrollMetrics(page)).scrollHeight, {
        timeout: 8000,
      })
      .toBeGreaterThan(early.scrollHeight);
    const loaded = await scrollMetrics(page);
    const loadedSlow = slowImage(loaded);
    expect(loadedSlow.complete).toBe(true);
    expect(loadedSlow.natural[0]).toBe(3012);

    // 高度增大后仍能回到顶部
    let minTop = Infinity;
    for (let i = 0; i < 80; i++) {
      await page.mouse.move(600, 400);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(40);
      const m = await scrollMetrics(page);
      minTop = Math.min(minTop, m.scrollTop);
      if (m.scrollTop === 0) break;
    }
    const top = await scrollMetrics(page);
    expect(top.scrollTop).toBe(0);
    expect(minTop).toBe(0);
    expect(top.first).not.toBeNull();
    expect(top.first!.top).toBeLessThanOrEqual(40);
  } finally {
    server.close();
  }
});

test("裁剪图显示盒受容器宽约束且高度按裁剪矩形比例", async ({ page }) => {
  await openPreview(page, DOC, {
    ["/tmp/biaoyue-808/assets/crop.jpg"]: REAL_IMAGE,
    ["/tmp/biaoyue-808/assets/slow.jpg"]: REAL_IMAGE,
  });

  const m = await scrollMetrics(page);
  const crop = cropImage(m);
  expect(crop).toBeDefined();
  expect(crop.natural[0]).toBe(3012);
  expect(crop.natural[1]).toBe(1772);

  const containerWidth = m.previewWidth - 64; // .preview-content padding 2rem 两侧
  expect(crop.box[0]).toBeLessThanOrEqual(containerWidth);
  expect(crop.box[1]).toBeGreaterThan(0);
  // 高度必须与裁剪矩形同比例（旧写法高度恒为 3181，比例约 2.8）
  expect(crop.box[1]).toBeCloseTo(crop.box[0] * CROP_RATIO, 0);
});

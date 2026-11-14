import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough, SUMMON_PROBE_RATIO } from "./helpers/ui-probe";
import { ANCHOR_TOLERANCE_PX, EDITOR_ANCHORS } from "./fixtures/editor-anchors";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/841");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");
const MP4_DATA = `data:video/mp4;base64,${TINY_MP4}`;

// 400x1600 实色 PNG（fixtures/tall.png）：让图片行高于一屏，手柄落位差异可观测。
const PNG_DATA_URL = `data:image/png;base64,${readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tall.png"),
).toString("base64")}`;

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(
    ({ mp4, png }) => {
      const win = window as unknown as Record<string, any>;
      win.__TAURI_INTERNALS__.convertFileSrc = () => png;
      const mediaProto = HTMLMediaElement.prototype as unknown as Record<
        string,
        unknown
      >;
      const mediaSet = mediaProto.setAttribute;
      mediaProto.setAttribute = function (name: string, value: string) {
        if (
          name === "src" &&
          typeof value === "string" &&
          value.startsWith("media://")
        ) {
          value = mp4;
        }
        return mediaSet.call(this, name, value);
      };
    },
    { mp4: MP4_DATA, png: PNG_DATA_URL },
  );
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/media-handle-841.md",
      "## 标题文字\n\n![图片](photo.png){width=120}\n\n![视频](clip.mp4)\n\n普通段落",
      "media-handle-841.md",
    );
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
}

/**
 * 滚动到目标块，在 `.cm-content` 左缘召唤区按 `yOffset` 分步移动指针
 * （D5 / ui-probe 的 `moveThrough`）。媒体行很高，取接近行顶的 Y 才不会
 * 落进 widget 的下半部（`posAtCoords` 对 widget 只回 from/to）。
 */
async function summon(
  page: Page,
  line: Locator,
  atCenter = false,
): Promise<void> {
  await line.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  const yOffset = atCenter
    ? box.height / 2
    : Math.min(box.height / 2, EDITOR_ANCHORS.handle.height);
  await moveThrough(
    page,
    [
      {
        x: Math.max(box.x, content.left + content.width * SUMMON_PROBE_RATIO),
        y: box.y + yOffset,
      },
    ],
    { steps: 4 },
  );
  await page.waitForTimeout(450);
}

interface HandleGeometry {
  from: string | null;
  icons: string[];
  dots: number;
  height: number;
  opacity: string;
  centerX: number;
  centerY: number;
  lineTop: number;
}

/** 当前可见手柄的几何 + 拖拽点数 + 对应块首行顶（相对视口）。 */
async function readHandle(page: Page, line: Locator): Promise<HandleGeometry> {
  return page.evaluate(
    (lineTop) => {
      const handle = Array.from(
        document.querySelectorAll<HTMLElement>(".cm-block-handle"),
      ).find((el) => el.classList.contains("cm-block-handle-visible"));
      if (!handle) throw new Error("没有可见手柄");
      const rect = handle.getBoundingClientRect();
      const grip = handle.querySelector('svg[data-icon="DragHandleOutlined"]');
      return {
        from: handle.getAttribute("data-block-from"),
        icons: Array.from(handle.querySelectorAll("svg[data-icon]")).map(
          (svg) => svg.getAttribute("data-icon"),
        ),
        dots: grip ? grip.querySelectorAll("path").length : 0,
        height: rect.height,
        opacity: getComputedStyle(handle).opacity,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        lineTop,
      };
    },
    (await line.boundingBox())!.y,
  );
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

test("图片 / 视频手柄六点拖拽且与标题手柄同一中心线（A-8.1 / A-8.2）", async ({
  page,
}) => {
  await openDoc(page);

  const headingLine = page
    .locator(".cm-line")
    .filter({ hasText: "标题文字" })
    .first();
  const imageLine = page
    .locator(".cm-line")
    .filter({ has: page.locator(".cm-image-widget") })
    .first();
  const videoLine = page
    .locator(".cm-line")
    .filter({ has: page.locator(".cm-media-widget") })
    .first();

  // 参考：标题手柄（其余块保持四点拖拽，不被本票改动）。
  await summon(page, headingLine, true);
  const heading = await readHandle(page, headingLine);
  expect(heading.icons).toEqual(["H2Outlined", "DragOutlined"]);
  await shot(page, "heading-handle-reference", "heading-handle-reference");

  // A-8.1：图片手柄六点。
  await summon(page, imageLine);
  const image = await readHandle(page, imageLine);
  expect(image.icons).toEqual(["ImageOutlined", "DragHandleOutlined"]);
  expect(image.dots).toBe(6);
  await shot(page, "image-handle-six-dots", "image-handle-six-dots");

  // A-8.1：视频手柄六点。
  await summon(page, videoLine);
  const video = await readHandle(page, videoLine);
  expect(video.icons).toEqual(["VideoOutlined", "DragHandleOutlined"]);
  expect(video.dots).toBe(6);
  await shot(page, "video-handle-six-dots", "video-handle-six-dots");

  // 可见性按计算样式断言（QG-4：禁止只断言元素存在）。
  for (const g of [heading, image, video]) {
    expect(Number(g.opacity)).toBeGreaterThan(0.99);
    expect(g.height).toBe(EDITOR_ANCHORS.handle.height);
  }

  // A-8.2：图片 / 视频手柄与标题手柄同一中心线。横向中心线差 ≤2px；
  // 纵向都锚在各自块首行顶 + 半个药丸高（与标题手柄同一纵向口径，非按行居中）。
  const halfPill = EDITOR_ANCHORS.handle.height / 2;
  for (const g of [heading, image, video]) {
    expect(Math.abs(g.centerY - g.lineTop - halfPill)).toBeLessThanOrEqual(
      ANCHOR_TOLERANCE_PX,
    );
  }
  expect(Math.abs(image.centerX - heading.centerX)).toBeLessThanOrEqual(
    ANCHOR_TOLERANCE_PX,
  );
  expect(Math.abs(video.centerX - heading.centerX)).toBeLessThanOrEqual(
    ANCHOR_TOLERANCE_PX,
  );

  // 证据态 4：图片手柄 + 标题手柄中心线参考线（可见对齐）。
  await summon(page, imageLine);
  await page.evaluate((centerX) => {
    const guide = document.createElement("div");
    guide.style.cssText =
      `position:fixed;left:${centerX}px;top:0;bottom:0;width:1px;` +
      "background:#e11d48;z-index:99999;pointer-events:none";
    guide.id = "center-guide";
    document.body.appendChild(guide);
    const probe = document.createElement("div");
    probe.id = "center-probe";
    probe.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:99999;background:#111;color:#0f0;" +
      "font:12px monospace;padding:8px;border-radius:6px;white-space:pre";
    probe.textContent = `heading centerX ${centerX.toFixed(1)}`;
    document.body.appendChild(probe);
  }, heading.centerX);
  await page.waitForTimeout(200);
  await shot(
    page,
    "media-heading-center-aligned",
    "media-heading-center-aligned",
  );
  await page.evaluate(() => {
    document.getElementById("center-guide")?.remove();
    document.getElementById("center-probe")?.remove();
  });
});

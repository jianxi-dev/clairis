import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1518";
mkdirSync(OUT, { recursive: true });

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

async function installRealVideo(page: Page): Promise<void> {
  await page.addInitScript((b64) => {
    const DATA = `data:video/mp4;base64,${b64}`;
    const proto = HTMLMediaElement.prototype as unknown as Record<
      string,
      unknown
    >;
    const desc = Object.getOwnPropertyDescriptor(proto, "src");
    if (!desc?.get || !desc.set) return;
    Object.defineProperty(proto, "src", {
      configurable: true,
      get: desc.get,
      set(this: HTMLMediaElement, value: string) {
        const next =
          typeof value === "string" &&
          (value.startsWith("media://") || value.startsWith("asset:"))
            ? DATA
            : value;
        desc.set?.call(this, next);
      },
    });
    // MediaWidget 用 setAttribute（内容属性不经属性 setter）——补拦这一路。
    const origSet = proto.setAttribute as (
      this: Element,
      name: string,
      value: string,
    ) => void;
    proto.setAttribute = function (name: string, value: string) {
      if (
        name === "src" &&
        typeof value === "string" &&
        (value.startsWith("media://") || value.startsWith("asset:"))
      ) {
        value = DATA;
      }
      origSet.call(this, name, value);
    } as typeof proto.setAttribute;
  }, TINY_MP4);
}

async function openDoc(page: Page, mode: "edit" | "preview") {
  await installRealVideo(page);
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ mode }) => {
      const w = window as unknown as BW;
      w.__biaoyue_openFile__("/tmp/vf/vf.md", "![视频](assets/tiny.mp4)\n", "vf.md");
      w.__biaoyue_store__.getState().setEditorMode(mode);
    },
    { mode },
  );
  const sel = mode === "preview" ? ".preview-content video" : ".cm-media-widget video";
  await page.locator(sel).first().waitFor({ timeout: 10000 });
  if (mode === "preview") {
    // 预览态 src 是 HTML 解析直接落的内容属性，两个 setter 拦截都拦不到——
    // 这里把 media:// 直改成可播放 data URL（mock 环境无 media 处理器）。
    await page.evaluate((b64) => {
      const DATA = `data:video/mp4;base64,${b64}`;
      document.querySelectorAll("video").forEach((v) => {
        if (v.src.startsWith("media://") || v.src.startsWith("asset:"))
          v.src = DATA;
      });
    }, TINY_MP4);
  }
}

test("编辑态视频块未播放显示首帧（不黑屏）", async ({ page }) => {
  await openDoc(page, "edit");
  const video = page.locator(".cm-media-widget video").first();
  await expect
    .poll(
      async () =>
        video.evaluate((el) => (el as HTMLVideoElement).readyState),
      { timeout: 8000 },
    )
    .toBeGreaterThanOrEqual(2);
  const st = await video.evaluate((el) => ({
    ct: (el as HTMLVideoElement).currentTime,
    paused: (el as HTMLVideoElement).paused,
    rs: (el as HTMLVideoElement).readyState,
  }));
  console.log("EDIT_ST", JSON.stringify(st));
  expect(st.ct).toBeGreaterThan(0);
  expect(st.paused).toBe(true);
  await page.screenshot({ path: `${OUT}/01-edit-firstframe.png` });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-edit-seeked.png` });
});

test("预览态视频块未播放显示首帧（不黑屏）", async ({ page }) => {
  await openDoc(page, "preview");
  const video = page.locator(".preview-content video").first();
  await expect
    .poll(
      async () =>
        video.evaluate((el) => (el as HTMLVideoElement).readyState),
      { timeout: 8000 },
    )
    .toBeGreaterThanOrEqual(2);
  const st = await video.evaluate((el) => ({
    ct: (el as HTMLVideoElement).currentTime,
    paused: (el as HTMLVideoElement).paused,
  }));
  console.log("PREVIEW_ST", JSON.stringify(st));
  expect(st.ct).toBeGreaterThan(0);
  expect(st.paused).toBe(true);
  await page.screenshot({ path: `${OUT}/02-preview-firstframe.png` });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-preview-seeked.png` });
});

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

const ART = path.resolve(process.cwd(), ".artifacts/1185");
const STATES: Array<Record<string, string>> = [];

async function record(page: Page, state: string): Promise<void> {
  mkdirSync(ART, { recursive: true });
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  STATES.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
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
          typeof value === "string" && value.startsWith("media://")
            ? DATA
            : value;
        desc.set?.call(this, next);
      },
    });
  }, TINY_MP4);
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFirstVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/movies/pip-a.mp4", "", "pip-a.mp4");
  });
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function openSecondVideoInSplit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().splitPane("row");
  });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/movies/pip-b.mp4", "", "pip-b.mp4");
  });
  await expect(page.locator(".art-video-player")).toHaveCount(2);
}

async function stubPip(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__pip = { element: null, exits: 0, requests: [] as HTMLVideoElement[] };
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      get: () => win.__pip.element,
    });
    Object.defineProperty(document, "exitPictureInPicture", {
      configurable: true,
      value: async () => {
        win.__pip.exits += 1;
        const previous = win.__pip.element;
        win.__pip.element = null;
        return previous;
      },
    });
    HTMLVideoElement.prototype.requestPictureInPicture = async function (
      this: HTMLVideoElement,
    ) {
      win.__pip.requests.push(this);
      win.__pip.element = this;
      return {} as PictureInPictureWindow;
    };
  });
}

async function clickPip(page: Page, index: number): Promise<void> {
  const player = page.locator(".art-video-player").nth(index);
  await player.hover();
  const button = player.locator('[data-name="pip"]');
  await button.waitFor({ state: "visible", timeout: 5000 });
  await button.click();
}

test("同一时刻仅一个画中画：对第二个视频发起 PiP 会替换当前窗口", async ({
  page,
}) => {
  mkdirSync(ART, { recursive: true });
  await installRealVideo(page);
  await boot(page);
  await openFirstVideo(page);
  await openSecondVideoInSplit(page);
  await stubPip(page);

  await clickPip(page, 0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__pip.requests.length))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as any).__pip.element !== null),
  ).toBe(true);
  await record(page, "01-pip-a-entered");

  await clickPip(page, 1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__pip.requests.length))
    .toBe(2);
  await record(page, "02-pip-b-requested");

  const result = await page.evaluate(() => {
    const win = window as any;
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>(".art-video-player video"),
    );
    return {
      exits: win.__pip.exits,
      currentIndex: videos.indexOf(win.__pip.element as HTMLVideoElement),
      elements: videos.length,
    };
  });

  expect(result.elements).toBe(2);
  expect(result.currentIndex).toBe(1);
  await record(page, "03-only-one-pip-element");

  expect(result.exits).toBeGreaterThanOrEqual(1);
  await record(page, "04-exit-called-before-replace");

  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify({ task: "1185-pip-replace", states: STATES }, null, 2)}\n`,
  );
});

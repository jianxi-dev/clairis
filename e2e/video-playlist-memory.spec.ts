import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test("重启后恢复到上次播放项", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__biaoyue_media__ = [
      {
        path: "/tmp/movies/ep1.mp4",
        name: "ep1.mp4",
        kind: "video",
        target: "",
      },
      {
        path: "/tmp/movies/ep2.mp4",
        name: "ep2.mp4",
        kind: "video",
        target: "",
      },
    ];
    localStorage.setItem(
      "biaoyue.media.lastIndex",
      JSON.stringify({ dir: "/tmp/movies", path: "/tmp/movies/ep2.mp4" }),
    );
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/movies/ep1.mp4",
      "",
      "ep1.mp4",
    );
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector("video")?.getAttribute("src") ?? "",
        ),
      { timeout: 10000 },
    )
    .toContain("ep2");
  const dir = process.env.EVIDENCE_DIR;
  if (dir) {
    await page.screenshot({ path: `${dir}/playlist-restored.png` });
  }
});

test("无记忆时停留在打开的文件", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__biaoyue_media__ = [
      {
        path: "/tmp/movies/ep1.mp4",
        name: "ep1.mp4",
        kind: "video",
        target: "",
      },
      {
        path: "/tmp/movies/ep2.mp4",
        name: "ep2.mp4",
        kind: "video",
        target: "",
      },
    ];
    localStorage.removeItem("biaoyue.media.lastIndex");
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/movies/ep1.mp4",
      "",
      "ep1.mp4",
    );
  });
  await page.locator(".art-control[data-name='playlist']").click();
  await expect(page.getByTestId("playlist-item-name")).toHaveCount(2, {
    timeout: 10000,
  });
  await page.keyboard.press("Escape");
  const src = await page.evaluate(
    () => document.querySelector("video")?.getAttribute("src") ?? "",
  );
  expect(src).toContain("ep1");
});

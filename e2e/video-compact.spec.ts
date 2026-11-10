import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

async function openMedia(page: Page, file: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__biaoyue_media__ = [
      {
        path: "/tmp/movies/ep1.mp4",
        name: "ep1.mp4",
        kind: "video",
        target: "ep1",
      },
    ];
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, unknown>;
    (win.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      p,
      "",
      p.split("/").pop() ?? p,
    );
  }, file);
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function withRealVideo(page: Page): Promise<void> {
  await page.evaluate(async (b64) => {
    const video = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    video.src = `data:video/mp4;base64,${b64}`;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  }, TINY_MP4);
  await page.waitForTimeout(200);
}

test("窄宽时先降级控件盒与图标，按钮不溢出", async ({ page }) => {
  await openMedia(page, "/tmp/movies/ep1.mp4");
  await withRealVideo(page);
  const evidenceDir = process.env.EVIDENCE_DIR;
  if (evidenceDir) {
    await page.screenshot({ path: `${evidenceDir}/controls-default.png` });
  }

  const visible = () =>
    page.evaluate(() => {
      const players = Array.from(
        document.querySelectorAll(".art-video-player"),
      ) as HTMLElement[];
      const player = players.find((el) => el.getBoundingClientRect().width > 0);
      if (!player) return null;
      const pr = player.getBoundingClientRect();
      const controls = Array.from(
        player.querySelectorAll(".art-control"),
      ) as HTMLElement[];
      const clipped = controls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < pr.left - 1 || r.right > pr.right + 1;
      }).length;
      const icon = player.querySelector(
        ".art-controls-right .art-control .art-icon svg",
      ) as SVGElement | null;
      return {
        className: player.className,
        clipped,
        icon: icon ? Math.round(icon.getBoundingClientRect().width) : -1,
      };
    });

  await page.setViewportSize({ width: 640, height: 720 });
  await page.waitForFunction(
    () => {
      const players = Array.from(
        document.querySelectorAll(".art-video-player"),
      ) as HTMLElement[];
      const player = players.find((el) => el.getBoundingClientRect().width > 0);
      return !!player && player.className.includes("vp-compact");
    },
    undefined,
    { timeout: 5000 },
  );
  const compact = await visible();
  expect(compact?.className).toContain("vp-compact");
  expect(compact?.clipped).toBe(0);
  expect(compact?.icon).toBeLessThanOrEqual(21);
  if (evidenceDir) {
    await page.screenshot({ path: `${evidenceDir}/controls-compact.png` });
  }

  await page.setViewportSize({ width: 420, height: 720 });
  await page.waitForFunction(
    () => {
      const players = Array.from(
        document.querySelectorAll(".art-video-player"),
      ) as HTMLElement[];
      const player = players.find((el) => el.getBoundingClientRect().width > 0);
      return !!player && player.className.includes("vp-ultra");
    },
    undefined,
    { timeout: 5000 },
  );
  const ultra = await visible();
  expect(ultra?.className).toContain("vp-ultra");
  expect(ultra?.clipped).toBe(0);
  expect(ultra?.icon).toBeLessThanOrEqual(17);
  if (evidenceDir) {
    await page.screenshot({ path: `${evidenceDir}/controls-ultra.png` });
  }
});

test("双指左半调亮度、右半调音量", async ({ page }) => {
  await openMedia(page, "/tmp/movies/ep1.mp4");
  await withRealVideo(page);
  const result = await page.evaluate(async () => {
    const player = document.querySelector(".art-video-player") as HTMLElement;
    const video = player.querySelector("video") as HTMLVideoElement;
    const rect = player.getBoundingClientRect();
    const dispatch = (type: string, x: number, y: number): void => {
      const touch = (id: number, tx: number, ty: number) =>
        new Touch({ identifier: id, target: player, clientX: tx, clientY: ty });
      player.dispatchEvent(
        new TouchEvent(type, {
          touches:
            type === "touchend" ? [] : [touch(1, x, y), touch(2, x + 10, y)],
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    const leftX = rect.left + rect.width * 0.25;
    const rightX = rect.left + rect.width * 0.75;
    const midY = rect.top + rect.height / 2;

    dispatch("touchstart", leftX, midY);
    dispatch("touchmove", leftX, midY - 120);
    dispatch("touchend", leftX, midY - 120);

    video.volume = 0.2;
    dispatch("touchstart", rightX, midY);
    dispatch("touchmove", rightX, midY - 120);
    dispatch("touchend", rightX, midY - 120);

    return {
      filter: video.style.filter,
      volume: video.volume,
    };
  });
  expect(result.filter).toContain("brightness(");
  expect(result.volume).toBeGreaterThan(0.2);
  const dir = process.env.EVIDENCE_DIR;
  if (dir) {
    await page.screenshot({ path: `${dir}/gesture-applied.png` });
  }
});

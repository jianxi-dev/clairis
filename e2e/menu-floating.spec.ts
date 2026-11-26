import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.MENU_APP_URL ?? "http://localhost:1424";

// Chromium 解不了 asset://，换成可解码的小图：否则 <img> 高度为 0，右键无落点。
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";

async function bootImage(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((png) => {
    const w = window as unknown as {
      __TAURI_INTERNALS__: { convertFileSrc: () => string };
    };
    w.__TAURI_INTERNALS__.convertFileSrc = () => png;
  }, PNG);
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
      __biaoyue_store__?: { getState: () => { setScene: (s: string) => void } };
    };
    w.__biaoyue_openFile__("/Users/test/photo.png", "", "photo.png");
    w.__biaoyue_store__?.getState().setScene("workspace");
  });
  await page
    .locator('[data-testid="image-preview-img"]')
    .first()
    .waitFor({ timeout: 10000, state: "visible" });
}

async function openContextMenu(page: Page): Promise<void> {
  await page
    .locator('[data-testid="image-preview-img"]')
    .first()
    .click({ button: "right" });
  await expect(page.getByTestId("image-context-menu")).toBeVisible({
    timeout: 1000,
  });
}

async function openSlashMenu(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
    };
    w.__biaoyue_openFile__(
      "/Users/test/menu-geometry.md",
      "",
      "menu-geometry.md",
    );
  });
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const content = page.locator(".cm-content");
  await content.waitFor({ state: "visible", timeout: 10000 });
  await content.click();
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
  await expect(
    page.locator(".mdb-slash-grid-menu .mdb-slash-item").first(),
  ).toBeVisible();
}

async function openFloatingPreview(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => {
          openPreview: (p: {
            path: string;
            title: string;
            x: number;
            y: number;
            w: number;
            h: number;
            flippedX: boolean;
            flippedY: boolean;
            source: "rail" | "grid";
            narrow: boolean;
          }) => void;
        };
      };
    };
    w.__biaoyue_store__.getState().openPreview({
      path: "/tmp/fp/doc1.md",
      title: "文件1",
      x: 400,
      y: 100,
      w: 320,
      h: 300,
      flippedX: false,
      flippedY: false,
      source: "rail",
      narrow: false,
    });
  });
  await expect(page.locator('[data-testid="floating-preview"]')).toBeVisible();
}

test("右键菜单面板/行几何与阴影等于 --shadow-menu 探针", async ({ page }) => {
  await bootImage(page);
  await openContextMenu(page);

  const geo = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(".context-menu");
    const row = menu?.querySelector<HTMLElement>(".context-menu-item");
    const cs = menu ? getComputedStyle(menu) : null;
    const rs = row ? getComputedStyle(row) : null;
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-menu)";
    document.body.appendChild(probe);
    const probeShadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    return {
      panelRadius: cs?.borderRadius ?? null,
      rowRadius: rs?.borderRadius ?? null,
      rowHeight: row ? row.getBoundingClientRect().height : null,
      panelShadow: cs?.boxShadow ?? null,
      probeShadow,
      transition: cs?.transition ?? null,
    };
  });

  expect(geo.panelRadius).toBe("12px");
  expect(geo.rowRadius).toBe("6px");
  expect(geo.rowHeight).toBe(32);
  expect(geo.panelShadow).toBe(geo.probeShadow);
  expect(geo.transition).toBe("none");
});

test("斜杠菜单沿用同一菜单级几何", async ({ page }) => {
  await openSlashMenu(page);

  const geo = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(".mdb-slash-menu");
    const row = menu?.querySelector<HTMLElement>(".mdb-slash-item");
    const cs = menu ? getComputedStyle(menu) : null;
    const rs = row ? getComputedStyle(row) : null;
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-menu)";
    document.body.appendChild(probe);
    const probeShadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    return {
      panelRadius: cs?.borderRadius ?? null,
      rowRadius: rs?.borderRadius ?? null,
      rowHeight: row ? row.getBoundingClientRect().height : null,
      panelShadow: cs?.boxShadow ?? null,
      probeShadow,
    };
  });

  expect(geo.panelRadius).toBe("12px");
  expect(geo.rowRadius).toBe("6px");
  expect(geo.rowHeight).toBe(32);
  expect(geo.panelShadow).toBe(geo.probeShadow);
});

test("hover 与键盘 ↓ 落在同一中性高亮，点外部无残留", async ({ page }) => {
  await bootImage(page);
  await openContextMenu(page);

  const hoverToken = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--menu-hover)";
    document.body.appendChild(probe);
    const probeBg = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      token: getComputedStyle(document.documentElement)
        .getPropertyValue("--menu-hover")
        .trim(),
      probeBg,
    };
  });
  expect(hoverToken.token).toBe("rgba(0, 0, 0, 0.045)");

  const items = page.locator(".context-menu-item");
  await items.nth(2).hover();
  const hoverBg = await items
    .nth(2)
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(hoverBg).toBe(hoverToken.probeBg);

  await page.mouse.move(5, 5);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const keyboardBg = await items
    .nth(2)
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(keyboardBg).toBe(hoverBg);

  await page.mouse.click(5, 5);
  await expect(page.getByTestId("image-context-menu")).toHaveCount(0);
});

test("浮动预览阴影等于 --shadow-panel 探针且面板圆角 12", async ({ page }) => {
  await openFloatingPreview(page);

  const geo = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      '[data-testid="floating-preview"]',
    );
    const cs = panel ? getComputedStyle(panel) : null;
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-panel)";
    document.body.appendChild(probe);
    const probeShadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    return {
      panelRadius: cs?.borderRadius ?? null,
      panelShadow: cs?.boxShadow ?? null,
      probeShadow,
    };
  });

  expect(geo.panelRadius).toBe("12px");
  expect(geo.panelShadow).toBe(geo.probeShadow);
});

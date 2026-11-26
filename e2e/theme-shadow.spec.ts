import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1424";

// Chromium 解不了 asset://，换成可解码的小图：否则 <img> 高度为 0，右键无落点。
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";

type Theme = "light" | "dark" | "warm";

async function boot(page: Page): Promise<void> {
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

async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("warm", t === "warm");
  }, theme);
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

function readShadow(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-menu)";
    document.body.appendChild(probe);
    const probeShadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    const menu = document.querySelector<HTMLElement>(".context-menu");
    return {
      probeShadow,
      menuShadow: menu ? getComputedStyle(menu).boxShadow : null,
    };
  });
}

test("右键菜单阴影等于 --shadow-menu 探针", async ({ page }) => {
  await boot(page);
  await setTheme(page, "light");
  await openContextMenu(page);
  const { probeShadow, menuShadow } = await readShadow(page);
  expect(menuShadow).toBe(probeShadow);
});

test("三主题切换阴影随主题变化并还原", async ({ page }) => {
  await boot(page);
  await setTheme(page, "light");
  await openContextMenu(page);

  const light = await readShadow(page);
  expect(light.menuShadow).toBe(light.probeShadow);

  await setTheme(page, "dark");
  const dark = await readShadow(page);
  expect(dark.menuShadow).toBe(dark.probeShadow);
  expect(dark.menuShadow).not.toBe(light.menuShadow);

  await setTheme(page, "warm");
  const warm = await readShadow(page);
  expect(warm.menuShadow).toBe(warm.probeShadow);
  expect(warm.menuShadow).not.toBe(dark.menuShadow);

  await setTheme(page, "light");
  const restored = await readShadow(page);
  expect(restored.menuShadow).toBe(light.menuShadow);
});

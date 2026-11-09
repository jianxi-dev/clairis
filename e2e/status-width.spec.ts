import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function openPanel(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/width.md", "# width", "width.md");
  });
  await page.waitForTimeout(300);
  await page.getByTestId("status-width").click();
  await expect(page.getByTestId("width-panel")).toBeVisible();
}

function borders(page: Page) {
  return page.locator(".width-bar").evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { style: s.borderTopStyle, color: s.borderTopColor };
    }),
  );
}

test("未 hover 时三挡块为透明虚线边框", async ({ page }) => {
  await openPanel(page);
  const list = await borders(page);
  expect(list).toHaveLength(3);
  for (const b of list) {
    expect(b.style).toBe("dashed");
    expect(b.color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  }
});

test("hover 单柱显示虚线，另外两柱保持透明；移出恢复", async ({ page }) => {
  await openPanel(page);
  const bar = page.getByTestId("width-preset-960");
  await bar.hover();
  await page.waitForTimeout(200);
  const hovered = await borders(page);
  expect(hovered[1].style).toBe("dashed");
  expect(hovered[1].color).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(hovered[0].color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(hovered[2].color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(200);
  const left = await borders(page);
  expect(left[1].color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test("三柱居中相接且滑块长于三柱", async ({ page }) => {
  await openPanel(page);
  const bars = page.getByTestId("width-bars");
  const slider = page.getByTestId("width-slider");
  const barsBox = await bars.boundingBox();
  const sliderBox = await slider.boundingBox();
  expect(barsBox).not.toBeNull();
  expect(sliderBox).not.toBeNull();
  expect(sliderBox!.width).toBeGreaterThan(barsBox!.width);
  const gap = await bars.evaluate((el) => getComputedStyle(el).gap);
  expect(gap === "0px" || gap === "normal").toBe(true);
  const max = await slider.getAttribute("max");
  expect(max).toBe("1400");
});

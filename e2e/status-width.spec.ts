import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/width.md", "# width", "width.md");
  });
  await page.waitForTimeout(300);
}

async function openPanel(page: Page) {
  await boot(page);
  await page.getByTestId("width-control").hover();
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

function fills(page: Page) {
  return page
    .locator(".width-bar-fill")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
}

test("未选中三挡柱体无虚线边框且填充可辨识", async ({ page }) => {
  await openPanel(page);
  const list = await borders(page);
  expect(list).toHaveLength(3);
  for (const b of list) {
    expect(b.style).toBe("none");
  }
  for (const opacity of await fills(page)) {
    expect(Number(opacity)).toBeGreaterThan(0.5);
  }
});

test("选中柱体与未选中柱体透明度区分", async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="width-preset-960"]').click();
  const opacities = (await fills(page)).map(Number);
  expect(opacities).toContain(1);
  for (const opacity of opacities) {
    if (opacity !== 1) expect(opacity).toBeLessThan(1);
  }
});

test("宽度控件移入淡入、移出淡出", async ({ page }) => {
  await boot(page);
  const control = page.getByTestId("width-control");
  const button = page.getByTestId("status-width");

  expect(await button.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

  await control.hover();
  await expect(button).toHaveCSS("opacity", "1", { timeout: 3000 });

  await page.mouse.move(10, 10);
  await expect(button).toHaveCSS("opacity", "0", { timeout: 3000 });
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

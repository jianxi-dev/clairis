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
    .evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
}

function barHeights(page: Page) {
  return page
    .locator(".width-bar")
    .evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)),
    );
}

test("四档柱体无虚线边框，未选中填充压到 0.45 以下", async ({ page }) => {
  await openPanel(page);
  const list = await borders(page);
  expect(list).toHaveLength(4);
  for (const b of list) {
    expect(b.style).toBe("none");
  }
  const opacities = await fills(page);
  expect(opacities.filter((o) => o > 0.45)).toHaveLength(1);
  expect(opacities.filter((o) => o <= 0.45)).toHaveLength(3);
});

test("四档高度按档位递增", async ({ page }) => {
  await openPanel(page);
  expect(await barHeights(page)).toEqual([14, 17, 20, 23]);
});

test("选中柱体不透明度为 1，未选中均 ≤0.45", async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="width-preset-960"]').click();
  const opacities = await fills(page);
  expect(opacities.filter((o) => o === 1)).toHaveLength(1);
  for (const opacity of opacities) {
    if (opacity !== 1) expect(opacity).toBeLessThanOrEqual(0.45);
  }
});

test("悬停即显示按钮与弹窗，移出后两者都隐藏", async ({ page }) => {
  await boot(page);
  const control = page.getByTestId("width-control");
  const button = page.getByTestId("status-width");
  const panel = page.getByTestId("width-panel");

  expect(await button.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await expect(panel).toHaveCount(0);

  await control.hover();
  await expect(button).toHaveCSS("opacity", "1", { timeout: 3000 });
  await expect(panel).toBeVisible({ timeout: 3000 });

  await page.mouse.move(10, 10);
  await expect(panel).toHaveCount(0, { timeout: 3000 });
  await expect(button).toHaveCSS("opacity", "0", { timeout: 3000 });
});

test("宽度按钮提示不带操作括号说明", async ({ page }) => {
  await openPanel(page);
  await expect(page.getByTestId("status-width")).toHaveAttribute(
    "title",
    "页面宽度 1080px",
  );
});

test("四柱居中相接且滑块长于四柱", async ({ page }) => {
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

test("点击 1200 档后正文宽度变为 1200px", async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="width-preset-1200"]').click();
  await expect(page.getByTestId("status-width")).toHaveText("1200px");
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.querySelector(".preview-content");
        return el
          ? getComputedStyle(el).getPropertyValue("--type-measure").trim()
          : "";
      }),
    )
    .toBe("1200px");
});

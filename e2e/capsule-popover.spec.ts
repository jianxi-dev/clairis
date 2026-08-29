import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const VW = 1200;
const VH = 800;

async function openOverlay(page: import("@playwright/test").Page) {
  await page.keyboard.press(`${MOD}+Shift+.`);
  await page.waitForTimeout(500);
}

async function minimizeToCapsule(page: import("@playwright/test").Page) {
  const topBar = page.locator(".cursor-grab").first();
  await topBar.dblclick();
  await page.waitForTimeout(500);
}

async function getCapsule(page: import("@playwright/test").Page) {
  const capsule = page.locator("button").filter({ hasText: "⊕" });
  await expect(capsule).toBeVisible({ timeout: 3000 });
  return capsule;
}

async function dragCapsule(
  page: import("@playwright/test").Page,
  targetX: number,
  targetY: number,
) {
  const capsule = await getCapsule(page);
  const box = await capsule.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("Capsule Popover Positioning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("header", { timeout: 10000 });
  });

  test("capsule popover opens and is visible", async ({ page }) => {
    await openOverlay(page);
    await minimizeToCapsule(page);
    const capsule = await getCapsule(page);
    await capsule.click();
    await page.waitForTimeout(300);
    await expect(page.getByText("当前 buffer:")).toBeVisible();
  });

  test("capsule popover flips left when near right edge", async ({ page }) => {
    await openOverlay(page);
    await minimizeToCapsule(page);
    await dragCapsule(page, VW - 30, 200);

    const capsule = await getCapsule(page);
    const capsuleBox = await capsule.boundingBox();
    expect(capsuleBox).not.toBeNull();

    await capsule.click();
    await page.waitForTimeout(300);

    const popover = page.getByText("当前 buffer:").locator("..");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();

    // Popover should open to the LEFT: its right edge aligns with capsule's right edge
    // (right-0 on the parent relative div which wraps the capsule button)
    const capsuleRight = capsuleBox!.x + capsuleBox!.width;
    const popoverRight = popoverBox!.x + popoverBox!.width;
    expect(popoverRight).toBeLessThanOrEqual(capsuleRight + 10);
    // And the popover extends to the left
    expect(popoverBox!.x).toBeLessThanOrEqual(capsuleBox!.x);
  });

  test("capsule popover opens right when near left edge", async ({ page }) => {
    await openOverlay(page);
    await minimizeToCapsule(page);
    await dragCapsule(page, 30, 200);

    const capsule = await getCapsule(page);
    const capsuleBox = await capsule.boundingBox();
    expect(capsuleBox).not.toBeNull();

    await capsule.click();
    await page.waitForTimeout(300);

    const popover = page.getByText("当前 buffer:").locator("..");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();

    // Popover should be to the RIGHT of the capsule
    expect(popoverBox!.x).toBeGreaterThanOrEqual(capsuleBox!.x - 10);
  });

  test("capsule popover flips up when near bottom edge", async ({ page }) => {
    await openOverlay(page);
    await minimizeToCapsule(page);
    await dragCapsule(page, 200, VH - 30);

    const capsule = await getCapsule(page);
    const capsuleBox = await capsule.boundingBox();
    expect(capsuleBox).not.toBeNull();

    await capsule.click();
    await page.waitForTimeout(300);

    const popover = page.getByText("当前 buffer:").locator("..");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();

    // Popover should be ABOVE the capsule (bottom-12)
    expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(
      capsuleBox!.y + 10,
    );
  });

  test("popover opens down when capsule is in upper area", async ({ page }) => {
    await openOverlay(page);
    await minimizeToCapsule(page);
    await dragCapsule(page, 200, 50);

    const capsule = await getCapsule(page);
    const capsuleBox = await capsule.boundingBox();
    expect(capsuleBox).not.toBeNull();

    await capsule.click();
    await page.waitForTimeout(300);

    const popover = page.getByText("当前 buffer:").locator("..");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();

    // Popover should be BELOW the capsule (top-12)
    expect(popoverBox!.y).toBeGreaterThanOrEqual(
      capsuleBox!.y + capsuleBox!.height - 10,
    );
  });

  test("popover never overflows viewport horizontally", async ({ page }) => {
    // Right edge test
    await openOverlay(page);
    await minimizeToCapsule(page);
    await dragCapsule(page, VW - 30, 200);
    const capsule = await getCapsule(page);
    await capsule.click();
    await page.waitForTimeout(300);

    const popover = page.getByText("当前 buffer:").locator("..");
    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VW + 5);
  });
});

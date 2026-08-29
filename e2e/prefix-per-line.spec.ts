import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

async function openOverlay(page: import("@playwright/test").Page) {
  await page.keyboard.press(`${MOD}+Shift+.`);
  await page.waitForTimeout(500);
}

test.describe("Prefix per-line detection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("header", { timeout: 10000 });
  });

  test("1. type . at line start → prefix triggers, content empty", async ({
    page,
  }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await expect(ta).toBeVisible();
    await ta.fill("");
    await ta.type(".");
    // Prefix badge should appear
    await expect(page.locator("text=.")).toBeVisible();
    // Content should be empty (prefix char consumed)
    expect(await ta.inputValue()).toBe("");
  });

  test("2. Enter on non-empty line → prefix stays", async ({ page }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await ta.fill("");
    await ta.type(".");
    await expect(page.locator("text=.")).toBeVisible();
    // Type something then Enter
    await ta.type("hello");
    await ta.press("Enter");
    // Prefix should still be visible
    await expect(page.locator("text=.")).toBeVisible();
    // Content should be "hello\n"
    expect(await ta.inputValue()).toBe("hello\n");
  });

  test("3. Enter on empty line → clear prefix", async ({ page }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await ta.fill("");
    await ta.type(".");
    await expect(page.locator("text=.")).toBeVisible();
    // Press Enter twice: first on content, second on empty line
    await ta.press("Enter");
    await ta.press("Enter");
    // Prefix should be cleared
    await expect(page.locator("text=.")).not.toBeVisible();
  });

  test("4. type - at new line → switch prefix", async ({ page }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await ta.fill("");
    await ta.type(".");
    await expect(page.locator("text=.")).toBeVisible();
    await ta.type("hello");
    await ta.press("Enter");
    // Now on new line, type -
    await ta.type("-");
    // Prefix should switch to -
    await expect(page.locator("text=-")).toBeVisible();
    await expect(page.locator("text=.")).not.toBeVisible();
  });

  test("5. type text then Enter then . → prefix triggers on new line", async ({
    page,
  }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await ta.fill("");
    await ta.type("hello");
    await ta.press("Enter");
    // Now on new line, type .
    await ta.type(".");
    // Prefix should be detected
    await expect(page.locator("text=.")).toBeVisible();
    // Content should be "hello\n" (prefix consumed)
    expect(await ta.inputValue()).toBe("hello\n");
  });

  test("6. Cmd+Enter clears prefix", async ({ page }) => {
    await openOverlay(page);
    const ta = page.locator("textarea[data-capture-input]");
    await ta.fill("");
    await ta.type(".");
    await expect(page.locator("text=.")).toBeVisible();
    await ta.type("test entry");
    // Cmd+Enter to submit
    await ta.press(`${MOD}+Enter`);
    await page.waitForTimeout(500);
    // Prefix should be cleared
    await expect(page.locator("text=.")).not.toBeVisible();
  });
});

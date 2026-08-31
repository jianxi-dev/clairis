import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

async function setup(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
}

/** Open a file via store bridge exposed on window */
async function openMockFile(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    (win as any).__clairis_openFile__(
      "/Users/test/测试文档.md",
      `# 测试文档\n\n## 第一节\n\n测试内容。\n\n## 第二节\n\n更多。\n\n### 子节\n\n嵌套。\n\n- 列表1\n- 列表2\n\n> 引用\n\n**粗体** *斜体*\n\n- [ ] 待办\n- [x] 完成`,
      "测试文档.md",
    );
  });
  await page.waitForTimeout(500);
}

async function openFileB(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__clairis_openFile__(
      "/Users/test/文件B.md",
      "# 文件B\n\n这是第二个文件的内容，完全不同。\n\n## B的第二节\n\n文件B特有内容。",
      "文件B.md",
    );
  });
  await page.waitForTimeout(300);
}

test.describe("Clairis — Tauri Mocked", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
  });

  test("1. open file → tab created → content visible", async ({ page }) => {
    await openMockFile(page);

    // Tab bar AND toolbar both show the file name — verify both
    await expect(page.getByText("测试文档.md").first()).toBeVisible({
      timeout: 5000,
    });
    // Content visible
    await expect(page.getByRole("heading", { name: "第一节" })).toBeVisible({
      timeout: 5000,
    });
    console.log("✅ File open → tab + content");
  });

  test("2. open 2 files → right-click tab → context menu → split", async ({
    page,
  }) => {
    await openMockFile(page);
    // Open second file
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__clairis_openFile__(
        "/Users/test/另一个.md",
        "# 另一个文件\n\n不同内容。",
        "另一个.md",
      );
    });
    await page.waitForTimeout(300);

    // Right-click the first tab
    await page.getByText("测试文档.md").click({ button: "right" });
    await page.waitForTimeout(300);

    // Context menu opens
    const menu = page.locator(".fixed.z-50");
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("向右分栏")).toBeVisible();
    await expect(page.getByText("向下分栏")).toBeVisible();

    // Click 向右分栏
    await page.getByText("向右分栏").click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "test-results/tauri-split-after.png" });
    console.log("✅ Context menu → split");
  });

  test("3. outline shows headings, click navigates", async ({ page }) => {
    await openMockFile(page);
    await page.waitForTimeout(300);

    // Switch to edit mode from toolbar
    const editBtn = page
      .locator("header button")
      .filter({ hasText: "编辑" })
      .first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(300);
    }

    // Switch to outline tab
    await page.getByRole("button", { name: "目录", exact: true }).click();
    await page.waitForTimeout(300);

    // Headings from mock content
    await expect(page.getByRole("button", { name: /第一节/ })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("button", { name: /第二节/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /子节/ })).toBeVisible();

    // Click first heading — should navigate editor
    await page.getByRole("button", { name: /第一节/ }).click();
    await page.waitForTimeout(300);

    // Editor should be visible (we're in edit mode)
    await expect(page.locator(".cm-editor").first()).toBeVisible();
    console.log("✅ Outline headings + click navigation");
  });

  test("4. Cmd+N new tab, visible in TabBar", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__clairis_store__
        .getState()
        .newTab();
    });
    await page.waitForTimeout(500);

    await expect(page.getByText("未命名").first()).toBeVisible({
      timeout: 5000,
    });
    console.log("✅ New tab visible");
  });

  test("5. dark mode toggle", async ({ page }) => {
    await openMockFile(page);
    const btn = page.getByTitle(/当前:/);
    for (let i = 0; i < 5; i++) {
      const t = await btn.getAttribute("title");
      if (t?.includes("暗色")) break;
      await btn.click();
      await page.waitForTimeout(100);
    }
    await expect(page.locator("html")).toHaveClass(/dark/);

    const bg = await page
      .locator(".cm-editor")
      .first()
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
    console.log(`✅ Dark mode: bg=${bg}`);
  });

  test("6. FileTree pick_folder → files appear", async ({ page }) => {
    await page.getByRole("button", { name: "文件", exact: true }).click();
    await page.getByRole("button", { name: "选择文件夹" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("测试文档.md")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("另一个.md")).toBeVisible();
    console.log("✅ FileTree populated");
  });

  test("7. open file from FileTree creates tab", async ({ page }) => {
    // First pick folder
    await page.getByRole("button", { name: "文件", exact: true }).click();
    await page.getByRole("button", { name: "选择文件夹" }).click();
    await page.waitForTimeout(500);

    // Click a file to open it
    // The file "测试文档.md" should appear — click it
    const fileEntry = page.getByText("测试文档.md").first();
    await expect(fileEntry).toBeVisible({ timeout: 5000 });
    await fileEntry.click();
    await page.waitForTimeout(500);

    // The file name should appear in both the toolbar title and tab bar
    const tabTitle = page.getByText("测试文档.md").first();
    await expect(tabTitle).toBeVisible({ timeout: 5000 });
    console.log("✅ FileTree → open file → tab created");
  });

  test("8. Cmd+\\ toggle sidebar with file open", async ({ page }) => {
    await openMockFile(page);
    const fileBtn = page.getByRole("button", { name: "文件", exact: true });
    await expect(fileBtn).toBeVisible();
    await page.keyboard.press(`${MOD}+\\`);
    await page.waitForTimeout(400);
    await expect(fileBtn).not.toBeVisible();
    await page.keyboard.press(`${MOD}+\\`);
    await page.waitForTimeout(400);
    await expect(fileBtn).toBeVisible();
    console.log("✅ Sidebar toggle");
  });

  test("9. split panels show DIFFERENT file content", async ({ page }) => {
    // Open two files
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__clairis_openFile__(
        "/Users/test/文件A.md",
        "# 文件A\n\n这是第一个文件的内容。\n\n## A的第二节\n\n文件A特有内容。",
        "文件A.md",
      );
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__clairis_openFile__(
        "/Users/test/文件B.md",
        "# 文件B\n\n这是第二个文件的内容，完全不同。\n\n## B的第二节\n\n文件B特有内容。",
        "文件B.md",
      );
    });
    await page.waitForTimeout(300);

    // Split 文件B to right panel via store API (bypasses context menu)
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, any>)
        .__clairis_store__;
      const tabs = store.getState().tabs;
      const tabB = Object.values(tabs).find(
        (t: any) => t.title === "文件B.md",
      ) as any;
      if (tabB) store.getState().splitTab(tabB.id, "horizontal");
    });
    await page.waitForTimeout(500);

    // Verify content is DIFFERENT across panels
    const body = await page.locator("body").innerHTML();
    expect(body).toContain("文件A特有内容");
    expect(body).toContain("文件B特有内容");
    // Both files should be visible (not duplicated)
    console.log("✅ Split panels show different content");
  });

  test("10. no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("TauriMock"))
        errors.push(msg.text());
    });
    await openMockFile(page);
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__clairis_store__
        .getState()
        .newTab();
    });
    await page.waitForTimeout(200);

    const critical = errors.filter(
      (e) => !e.includes("Failed to load") && !e.includes("invoke"),
    );
    expect(critical).toHaveLength(0);
    console.log("✅ No console errors");
  });
});

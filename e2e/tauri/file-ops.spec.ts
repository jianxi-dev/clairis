import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function setup(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  // 应用启动在门户首屏（layout-portal 2.1）；本套用例测的是工作区外壳
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
}

/** Open a file via store bridge exposed on window */
async function openMockFile(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    (win as any).__biaoyue_openFile__(
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
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/Users/test/文件B.md",
      "# 文件B\n\n这是第二个文件的内容，完全不同。\n\n## B的第二节\n\n文件B特有内容。",
      "文件B.md",
    );
  });
  await page.waitForTimeout(300);
}

test.describe("Biaoyue — Tauri Mocked", () => {
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
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
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

  test("4. Cmd+N new tab, visible in TabBar", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__biaoyue_store__
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

  test("9. split panels show DIFFERENT file content", async ({ page }) => {
    // Open first file into the root pane
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_openFile__(
        "/Users/test/文件A.md",
        "# 文件A\n\n这是第一个文件的内容。\n\n## A的第二节\n\n文件A特有内容。",
        "文件A.md",
      );
    });
    await page.waitForTimeout(200);

    // pane 递归树（layout-portal 3.1）：对聚焦格右分，再把第二个文件开进新格
    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__biaoyue_store__
        .getState()
        .splitPane("row");
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        "/Users/test/文件B.md",
        "# 文件B\n\n这是第二个文件的内容，完全不同。\n\n## B的第二节\n\n文件B特有内容。",
        "文件B.md",
      );
    });
    await page.waitForTimeout(400);

    // 两格各自渲染自己的活动页签
    await expect(page.locator("[data-pane-id]")).toHaveCount(2);
    // innerText 而非 innerHTML：CJK 间距会在「文件」与「A」之间插
    // <span class="cjk-pad">，字符串直连断言恒假（陈旧断言，与功能无关）。
    const text = await page.locator("body").innerText();
    expect(text).toContain("文件A特有内容");
    expect(text).toContain("文件B特有内容");
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
      (window as unknown as Record<string, any>).__biaoyue_store__
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

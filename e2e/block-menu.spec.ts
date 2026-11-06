import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/block-menu.md",
      body,
      "block-menu.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

test("hover 块手柄弹出块菜单，十项转换 + 在下方添加", async ({ page }) => {
  await hoverHandle(page, 0);

  const items = page.locator('[data-testid="block-menu-cell"]');
  await expect(items).toHaveCount(10);
  await expect(
    page.locator('[data-testid="block-menu-add-below"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="block-menu"]')).toContainText(
    "转为",
  );
});

test("点「一级标题」把段落转成标题，其余字节不变", async ({ page }) => {
  await hoverHandle(page, 2);

  await page
    .locator('[data-testid="block-menu-cell"][data-target="h1"]')
    .click();

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  const content = await storeContent(page);
  // 红线 1：只有目标块的首行前缀变化，其余字节逐字不变
  expect(content).toBe("# 标题\n\n# 第一段正文\n\n第二段正文\n");
});

test("红线 5：转换后可见文本等于源码文本（去掉标记）", async ({ page }) => {
  await hoverHandle(page, 2);
  await page
    .locator('[data-testid="block-menu-cell"][data-target="h1"]')
    .click();

  // 源码：首行带标记
  const source = await storeContent(page);
  const sourceLine = source
    .split("\n")
    .find((line) => line.includes("第一段正文"));
  expect(sourceLine).toBe("# 第一段正文");

  // 预览：同样的文字，不带标记
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  const heading = page
    .locator(".preview-content h1")
    .filter({ hasText: "第一段正文" });
  await expect(heading).toHaveCount(1);
  expect((await heading.textContent())?.trim()).toBe("第一段正文");
});

test("Esc 关闭块菜单", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});

test("滚动即收：编辑器滚动后块菜单关闭", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator(".cm-scroller").evaluate((el) => {
    el.dispatchEvent(new Event("scroll"));
  });

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});

test("点击手柄也打开菜单（不必等 hover）", async ({ page }) => {
  const line = page.locator(".cm-line").nth(2);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.click();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
});

test("菜单贴手柄右侧，并以指针行为中心", async ({ page }) => {
  await hoverHandle(page, 2);

  const geometry = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(
      '[data-testid="block-menu"]',
    )!;
    const handle = document.querySelector<HTMLElement>(
      '[data-testid="block-handle"].cm-block-handle-visible',
    )!;
    const menuRect = menu.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const pane = (
      document.querySelector(".cm-editor") as HTMLElement
    ).getBoundingClientRect();
    const margin = 8;
    const minCentre = pane.top + margin + menuRect.height / 2;
    const maxCentre = pane.bottom - margin - menuRect.height / 2;
    const idealCentre = Math.max(
      minCentre,
      Math.min(handleRect.top + handleRect.height / 2, maxCentre),
    );
    return {
      menuLeft: menuRect.left,
      menuCentreY: (menuRect.top + menuRect.bottom) / 2,
      handleRight: handleRect.right,
      idealCentre,
      insidePane:
        menuRect.top >= pane.top - 1 && menuRect.bottom <= pane.bottom + 1,
    };
  });

  expect(geometry.menuLeft).toBeGreaterThanOrEqual(geometry.handleRight - 1);
  expect(
    Math.abs(geometry.menuCentreY - geometry.idealCentre),
  ).toBeLessThanOrEqual(2);
  expect(geometry.insidePane).toBe(true);
});

test("块菜单每一行都有图标", async ({ page }) => {
  await hoverHandle(page, 0);
  const rows = page.locator('[data-testid="block-menu-cell"]');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i).locator("svg")).toHaveCount(1);
  }
});

test("「在下方添加」悬停即向右展开二级面板，父菜单保留", async ({ page }) => {
  await hoverHandle(page, 2);

  const menuBefore = await page
    .locator('[data-testid="block-menu"]')
    .boundingBox();
  await page.locator('[data-testid="block-menu-add-below"]').hover();

  const flyout = page.locator(".mdb-slash-menu");
  await expect(flyout).toBeVisible({ timeout: 3000 });

  const menuAfter = await page
    .locator('[data-testid="block-menu"]')
    .boundingBox();
  expect(menuAfter).not.toBeNull();
  expect(Math.round(menuAfter!.height)).toBe(Math.round(menuBefore!.height));

  const flyoutBox = (await flyout.boundingBox())!;
  expect(flyoutBox.x).toBeGreaterThanOrEqual(
    menuAfter!.x + menuAfter!.width - 1,
  );
});

test("菜单打开时移动指针不再冒出其它手柄", async ({ page }) => {
  await hoverHandle(page, 2);
  const menu = page.locator('[data-testid="block-menu"]');
  const box = (await menu.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 120);
  await page.waitForTimeout(400);
  await expect(page.locator(".cm-block-handle-visible")).toHaveCount(1);
});

test("打字结束后移动到正文仍能召唤手柄", async ({ page }) => {
  await page.locator(".cm-content").click();
  await page.keyboard.type("x");
  await page.keyboard.press("Backspace");

  const line = page
    .locator(".cm-line")
    .filter({ hasText: "第一段正文" })
    .first();
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  await expect(page.locator(".cm-block-handle-visible")).toHaveCount(1, {
    timeout: 3000,
  });
});

test("结构动作：复制块 / 删除块 / 缩进 都真的改源码", async ({ page }) => {
  await hoverHandle(page, 2);
  const actions = page.locator('[data-testid="block-menu-action"]');
  await expect(actions.first()).toBeVisible();

  // 复制块
  await page.locator('[data-action="duplicate"]').click();
  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n第一段正文\n\n第一段正文\n\n第二段正文\n");
});

test("删除块只删目标块", async ({ page }) => {
  await hoverHandle(page, 2);
  await page.locator('[data-action="delete"]').click();
  await expect.poll(() => storeContent(page)).toBe("# 标题\n\n第二段正文\n");
});

test("增加缩进给块内每行加两个空格", async ({ page }) => {
  await hoverHandle(page, 2);
  await page.locator('[data-action="indent"]').click();
  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n  第一段正文\n\n第二段正文\n");
});

test("高亮块菜单出现「类型」，切换后源码只改标记", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-callout.md",
      "> [!note] 标题\n> 正文一行\n",
      "block-callout.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });
  await hoverHandle(page, 0);
  const typeRow = page.locator('[data-testid="block-menu-type"]');
  await expect(typeRow).toBeVisible();
  await typeRow.hover();
  await page.locator('[data-testid="block-menu-type-panel"]').waitFor({
    timeout: 3000,
  });
  await page.locator('[data-type-key="tip"]').click();
  await expect
    .poll(() => storeContent(page))
    .toBe("> [!tip] 标题\n> 正文一行\n");
});

test("普通块没有「类型」入口", async ({ page }) => {
  await hoverHandle(page, 2);
  await expect(page.locator('[data-testid="block-menu-type"]')).toHaveCount(0);
});

test("颜色行打开二级面板，含字体色与背景色双行", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  await expect(panel.locator(".cm-color-row")).toHaveCount(2);
  await expect(panel.locator('[data-testid="color-swatch-font"]')).toHaveCount(
    9,
  );
  await expect(
    panel.locator('[data-testid="color-swatch-background"]'),
  ).toHaveCount(16);
});

test("点红色字体色把块内容包进 mdb-color-red，写入源码", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator('[data-testid="block-menu-color"]').hover();
  await page
    .locator('[data-testid="block-menu-color-panel"]')
    .locator(
      '[data-testid="color-swatch-font"][data-class-name="mdb-color-red"]',
    )
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-color-red">第一段正文</span>\n\n第二段正文\n',
    );
});

test("再点「默认」清除颜色包裹，源码回到原文", async ({ page }) => {
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-menu-color.md",
      '# 标题\n\n<span class="mdb-color-red">第一段正文</span>\n\n第二段正文\n',
      "block-menu-color.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 5000 });
  await hoverHandle(page, 2);

  await page.locator('[data-testid="block-menu-color"]').hover();
  await page
    .locator('[data-testid="block-menu-color-panel"]')
    .locator('[data-testid="color-swatch-font"][data-class-name=""]')
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n第一段正文\n\n第二段正文\n");
});

test("点背景色把块内容包进 mdb-bg-blue", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator('[data-testid="block-menu-color"]').hover();
  await page
    .locator('[data-testid="block-menu-color-panel"]')
    .locator(
      '[data-testid="color-swatch-background"][data-class-name="mdb-bg-blue"]',
    )
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-bg-blue">第一段正文</span>\n\n第二段正文\n',
    );
});

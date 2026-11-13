import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
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

test("默认视口转换菜单完整显示：可见行数等于总行数", async ({ page }) => {
  await hoverHandle(page, 2);

  const info = await page.evaluate(() => {
    const panel = document.querySelector(
      '[data-testid="block-menu"]',
    ) as HTMLElement;
    const pr = panel.getBoundingClientRect();
    const rows = Array.from(
      panel.querySelectorAll(
        ".cm-block-menu-cell, .cm-block-menu-item, .cm-block-menu-group",
      ),
    ) as HTMLElement[];
    const visible = rows.filter((r) => {
      const b = r.getBoundingClientRect();
      return b.top >= pr.top - 1 && b.bottom <= pr.bottom + 1;
    }).length;
    return {
      total: rows.length,
      visible,
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
      maxHeight: panel.style.maxHeight,
    };
  });

  expect(info.maxHeight).toBe("");
  expect(info.scrollHeight).toBeLessThanOrEqual(info.clientHeight);
  expect(info.visible).toBe(info.total);
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
  await page.locator('[data-testid="block-menu-align"]').hover();
  await page.locator('[data-alignment="indent"]').click();
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

test("缩进 / 减少缩进图标语义正确（不是对齐图标）", async ({ page }) => {
  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-align"]').hover();

  const indentIcon = page
    .locator('[data-alignment="indent"]')
    .locator("svg[data-icon]");
  await expect(indentIcon).toHaveAttribute(
    "data-icon",
    "IndentIncreaseOutlined",
  );

  const outdentIcon = page
    .locator('[data-alignment="outdent"]')
    .locator("svg[data-icon]");
  await expect(outdentIcon).toHaveAttribute(
    "data-icon",
    "IndentDecreaseOutlined",
  );
});

test("颜色面板色块呈实色（背景色无偏淡浅色块）", async ({ page }) => {
  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });

  const bgSwatch = panel.locator(
    '[data-testid="color-swatch-background"][data-class-name="mdb-bg-red"]',
  );
  const background = await bgSwatch.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  // 实色 #f0000e = rgb(240, 0, 14)
  expect(background).toBe("rgb(240, 0, 14)");
});

test("对齐入口：应用居中写入围栏 div，再次应用拆掉", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator('[data-testid="block-menu-align"]').hover();
  await page
    .locator('[data-testid="block-menu-align-panel"]')
    .locator('[data-alignment="center"]')
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n");

  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await page
    .locator('[data-testid="block-menu-align-panel"]')
    .locator('[data-alignment="center"]')
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n第一段正文\n\n第二段正文\n");
});

test("对齐入口：异对齐换类名", async ({ page }) => {
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-menu-align.md",
      body,
      "block-menu-align.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, "# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n");
  await page.locator(".cm-content").waitFor({ timeout: 5000 });

  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await page
    .locator('[data-testid="block-menu-align-panel"]')
    .locator('[data-alignment="right"]')
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n::: {.align-right}\n第一段正文\n:::\n\n第二段正文\n");
});

async function rectGap(
  page: Page,
  selector: string,
  reference: string,
): Promise<{ dx: number; dy: number }> {
  return page.evaluate(
    ({ selector, reference }) => {
      const a = document.querySelector(selector)!.getBoundingClientRect();
      const b = document.querySelector(reference)!.getBoundingClientRect();
      const dx = Math.max(0, b.left - a.right, a.left - b.right);
      const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
      return { dx, dy };
    },
    { selector, reference },
  );
}

test("菜单贴着块手柄：矩形间距不超过 8px", async ({ page }) => {
  await hoverHandle(page, 2);

  const gap = await rectGap(
    page,
    '[data-testid="block-menu"]',
    '[data-testid="block-handle"]',
  );
  expect(gap.dx).toBeLessThanOrEqual(8);
  expect(gap.dy).toBeLessThanOrEqual(8);
  await page.screenshot({ path: ".artifacts/371/01-gap.png" });
});

test("连续两次召唤同一菜单，偏移完全一致", async ({ page }) => {
  await hoverHandle(page, 2);
  const before = await page
    .locator('[data-testid="block-menu"]')
    .evaluate((el) => {
      const style = (el as HTMLElement).style;
      return { left: style.left, top: style.top };
    });

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);

  await hoverHandle(page, 2);
  const after = await page
    .locator('[data-testid="block-menu"]')
    .evaluate((el) => {
      const style = (el as HTMLElement).style;
      return { left: style.left, top: style.top };
    });

  expect(after).toEqual(before);
});

test("触发元素贴底时菜单完整留在视口内", async ({ page }) => {
  // 视口压到 320px 高：块手柄所在行贴近底边，菜单无论如何都要留在视口内。
  await page.setViewportSize({ width: 1000, height: 320 });
  await hoverHandle(page, 2);

  const inside = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="block-menu"]',
    ) as HTMLElement;
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    };
  });
  expect(inside.top).toBeGreaterThanOrEqual(0);
  expect(inside.left).toBeGreaterThanOrEqual(0);
  expect(inside.bottom).toBeLessThanOrEqual(inside.innerHeight - 8);
  expect(inside.right).toBeLessThanOrEqual(inside.innerWidth);
  await page.screenshot({ path: ".artifacts/371/02-bottom-edge.png" });
});

test("视口右侧放不下时菜单翻到锚点左侧，仍在视口内", async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 640 });
  await hoverHandle(page, 2);

  const box = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="block-menu"]',
    ) as HTMLElement;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, innerWidth: window.innerWidth };
  });
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.innerWidth);
  await page.screenshot({ path: ".artifacts/371/03-flip-left.png" });
});

test("选区工具条同样走统一落位，贴选区下方且不越视口", async ({ page }) => {
  const line = page.locator(".cm-line").nth(2);
  const box = (await line.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 3, 60), y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press(HOTKEY);

  const toolbar = page.locator('[data-testid="selection-roulette"]');
  await expect(toolbar).toBeVisible({ timeout: 3000 });
  const rect = await toolbar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    };
  });
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.bottom).toBeLessThanOrEqual(rect.innerHeight);
  expect(rect.right).toBeLessThanOrEqual(rect.innerWidth);
  await page.screenshot({ path: ".artifacts/371/04-toolbar.png" });
});

test("「对齐与缩进」二级恰好 5 项：3 对齐带图标 + 2 缩进", async ({ page }) => {
  await hoverHandle(page, 2);

  const row = page.locator('[data-testid="block-menu-align"]');
  await expect(row).toContainText("对齐与缩进");
  await row.hover();

  const panel = page.locator('[data-testid="block-menu-align-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  await expect(
    panel.locator('[data-testid="block-menu-align-option"]'),
  ).toHaveCount(5);
  for (const key of ["left", "center", "right"]) {
    await expect(panel.locator(`[data-alignment="${key}"] svg`)).toHaveCount(1);
  }
  await expect(panel.locator('[data-alignment="indent"] svg')).toHaveCount(1);
  await expect(panel.locator('[data-alignment="outdent"] svg')).toHaveCount(1);
  await page.screenshot({ path: ".artifacts/373/01-align-indent.png" });
});

test("转换菜单与新增手柄菜单同宽（差 0px）", async ({ page }) => {
  await hoverHandle(page, 2);
  const blockWidth = await page
    .locator('[data-testid="block-menu"]')
    .evaluate((el) => (el as HTMLElement).offsetWidth);

  await page.mouse.move(20, 20);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/Users/test/bm-width.md",
      "# 标题\n\n\n第二段",
      "bm-width.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });
  const add = page.locator(".cm-block-handle-add").first();
  await add.hover();
  const insertWidth = await page
    .locator(".mdb-slash-menu")
    .evaluate((el) => (el as HTMLElement).offsetWidth);

  expect(Math.abs(blockWidth - insertWidth)).toBe(0);
  await page.screenshot({ path: ".artifacts/373/02-same-width.png" });
});

test("转换网格前两行（标题 / 无序列表）间距小于下方结构行", async ({
  page,
}) => {
  await hoverHandle(page, 2);

  const geometry = await page.evaluate(() => {
    const cells = Array.from(
      document.querySelectorAll('[data-testid="block-menu-cell"]'),
    ) as HTMLElement[];
    const rects = cells.map((c) => c.getBoundingClientRect());
    const firstRowTop = rects.slice(0, 5)[0].top;
    const secondRowTop = rects[5].top;
    const rowPitch = secondRowTop - firstRowTop;
    const action = document.querySelector(
      '[data-testid="block-menu-action"]',
    ) as HTMLElement;
    const actionTop = action.getBoundingClientRect().top;
    const secondRowBottom = rects[9].bottom;
    return {
      rowPitch,
      toAction: actionTop - secondRowBottom,
    };
  });
  expect(geometry.rowPitch).toBeLessThan(64);
  expect(geometry.toAction).toBeGreaterThan(0);
  await page.screenshot({ path: ".artifacts/373/03-grid-spacing.png" });
});

test("二级菜单选「减少缩进」回收两格缩进", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-menu-outdent.md",
      "# 标题\n\n  第一段正文\n\n第二段正文\n",
      "block-menu-outdent.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });

  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await page.locator('[data-alignment="outdent"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n第一段正文\n\n第二段正文\n");
  await page.screenshot({ path: ".artifacts/373/04-outdent.png" });
});

test("颜色二级面板在触发行右侧展开，指针移入后不消失", async ({ page }) => {
  await hoverHandle(page, 2);
  const row = page.locator('[data-testid="block-menu-color"]');
  await row.hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  const rowBox = (await row.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.x).toBeGreaterThanOrEqual(rowBox.x + rowBox.width - 1);

  await page.mouse.move(
    panelBox.x + panelBox.width / 2,
    panelBox.y + panelBox.height / 2,
  );
  await page.waitForTimeout(400);
  await expect(panel).toBeVisible();
});

test("剪切块使用剪刀图标", async ({ page }) => {
  await hoverHandle(page, 2);
  const cut = page.locator(
    '[data-testid="block-menu-action"][data-action="cut"]',
  );
  await expect(cut.locator("svg[data-icon='ScissorsOutlined']")).toHaveCount(1);
});

test("颜色与缩进二级面板在触发行右侧展开", async ({ page }) => {
  await hoverHandle(page, 0);

  const colorRow = page.locator('[data-testid="block-menu-color"]');
  await colorRow.hover();
  const colorPanel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(colorPanel).toBeVisible();
  const colorRowBox = (await colorRow.boundingBox())!;
  const colorPanelBox = (await colorPanel.boundingBox())!;
  expect(colorPanelBox.x).toBeGreaterThanOrEqual(
    colorRowBox.x + colorRowBox.width - 1,
  );

  await page.locator('[data-testid="block-menu-align"]').hover();
  const alignPanel = page.locator('[data-testid="block-menu-align-panel"]');
  await expect(alignPanel).toBeVisible();
  const alignRowBox = (await page
    .locator('[data-testid="block-menu-align"]')
    .boundingBox())!;
  const alignPanelBox = (await alignPanel.boundingBox())!;
  expect(alignPanelBox.x).toBeGreaterThanOrEqual(
    alignRowBox.x + alignRowBox.width - 1,
  );
});

test("对齐与缩进入口有图标，子项图标与项数一致", async ({ page }) => {
  await hoverHandle(page, 0);
  const alignRow = page.locator('[data-testid="block-menu-align"]');
  await expect(alignRow.locator("svg[data-icon]")).toHaveCount(1);
  await alignRow.hover();
  const panel = page.locator('[data-testid="block-menu-align-panel"]');
  const options = panel.locator('[data-testid="block-menu-align-option"]');
  const count = await options.count();
  for (let i = 0; i < count; i += 1) {
    await expect(options.nth(i).locator("svg[data-icon]")).toHaveCount(1);
  }
});

test("类型二级面板：行内→面板不漏关，指针移远即收（#649）", async ({
  page,
}) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-callout-keep.md",
      "> [!note] 标题\n> 正文一行\n",
      "block-callout-keep.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });
  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-type"]').hover();
  const panel = page.locator('[data-testid="block-menu-type-panel"]');
  await panel.waitFor({ timeout: 3000 });

  await panel.hover();
  await page.waitForTimeout(300);
  await expect(panel).toBeVisible();

  await page.mouse.move(900, 620);
  await expect(panel).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0, {
    timeout: 3000,
  });

  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-type"]').hover();
  await panel.waitFor({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  await expect
    .poll(() => storeContent(page))
    .toBe("> [!note] 标题\n> 正文一行\n");
});

test("改过的 emoji 不跟随错误类型：转 TIP 后回到 TIP 默认图标", async ({
  page,
}) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-callout-emoji.md",
      "> [!note] 标题\n> 正文一行\n",
      "block-callout-emoji.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });

  const card = page.locator(".cm-callout").first();
  await card.locator(".cm-callout-icon").click();
  await page
    .locator('[data-testid="cm-callout-emoji-option"][data-emoji="🚀"]')
    .click();
  await expect(card).toHaveAttribute("data-callout-emoji", "🚀");

  await hoverHandle(page, 0);
  await page.locator('[data-testid="block-menu-type"]').hover();
  await page.locator('[data-testid="block-menu-type-panel"]').waitFor({
    timeout: 3000,
  });
  await page.locator('[data-type-key="tip"]').click();
  await expect(card).toHaveAttribute("data-callout-emoji", "💡");
  await expect(card).not.toHaveAttribute("data-callout-emoji", "🚀");
});

// ── #697：子菜单回移不消失（A-3.1）与图片 / 表格菜单跟随指针（A-3.2） ──

async function menuHandleCenterDelta(page: Page): Promise<number> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(
      '[data-testid="block-menu"]',
    )!;
    const handle = document.querySelector<HTMLElement>(
      '[data-testid="block-handle"].cm-block-handle-visible',
    )!;
    const menuRect = menu.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    return Math.abs(
      (menuRect.top + menuRect.bottom) / 2 -
        (handleRect.top + handleRect.bottom) / 2,
    );
  });
}

test("子菜单回移父菜单：300ms 宽限内转换菜单节点数恒为 1（A-3.1）", async ({
  page,
}) => {
  await hoverHandle(page, 2);
  await page.screenshot({ path: ".artifacts/697/01-parent-menu-open.png" });

  await page.locator('[data-testid="block-menu-add-below"]').hover();
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: ".artifacts/697/02-submenu-open.png" });

  // 指针移回父菜单上半部（避开「在下方添加」行）
  const menuBox = (await page
    .locator('[data-testid="block-menu"]')
    .boundingBox())!;
  await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 40);

  const returnedAt = Date.now();
  await expect
    .poll(
      async () => {
        const count = await page.locator('[data-testid="block-menu"]').count();
        return { count, ready: Date.now() - returnedAt >= 300 };
      },
      { timeout: 2000, intervals: [50] },
    )
    .toEqual({ count: 1, ready: true });
  await page.screenshot({ path: ".artifacts/697/03-after-return-300ms.png" });
});

test("图片块菜单垂直中心贴手柄中心（≤2px，A-3.2）", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-menu-image.md",
      [
        "上文一",
        "",
        "上文二",
        "",
        "上文三",
        "",
        "上文四",
        "",
        "![图片](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAIAAAA48Cq8AAABTUlEQVR4nO3SQQkAIADAQIOZxHRGtYRDkIMLsMfGXBuuG88L+JKxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIuEsUgYi4SxSBiLhLFIGIvEAUBFjSCXVB41AAAAAElFTkSuQmCC)",
        "",
        "下文一",
        "",
        "下文二",
        "",
      ].join("\n"),
      "block-menu-image.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });

  await hoverHandle(page, 8);
  const delta = await menuHandleCenterDelta(page);
  expect(delta).toBeLessThanOrEqual(2);
  await page.screenshot({ path: ".artifacts/697/04-image-menu-follow.png" });
});

test("表格块菜单垂直中心贴手柄中心（≤2px，A-3.2）", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/block-menu-table.md",
      [
        "上文一",
        "",
        "上文二",
        "",
        "上文三",
        "",
        "| 姓名 | 城市 |",
        "| --- | --- |",
        "| 甲 | 北京 |",
        "| 乙 | 上海 |",
        "| 丙 | 广州 |",
        "",
        "下文一",
        "",
      ].join("\n"),
      "block-menu-table.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 5000 });

  await hoverHandle(page, 6);
  const delta = await menuHandleCenterDelta(page);
  expect(delta).toBeLessThanOrEqual(2);
  await page.screenshot({ path: ".artifacts/697/05-table-menu-follow.png" });
});

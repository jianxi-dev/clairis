import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #262：网格「类型筛选」由原生 select 改为 hover 自定义菜单。
 * 鼠标移入 200ms 内展开，移出 400ms 内收起；选中写回 store 并关闭；键盘可达。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/262");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        setState: (s: Record<string, unknown>) => void;
      };
    };
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    w.__biaoyue_store__.setState({
      scene: "workspace",
      recentFiles: [
        { path: "/lib/a.md", title: "甲.md", openedAt: iso(now), excerpt: "" },
        {
          path: "/lib/b.pdf",
          title: "乙.pdf",
          openedAt: iso(now - 1000),
          excerpt: "",
        },
        {
          path: "/lib/c.md",
          title: "丙.md",
          openedAt: iso(now - 2000),
          excerpt: "",
        },
      ],
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

async function enterGrid(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
}

function storeState<T>(page: Page, key: string): Promise<T> {
  return page.evaluate((k) => {
    const s = (
      window as unknown as {
        __biaoyue_store__: { getState: () => Record<string, unknown> };
      }
    ).__biaoyue_store__.getState();
    return s[k] as never;
  }, key) as Promise<T>;
}

test("类型筛选 hover 展开 / 移出关闭 / 选中 PDF 写回 store", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGrid(page);

  const trigger = page.locator('[data-testid="grid-type-select"]');
  const menu = page.locator('[data-testid="grid-type-menu"]');

  await expect(menu).toHaveCount(0);

  // 移入 200ms 内可见
  await trigger.hover();
  await expect(menu).toBeVisible({ timeout: 200 });

  // 移出 400ms 内不可见
  await page.mouse.move(8, 8);
  await expect(menu).toBeHidden({ timeout: 400 });

  // 选中 PDF：store 写回、列表只剩 PDF、菜单关闭
  await trigger.hover();
  await expect(menu).toBeVisible({ timeout: 200 });
  await page.locator('[data-grid-type-option="pdf"]').click();
  await expect
    .poll(() => storeState<string | null>(page, "gridTypeFilter"))
    .toBe("pdf");
  await expect(menu).toHaveCount(0);

  const items = page.locator("[data-grid-item]");
  const n = await items.count();
  expect(n).toBe(1);
  await expect(items.first()).toHaveAttribute("data-tile-kind", "pdf");
  await page.screenshot({ path: path.join(ART, "grid-filter-pdf.png") });
});

test("类型筛选键盘可达：Enter 打开、Esc 关闭", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGrid(page);

  const trigger = page.locator('[data-testid="grid-type-select"]');
  const menu = page.locator('[data-testid="grid-type-menu"]');

  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ path: path.join(ART, "grid-filter-keyboard.png") });
});

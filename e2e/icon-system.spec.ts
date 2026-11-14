import { test, expect, type Page } from "@playwright/test";

/**
 * 图标体系与类型色（layout-portal 1.1 / #171）。
 *
 * 判据是"渲染出来的样子"：同一个类型在不同位置必须是同一个形状、同一个色值；
 * 界面文字里不许出现 emoji；设置里的图标抽屉要能列全。
 */

const TYPES: Array<[string, string, string]> = [
  // [文件名, data-icon, 期望色]
  ["a.md", "markdown", "rgb(99, 102, 241)"],
  ["b.html", "html", "rgb(245, 158, 11)"],
  ["c.txt", "text", "rgb(100, 116, 139)"],
  ["d.pdf", "pdf", "rgb(239, 68, 68)"],
  ["e.png", "image", "rgb(16, 185, 129)"],
  ["f.ts", "code", "rgb(6, 182, 212)"],
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

async function openDoc(page: Page, path: string, content = "# 标题\n正文") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ p, c }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(p, c, p.split("/").pop());
      win.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { p: path, c: content },
  );
}

test("页签图标：同一类型同形状、颜色严格等于类型色", async ({ page }) => {
  for (const [name, icon, color] of TYPES) {
    await openDoc(page, `/tmp/ic/${name}`);
    const tabIcon = page
      .locator(`[data-tab-id] svg[data-icon="${icon}"]`)
      .first();
    await expect(tabIcon).toBeVisible();
    const fill = await tabIcon.evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe(color);
    // 尺寸只有两档
    const size = await tabIcon.getAttribute("data-icon-size");
    expect(["18", "24"]).toContain(size);
    // 防退化：内部字形必须靠同一条 path 的子路径镂空。
    // 拆成多个 <path> 各自填充时，字形会被同色盖掉 —— 5 个类型图标会长得一模一样。
    const paths = await tabIcon.locator("path").count();
    expect(paths).toBe(1);
    const d = (await tabIcon.locator("path").getAttribute("d")) ?? "";
    expect((d.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
  }
});

test("界面文字里没有 emoji", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  const text = await page.evaluate(() => document.body.innerText);
  expect(EMOJI.test(text)).toBe(false);
});

test("设置里的图标抽屉列全在用图标，无空项", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  await page.keyboard.press("ControlOrMeta+,");
  const drawer = page.locator('[data-testid="icon-drawer"]');
  await expect(drawer).toBeVisible();

  const entries = page.locator("[data-icon-entry]");
  const n = await entries.count();
  expect(n).toBeGreaterThanOrEqual(13);
  for (let i = 0; i < n; i++) {
    const entry = entries.nth(i);
    await expect(entry.locator("svg")).toHaveCount(1);
    const label = (await entry.innerText()).trim();
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain("18/24");
  }
});

test("页签始终显示图标+标题，设置里不再有图标标签级别开关", async ({
  page,
}) => {
  await openDoc(page, "/tmp/ic/note.md");
  const tabTitle = page.locator("[data-tab-id] span.truncate").first();
  const tabIcon = page.locator('[data-tab-id] svg[data-icon="markdown"]');

  await expect(tabIcon).toHaveCount(1);
  await expect(tabTitle).toHaveText("note.md");
  await expect(page.locator("[data-tab-id] span.truncate")).toHaveCount(1);

  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.locator('[data-testid="icon-label-auto"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="icon-label-text"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="icon-label-icon"]')).toHaveCount(0);
});

test("8 个类型图标渲染出的像素各不相同（不是同一个色块）", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  // 文档页签只含一种类型；图标抽屉里有全量图标，从这里取样
  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.locator('[data-testid="icon-drawer"]')).toBeVisible();
  const signatures = await page.evaluate(async () => {
    const names = [
      "markdown",
      "html",
      "text",
      "pdf",
      "video",
      "image",
      "code",
      "audio",
    ];
    const out: Record<string, { hash: number; coverage: number }> = {};
    for (const name of names) {
      const svg = document.querySelector(
        `[data-testid="icon-drawer"] svg[data-icon="${name}"]`,
      );
      if (!svg) continue;
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute("width", "24");
      clone.setAttribute("height", "24");
      clone.setAttribute("fill", "#000");
      // 隔离 SVG 文档里 currentColor 不可靠，描边 path 需落成实体黑才能栅格化。
      clone.querySelectorAll("path").forEach((p) => {
        if (p.getAttribute("fill") === "none") {
          p.setAttribute("stroke", "#000");
        }
      });
      const src = new XMLSerializer().serializeToString(clone);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("render failed: " + name));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;
      let hash = 0;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8) ink++;
        hash = (hash * 31 + data[i]) % 1000000007;
      }
      out[name] = { hash, coverage: ink / (24 * 24) };
    }
    return out;
  });

  const entries = Object.entries(signatures);
  expect(entries.length).toBe(8);
  // 每个图标都要真的画出了东西
  for (const [name, sig] of entries) {
    expect(sig.coverage, `${name} 全空`).toBeGreaterThan(0.02);
  }
  // 类型图标不允许退化成同色块：像素签名必须互不相同
  const hashes = new Set(entries.map(([, s]) => s.hash));
  expect(hashes.size).toBe(8);
});

test("导出二级菜单 Word/ZIP/.mdpkg 三项图标互不相同", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await page.locator('[data-menu-item="export"]').click();
  const submenu = page.locator('[data-testid="pane-export-submenu"]');
  await expect(submenu).toBeVisible();

  const trio = ["exportWord", "exportZip", "exportMdpkg"];
  const icons = await submenu
    .locator("[data-export-item] svg[data-icon]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-icon")));
  const present = trio.filter((n) => icons.includes(n));
  expect(present.sort()).toEqual([...trio].sort());
  expect(new Set(present).size).toBe(3);
  expect(icons).not.toContain("file");
  expect(icons).not.toContain("folder");
  expect(icons).not.toContain("markdown");
});

test("字幕与快捷键说明的图标形状不同", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.locator('[data-testid="icon-drawer"]')).toBeVisible();
  const paths = await page.evaluate(() => {
    const get = (n: string) =>
      document
        .querySelector(`[data-testid="icon-drawer"] svg[data-icon="${n}"] path`)
        ?.getAttribute("d");
    return { subtitle: get("subtitle"), keyboardHints: get("keyboardHints") };
  });
  expect(paths.subtitle).toBeTruthy();
  expect(paths.keyboardHints).toBeTruthy();
  expect(paths.subtitle).not.toBe(paths.keyboardHints);
});

test("状态栏沉浸入口为 immersive 纯图标，顶栏不再含该入口", async ({
  page,
}) => {
  await openDoc(page, "/tmp/ic/a.md");
  const bar = page.getByTestId("status-bar");
  const entry = bar.locator('[data-testid="immersive-entry"]');
  await expect(entry.locator('svg[data-icon="immersive"]')).toHaveCount(1);
  await expect(entry).toHaveAccessibleName(/沉浸阅读/);
  await expect(entry).toHaveAttribute("title", /沉浸阅读/);
  await expect(
    page.getByRole("banner").locator('[data-testid="immersive-entry"]'),
  ).toHaveCount(0);
});

test("钉住后 pin 按钮切换为 pinOff，取消后回 pin", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => { setRailDensity: (d: string) => void };
      };
    };
    w.__biaoyue_store__.getState().setRailDensity("compact");
  });
  await page.hover('[data-testid="rail-edge"]');
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();

  const itemPin = page.locator('[data-testid="rail-item-pin"]').first();
  await expect(itemPin.locator('svg[data-icon="pin"]')).toHaveCount(1);
  await itemPin.click();
  await expect(itemPin.locator('svg[data-icon="pinOff"]')).toHaveCount(1);
  await expect(itemPin.locator('svg[data-icon="pin"]')).toHaveCount(0);
  await itemPin.click();
  await expect(itemPin.locator('svg[data-icon="pin"]')).toHaveCount(1);
  await expect(itemPin.locator('svg[data-icon="pinOff"]')).toHaveCount(0);
});

test("图钉造型：pin 与 pinOff 形状不同、斜杠只覆盖图钉本体（#366）", async ({
  page,
}) => {
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  const iconPaths = await page.evaluate(async () => {
    const mod = await import("/src/ui/icons.ts");
    const icons = (mod as unknown as { ICONS: Record<string, { s?: string }> })
      .ICONS;
    return { pin: icons.pin?.s ?? "", pinOff: icons.pinOff?.s ?? "" };
  });
  expect(iconPaths.pin).not.toBe(iconPaths.pinOff);
  expect(iconPaths.pinOff).not.toContain("M5 19L19 5");
  expect(iconPaths.pinOff).toContain("M7.4 16.6L16.6 7.4");
});

test("主题亮色图标 6 条等角光线，入口无三角", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  const entry = page.locator('[data-testid="theme-entry"]');
  await entry.click();
  await expect(entry.locator('svg[data-icon="sunBright"]')).toHaveCount(1);

  const angles = await entry.locator("svg").evaluate((svg) => {
    const d = svg.querySelector("path")?.getAttribute("d") ?? "";
    const out: number[] = [];
    for (const m of d.matchAll(
      /M([\d.]+) ([\d.]+)(?:v(-?[\d.]+)|l(-?[\d.]+) (-?[\d.]+))/g,
    )) {
      const dx = m[4] ? Number(m[4]) : 0;
      const dy = m[5] ? Number(m[5]) : Number(m[3]);
      out.push(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
    }
    return out.sort((a, b) => a - b);
  });
  expect(angles).toHaveLength(6);
  for (let i = 0; i < angles.length; i += 1) {
    const next =
      angles[(i + 1) % angles.length] + (i === angles.length - 1 ? 360 : 0);
    expect(Math.abs(next - angles[i] - 60)).toBeLessThanOrEqual(2);
  }
});

test("自动布局图标是魔法棒，不含四宫格", async ({ page }) => {
  await openDoc(page, "/tmp/ic/a.md");
  const entry = page.locator('[data-testid="auto-layout-entry"]');
  const d = await entry.locator("svg").evaluate((svg) =>
    Array.from(svg.querySelectorAll("path"))
      .map((p) => p.getAttribute("d") ?? "")
      .join(" "),
  );
  expect(d).not.toContain("h6v6");
  expect(d).toContain("M15 4"); // 主星芒
  expect(d).toContain("M20 12"); // 右星芒
  expect(d).toContain("M8 3"); // 上星芒
});

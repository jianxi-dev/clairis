import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1424";
const ART = ".artifacts/1395";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const MD_PATH = "/tmp/e1395/assets/note.md";
const DOCX_PATH = "/tmp/e1395/assets/cv.docx";
const LONG_MD =
  "# 内嵌标题\n\n" + "占位段落，用来把附件内容撑出内部滚动。\n\n".repeat(80);

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(
    ({ mdPath, docxPath, mdContent }) => {
      const win = window as unknown as Record<string, any>;
      const internals = win.__TAURI_INTERNALS__;
      const originalInvoke = internals.invoke;
      internals.invoke = function (cmd: string, args: Record<string, unknown>) {
        if (cmd === "open_file_direct" && args?.path === mdPath) {
          return Promise.resolve({
            content: mdContent,
            path: mdPath,
            file_size: mdContent.length,
          });
        }
        if (cmd === "get_file_info" && args?.path === docxPath) {
          return Promise.resolve({ size: 12345 });
        }
        return originalInvoke.call(this, cmd, args);
      };
    },
    { mdPath: MD_PATH, docxPath: DOCX_PATH, mdContent: LONG_MD },
  );
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(
  page: Page,
  docPath: string,
  doc: string,
): Promise<void> {
  await page.evaluate(
    ({ docPath, doc }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(docPath, doc, docPath);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { docPath, doc },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function activeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const st = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    const tab = st.tabs[st.activeTabId];
    return tab?.content ?? "";
  });
}

/** 断言通过后截图，并把该态记进 state-coverage.json（QG-5 manifest）。 */
function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function frameMetrics(page: Page): Promise<{
  frameW: number;
  frameH: number;
  bodyScrollable: boolean;
  maskImage: string;
}> {
  return page.evaluate(() => {
    const widget = document.querySelector<HTMLElement>(
      '.cm-embed-widget[data-embed-kind="md"]',
    )!;
    const frame = widget.querySelector<HTMLElement>(".cm-embed-frame")!;
    const body = widget.querySelector<HTMLElement>(".cm-embed-body")!;
    const style = getComputedStyle(body);
    return {
      frameW: frame.getBoundingClientRect().width,
      frameH: frame.getBoundingClientRect().height,
      bodyScrollable: body.scrollHeight > body.clientHeight,
      maskImage: style.maskImage || style.webkitMaskImage || "none",
    };
  });
}

test("md 默认展开：渲染真实内容、宽度与正文文本块同宽", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/e1395/width.md",
    "正文段落，用来量出正文文本块的宽度。\n\n" + `![note](${MD_PATH})\n`,
  );

  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toHaveCount(1);
  await expect(widget.locator(".cm-embed-md h1")).toHaveText("内嵌标题");
  await expect(widget).toHaveAttribute("data-embed-state", "embed");

  const widths = await page.evaluate(() => {
    const line = Array.from(
      document.querySelectorAll<HTMLElement>(".cm-line"),
    ).find((el) => !el.querySelector(".cm-embed-widget"));
    const frame = document.querySelector<HTMLElement>(
      '.cm-embed-widget[data-embed-kind="md"] .cm-embed-frame',
    )!;
    return {
      lineW: line?.getBoundingClientRect().width ?? 0,
      frameW: frame.getBoundingClientRect().width,
    };
  });
  expect(Math.abs(widths.lineW - widths.frameW)).toBeLessThanOrEqual(2);
  await shot(page, "01-md-expanded-width-parity", "md-expanded-width-parity");
});

test("md 高度上限 600 且超出内部滚动 + 底缘渐隐", async ({ page }) => {
  await openDoc(page, "/tmp/e1395/long.md", `![note](${MD_PATH})\n`);

  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md h1")).toHaveText("内嵌标题");
  await expect
    .poll(async () => (await frameMetrics(page)).frameH)
    .toBeLessThanOrEqual(600);

  const metrics = await frameMetrics(page);
  expect(metrics.bodyScrollable).toBe(true);
  expect(metrics.maskImage).not.toBe("none");
  await expect(widget).toHaveAttribute("data-clamped", "true");
  await shot(page, "02-md-max-height-scroll-fade", "md-max-height-scroll-fade");
});

test("前导空格不退化：无空格 / 2 空格 / 4 空格都保持内嵌或卡片", async ({
  page,
}) => {
  const cases = [
    ["none", `![note](${MD_PATH})\n`, "embed"],
    ["sp2", `  ![note](${MD_PATH})\n`, "embed"],
    ["sp4", `    ![note](${MD_PATH})\n`, "embed"],
    ["tab", `\t![note](${MD_PATH})\n`, "embed"],
    ["docx-none", "![cv](assets/cv.docx)\n", "card"],
    ["docx-sp2", "  ![cv](assets/cv.docx)\n", "card"],
    ["docx-sp4", "    ![cv](assets/cv.docx)\n", "card"],
  ];

  for (const [name, doc, kind] of cases) {
    await openDoc(page, `/tmp/e1395/space-${name}.md`, doc);
    const probe = () =>
      page.evaluate(() => {
        const st = (
          window as unknown as Record<string, any>
        ).__biaoyue_store__.getState();
        const sourceText =
          document.querySelector(".cm-line")?.textContent ?? "";
        return {
          content: st.tabs[st.activeTabId]?.content ?? "",
          embed: document.querySelectorAll(".cm-embed-widget").length,
          card: document.querySelectorAll(
            '.cm-media-widget[data-media-kind="file"]',
          ).length,
          sourceText,
          degraded: sourceText.includes("!["),
        };
      });
    await expect
      .poll(async () => await probe(), {
        message: `${name} 应渲染为${kind === "embed" ? "内嵌" : "卡片"}`,
      })
      .toMatchObject({
        content: doc,
        embed: kind === "embed" ? 1 : 0,
        card: kind === "card" ? 1 : 0,
        degraded: false,
      });
    const counts = await probe();
    if (kind === "embed") {
      expect(counts.embed, `${name} 应内嵌`).toBe(1);
    } else {
      expect(counts.card, `${name} 应为卡片`).toBe(1);
    }
    expect(counts.sourceText, `${name} 不应出现源码`).not.toContain("![");
  }
});

test("选中 md 打开样式面板：对齐可调 + 三态切换，取消后无残留", async ({
  page,
}) => {
  await openDoc(page, "/tmp/e1395/panel-md.md", `![note](${MD_PATH})\n`);
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md h1")).toHaveText("内嵌标题");

  await widget.click();
  const panel = page.locator('[data-testid="embed-panel"]');
  await expect(panel).toBeVisible();
  await expect(widget).toHaveAttribute("data-selected", "true");
  await expect(
    page.locator('[data-testid="embed-panel-align-center"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-testid="embed-panel-state-embed"]'),
  ).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-testid="embed-panel-align-right"]').click();
  await expect(widget).toHaveAttribute("data-align", "right");
  await expect.poll(() => activeContent(page)).toContain("align=right");

  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await expect
    .poll(async () =>
      widget
        .locator(".cm-embed-body")
        .evaluate((el) => getComputedStyle(el).display),
    )
    .toBe("none");

  await page.locator('[data-testid="pane-header"]').click();
  await expect(page.locator('[data-testid="embed-panel"]')).toHaveCount(0);
  await expect(widget).toHaveAttribute("data-selected", "false");
  await expect(widget.locator(".cm-image-handle")).toHaveCount(0);
  await shot(
    page,
    "03-embed-style-panel-no-residue",
    "embed-style-panel-no-residue",
  );
});

test("选中 docx 卡片打开样式面板：对齐可调，取消后无残留", async ({
  page,
}) => {
  await openDoc(page, "/tmp/e1395/panel-docx.md", "![cv](assets/cv.docx)\n");
  const card = page.locator('.cm-media-widget[data-media-kind="file"]');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-align", "left");

  await card.click();
  const panel = page.locator('[data-testid="embed-panel"]');
  await expect(panel).toBeVisible();
  await expect(card).toHaveAttribute("data-selected", "true");
  await expect(card.locator(".cm-image-handle")).toHaveCount(0);

  await page.locator('[data-testid="embed-panel-align-right"]').click();
  await expect(card).toHaveAttribute("data-align", "right");
  await expect.poll(() => activeContent(page)).toContain("align=right");
  await shot(page, "04-docx-card-panel", "docx-card-panel");

  await page.locator('[data-testid="pane-header"]').click();
  await expect(page.locator('[data-testid="embed-panel"]')).toHaveCount(0);
  await expect(card).toHaveAttribute("data-selected", "false");
});

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HEADING_FONT_STACK } from "../src/lib/headingFonts";

/**
 * 标题字体应用渲染（#854 / C1）。
 *
 * #853 已落配置字段 + 设置 UI + 持久化；本票只验「编辑态 / 预览态 h1–h6 的
 * 计算 font-family 是否等于 heading_fonts 配置」，以及正文 / 代码字体不变。
 *
 * 断言一律读计算样式（QG-4）：元素存在不等于字体已应用。
 */

const ART = path.resolve(process.cwd(), ".artifacts/854");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** 浏览器归一化：去引号、去空白、小写后按逗号连接，消除顺序 / 引号差异。 */
function norm(value: string): string {
  return value
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .toLowerCase(),
    )
    .filter((part) => part.length > 0)
    .join(",");
}

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

async function boot(
  page: Page,
  stored?: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (stored) {
    await page.addInitScript((cfg) => {
      try {
        localStorage.setItem("__config__", JSON.stringify(cfg));
      } catch {
        /* localStorage 不可用时按缺省处理 */
      }
    }, stored);
  }
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke?: (cmd: string, args?: unknown) => unknown;
      };
    };
    const internals = w.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") return;
    const orig = internals.invoke;
    let merged = false;
    internals.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "load_config" && !merged) {
        merged = true;
        const res = (await orig(cmd, args)) as Record<string, unknown>;
        try {
          const raw = localStorage.getItem("__config__");
          if (raw) return { ...res, ...JSON.parse(raw) };
        } catch {
          /* localStorage 不可用时按缺省处理 */
        }
        return res;
      }
      if (cmd === "save_config") {
        const config = (
          args as { config?: Record<string, unknown> } | undefined
        )?.config;
        if (config) {
          try {
            localStorage.setItem("__config__", JSON.stringify(config));
          } catch {
            /* ignore */
          }
        }
      }
      return orig(cmd, args);
    };
  });
  await page.goto("http://localhost:1424", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

const DOC = [
  "# 一级标题",
  "## 二级标题",
  "### 三级标题",
  "#### 四级标题",
  "##### 五级标题",
  "###### 六级标题",
  "",
  "正文段落，`行内代码`，用于确认正文字体不变。",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
].join("\n");

async function openDoc(page: Page, name = "hf854"): Promise<void> {
  await page.evaluate(
    ({ body, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/${name}.md`, body, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body: DOC, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-heading.cm-h1").first().waitFor({ timeout: 10000 });
}

async function setMode(page: Page, mode: "edit" | "preview"): Promise<void> {
  await page.evaluate((m) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().setEditorMode(m);
  }, mode);
}

async function fontFamily(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el as Element).fontFamily);
}

async function cssVar(
  page: Page,
  selector: string,
  name: string,
): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate(
      (el, n) => getComputedStyle(el as Element).getPropertyValue(n),
      name,
    );
}

/**
 * 自定义属性里的 token 串与浏览器计算后的 font-family 序列化不同：Chrome 会把
 * `-apple-system` 展开成 `-apple-system, system-ui` 并丢掉 BlinkMacSystemFont。
 * 把该串挂到真实元素上读计算值，得到与「直接用此栈」同源的归一化结果。
 */
async function resolvedFamily(page: Page, stack: string): Promise<string> {
  return page.evaluate((s) => {
    const el = document.createElement("div");
    el.style.fontFamily = s;
    document.body.appendChild(el);
    const value = getComputedStyle(el).fontFamily;
    el.remove();
    return value;
  }, stack);
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("默认 h1–h6 计算字体等于 --type-font-sans（编辑态与预览态）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page);

  const editorSans = await cssVar(page, ".cm-editor", "--type-font-sans");
  const expectedEditor = await resolvedFamily(page, editorSans);
  for (const level of LEVELS) {
    expect(norm(await fontFamily(page, `.cm-heading.cm-${level}`))).toBe(
      norm(expectedEditor),
    );
  }
  await shot(page, "default-edit-sans", "default-edit-sans");

  await setMode(page, "preview");
  await expect(page.locator(".preview-content h1").first()).toBeVisible();
  const previewSans = await cssVar(
    page,
    ".preview-content",
    "--type-font-sans",
  );
  const expectedPreview = await resolvedFamily(page, previewSans);
  for (const level of LEVELS) {
    expect(norm(await fontFamily(page, `.preview-content ${level}`))).toBe(
      norm(expectedPreview),
    );
  }
  await shot(page, "default-preview-sans", "default-preview-sans");
});

test("改 H1 字体后编辑态与预览态 h1 等于配置值，正文不变", async ({ page }) => {
  await boot(page);
  await openDoc(page);

  const bodyBefore = await fontFamily(
    page,
    ".cm-content > .cm-line:not(:has(.cm-heading))",
  );
  const codeBefore = await fontFamily(page, ".cm-inline-code");
  const codeBlockBefore = await fontFamily(page, ".cm-line.cm-fenced-code");

  await openSettings(page);
  await page.locator('[data-settings-nav="appearance"]').click();
  const h1 = page.locator('[data-testid="heading-font-h1"]');
  await h1.fill("Songti SC");
  await h1.press("Enter");
  await page.keyboard.press("Escape");

  await expect
    .poll(async () => norm(await fontFamily(page, ".cm-heading.cm-h1")))
    .toBe(norm("Songti SC"));
  expect(norm(await fontFamily(page, ".cm-heading.cm-h1"))).toBe(
    norm("Songti SC"),
  );
  // A-20.2：正文与行内代码字体不变
  expect(
    await fontFamily(page, ".cm-content > .cm-line:not(:has(.cm-heading))"),
  ).toBe(bodyBefore);
  expect(await fontFamily(page, ".cm-inline-code")).toBe(codeBefore);
  expect(await fontFamily(page, ".cm-line.cm-fenced-code")).toBe(
    codeBlockBefore,
  );

  await shot(page, "edit-h1-custom", "edit-h1-custom");

  await setMode(page, "preview");
  await expect(page.locator(".preview-content h1").first()).toBeVisible();
  await expect
    .poll(async () => norm(await fontFamily(page, ".preview-content h1")))
    .toBe(norm("Songti SC"));
  // 预览态正文仍走 --type-font-sans
  expect(norm(await fontFamily(page, ".preview-content p"))).toBe(
    norm(
      await resolvedFamily(
        page,
        await cssVar(page, ".preview-content", "--type-font-sans"),
      ),
    ),
  );
  // 预览态代码块仍走 --type-font-mono
  expect(norm(await fontFamily(page, ".preview-content pre"))).toBe(
    norm(
      await resolvedFamily(
        page,
        await cssVar(page, ".preview-content", "--type-font-mono"),
      ),
    ),
  );

  await shot(page, "preview-h1-custom", "preview-h1-custom");
});

test("h2–h6 逐级应用配置，未配置的级别保持默认栈", async ({ page }) => {
  await boot(page, {
    headingFonts: {
      h1: HEADING_FONT_STACK,
      h2: "Menlo",
      h3: "Georgia",
      h4: "Kaiti SC",
      h5: "Heiti SC",
      h6: "Times New Roman",
    },
  });
  await openDoc(page);

  const editorSans = await cssVar(page, ".cm-editor", "--type-font-sans");
  const expected: Record<string, string> = {
    h1: HEADING_FONT_STACK,
    h2: "Menlo",
    h3: "Georgia",
    h4: "Kaiti SC",
    h5: "Heiti SC",
    h6: "Times New Roman",
  };
  const expectedEditorH1 = await resolvedFamily(page, editorSans);
  for (const level of LEVELS) {
    const want = level === "h1" ? expectedEditorH1 : expected[level];
    expect(norm(await fontFamily(page, `.cm-heading.cm-${level}`))).toBe(
      norm(want),
    );
  }
  await shot(page, "levels-custom-edit", "levels-custom-edit");

  await setMode(page, "preview");
  await expect(page.locator(".preview-content h1").first()).toBeVisible();
  const previewSans = await cssVar(
    page,
    ".preview-content",
    "--type-font-sans",
  );
  const expectedPreviewH1 = await resolvedFamily(page, previewSans);
  for (const level of LEVELS) {
    const want = level === "h1" ? expectedPreviewH1 : expected[level];
    expect(norm(await fontFamily(page, `.preview-content ${level}`))).toBe(
      norm(want),
    );
  }
  // 正文不受 h2–h6 配置影响
  expect(norm(await fontFamily(page, ".preview-content p"))).toBe(
    norm(expectedPreviewH1),
  );
  await shot(page, "levels-custom-preview", "levels-custom-preview");
});

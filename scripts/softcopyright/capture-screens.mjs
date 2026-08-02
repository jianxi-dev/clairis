#!/usr/bin/env node
/**
 * 任务 3：测试截图自动采集脚本（软著资料准备）
 *
 * 读取 config.json + screens-config.json，对每个 ready 场景：
 *   1. 启动/复用 dev server（npm run dev，端口 1420，已运行则复用）
 *   2. Playwright chromium（channel: "chrome"）打开应用
 *   3. addInitScript 注入 e2e/mocks/tauri-mock.js + 运行时覆盖层 div（右上角，softwareName + version，
 *      仅注入浏览器运行时 DOM，绝不写回 src/）
 *   4. 驱动到对应界面（openFile 桥 + UI 步骤），截图前断言覆盖层 textContent 含 softwareName + version
 *   5. 截图存档 <scene-id>-<yyyy-mm-dd>.png 至 config.screenshotsDir，输出 JSON 报告（stdout + out/ 留档）
 *
 * pending 场景不导航不截图；场景级失败记录 failed 不中断；退出码恒为 0（除非脚本自身崩溃）。
 *
 * 用法：node scripts/softcopyright/capture-screens.mjs [--config <path>]
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const APP_URL = "http://localhost:1420";
const DEV_PORT = 1420;
const STEP_TIMEOUT = 3000;

// ── 参数解析 ────────────────────────────────────────────────
function parseArgv(argv) {
  const i = argv.indexOf("--config");
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith("--config="));
  if (eq) return eq.slice("--config=".length);
  return null;
}

const configArg = parseArgv(process.argv.slice(2));
const configPath = configArg
  ? (path.isAbsolute(configArg) ? configArg : path.resolve(process.cwd(), configArg))
  : path.join(__dirname, "config.json");

// ── 工具函数 ────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isReachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** 启动 dev server（已运行则复用）；返回 { reused, started, kill } */
async function ensureDevServer(port) {
  const url = `http://localhost:${port}`;
  if (await isReachable(url)) {
    return { reused: true, started: false, kill: () => {} };
  }
  const child = spawn("npm", ["run", "dev"], { cwd: REPO_ROOT, detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await isReachable(url)) {
      return {
        reused: false,
        started: true,
        kill: () => {
          try {
            process.kill(-child.pid); // 杀进程组（npm → vite）
          } catch {
            /* 已退出则忽略 */
          }
        },
      };
    }
    if (child.exitCode !== null) break; // npm 进程已退出 = 启动失败
  }
  throw new Error(`dev server 启动失败：${url} 在 30s 内不可达`);
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 覆盖层注入脚本（addInitScript 注入，仅运行时 DOM；每次文档加载执行） */
function injectOverlay({ softwareName, version }) {
  function apply() {
    if (document.getElementById("__softcopyright_overlay__")) return;
    const div = document.createElement("div");
    div.id = "__softcopyright_overlay__";
    div.setAttribute("data-testid", "softcopyright-overlay");
    div.style.cssText =
      "position:fixed;top:14px;right:18px;z-index:2147483647;" +
      "background:rgba(15,23,42,.78);color:#f8fafc;" +
      "font:500 12px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;" +
      "padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);" +
      "letter-spacing:.4px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.3);" +
      "white-space:nowrap;";
    div.textContent = softwareName + " " + version;
    document.body.appendChild(div);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
}

// ── UI 步骤驱动 ─────────────────────────────────────────────
async function runStep(page, step) {
  switch (step.op) {
    case "click": {
      let root = page;
      if (step.scope) root = page.locator(step.scope);
      let loc;
      if (step.role) loc = root.getByRole(step.role, { name: step.name, exact: !!step.exact });
      else if (step.text) loc = root.getByText(step.text).first();
      else if (step.selector) loc = root.locator(step.selector).first();
      else throw new Error(`click 步骤缺少定位信息（role/text/selector）: ${JSON.stringify(step)}`);
      await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      await loc.click();
      return;
    }
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "fill": {
      const loc = page.locator(step.selector).first();
      await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      await loc.fill(step.value ?? "");
      return;
    }
    case "wait":
      await page.waitForTimeout(step.ms ?? 300);
      return;
    case "expectText":
      // 模式切换为 CSS display（不 remount），隐藏模式的 DOM 仍在：
      // 用 visible=true 引擎过滤，只匹配当前可见模式的文本
      await page
        .locator(`text=${step.value} >> visible=true`)
        .first()
        .waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      return;
    case "expectSelector":
      await page.locator(step.selector).first().waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      return;
    default:
      throw new Error(`未知步骤 op: ${step.op}`);
  }
}

// ── 单场景执行 ──────────────────────────────────────────────
async function runScene(context, config, scene, screenshotsDir, date) {
  if (scene.status !== "ready") {
    return {
      id: scene.id,
      name: scene.name,
      domain: scene.domain,
      status: "pending",
      screenshot: null,
      overlay: null,
      error: null,
    };
  }

  let page = null;
  try {
    page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("header", { timeout: 10000 });

    const action = scene.action ?? { type: "none" };
    if (action.type === "openFile") {
      const ok = await page.evaluate((a) => {
        const w = window;
        if (typeof w.__clairis_openFile__ !== "function") return false;
        return w.__clairis_openFile__(a.path, a.content, a.title);
      }, action);
      if (!ok) throw new Error("openFile 桥不可用（__clairis_openFile__ 未注入或返回 false）");
      await page.waitForTimeout(400);
    }

    for (const step of scene.steps ?? []) {
      await runStep(page, step);
    }

    // 截图前断言覆盖层 textContent（Playwright 读 DOM 断言，PNG 仅作存证）
    const overlayEl = page.locator("#__softcopyright_overlay__");
    await overlayEl.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    const actual = (await overlayEl.textContent()) ?? "";
    const expected = `${config.softwareName} ${config.version}`;
    const asserted = actual.includes(config.softwareName) && actual.includes(config.version);
    if (!asserted) {
      throw new Error(`覆盖层断言失败：期望 textContent 含 "${expected}"，实际 "${actual}"`);
    }

    const filePath = path.join(screenshotsDir, `${scene.id}-${date}.png`);
    await page.screenshot({ path: filePath });
    return {
      id: scene.id,
      name: scene.name,
      domain: scene.domain,
      status: "success",
      screenshot: filePath,
      overlay: { expected, actual, asserted },
      error: null,
    };
  } catch (err) {
    return {
      id: scene.id,
      name: scene.name,
      domain: scene.domain,
      status: "failed",
      screenshot: null,
      overlay: null,
      error: err?.message ?? String(err),
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ── 主流程 ──────────────────────────────────────────────────
async function main() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const scenesFile = path.resolve(REPO_ROOT, config.scenesFile);
  const scenes = JSON.parse(fs.readFileSync(scenesFile, "utf8")).scenes;
  const screenshotsDir = path.resolve(REPO_ROOT, config.screenshotsDir);
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    softwareName: config.softwareName,
    version: config.version,
    screenshotsDir,
    devServer: "none",
    scenes: [],
    summary: null,
  };

  const devServer = await ensureDevServer(DEV_PORT);
  report.devServer = devServer.reused ? "reused" : "started";

  let browser = null;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    // mock 桥 + 覆盖层：均在页面任何代码之前注入
    const mockJs = fs.readFileSync(path.join(REPO_ROOT, "e2e/mocks/tauri-mock.js"), "utf8");
    await context.addInitScript({ content: mockJs });
    await context.addInitScript(injectOverlay, {
      softwareName: config.softwareName,
      version: config.version,
    });

    const date = localDateStr();
    for (const scene of scenes) {
      report.scenes.push(await runScene(context, config, scene, screenshotsDir, date));
    }
    await browser.close();
    browser = null;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (devServer.started) devServer.kill();
  }

  const total = report.scenes.length;
  const byStatus = report.scenes.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  report.summary = { total, success: byStatus.success ?? 0, failed: byStatus.failed ?? 0, pending: byStatus.pending ?? 0 };

  const json = JSON.stringify(report, null, 2);
  console.log(json);

  // 留档（out/ 已 gitignore，不入库）
  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `screens-report-${localDateStr()}.json`), json);
}

main().catch((err) => {
  console.error(`[capture-screens] 致命错误：${err?.message ?? err}`);
  process.exit(1);
});

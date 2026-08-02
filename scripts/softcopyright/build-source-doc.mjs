#!/usr/bin/env node
/**
 * 任务 5：源代码文档 PDF 生成（软著资料准备）
 *
 * 读取 config.json（软件名/版本/每页行数/部分提交阈值/前尾页数/coreFiles 等），
 * 按以下流程生成源代码文档：
 *   1. collectFiles 收集源码文件（复用 lib/collect.mjs：sourceRoots + includeExts + excludeGlobs）
 *   2. 排序：入口文件（entryFiles）→ config.coreFiles → 其余按相对路径字典序
 *   3. 逐文件剔除空行（trim() === ""），非空行构成连续流，每个文件前插入文件头行
 *   4. 分页：每页 linesPerPage 个非空行；
 *      总非空行 ≥ minLinesForPartial 且页数 > frontPages+backPages 时取前 frontPages 页 + 后 backPages 页
 *      （部分提交），否则全量提交
 *   5. renderHtml 生成自包含 HTML（页眉含软件全称 + 版本号，右上角页码），
 *      Playwright chromium（channel: "chrome"，系统 Chrome）打印为 PDF
 *   6. 校验：PDF 页数必须等于分页器页数（防行高溢出导致换页错位）；
 *      分页结构断言（首页/中间页满行、无空行页，末页 < linesPerPage 豁免）；
 *      去空行后总行数 < linesPerPage → 直接失败（exit 非零）
 *   7. 输出 out/source-doc.pdf + out/source-doc-meta.json（stdout 打印摘要，exit 0）
 *
 * 用法：node scripts/softcopyright/build-source-doc.mjs [--config <path>] [--out <dir>]
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectFiles } from "./lib/collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

// ── 参数解析（与 capture-screens.mjs 同风格） ─────────────────
function parseArgv(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    if (i !== -1 && argv[i + 1]) return argv[i + 1];
    const eq = argv.find((a) => a.startsWith(`${flag}=`));
    return eq ? eq.slice(flag.length + 1) : null;
  };
  return { config: get("--config"), out: get("--out") };
}

// ── 纯函数（供测试复用） ──────────────────────────────────────

/**
 * 归一化相对路径：转正斜杠，去掉首尾 "./"。
 * @param {string} relPath
 * @returns {string}
 */
export function normalizeRelPath(relPath) {
  return relPath.split(path.sep).join("/").replace(/^\.\//, "");
}

/**
 * 文件排序：entryFiles（保持配置顺序）→ coreFiles（保持配置顺序）→ 其余字典序。
 * entryFiles / coreFiles 与 collected relPath 按归一化相对路径匹配。
 * @param {string[]} relPaths
 * @param {{ entryFiles?: string[], coreFiles?: string[] }} config
 * @returns {string[]} 排序后的 relPath 数组
 */
export function sortFilesForDoc(relPaths, config = {}) {
  const entries = (config.entryFiles || []).map(normalizeRelPath);
  const cores = (config.coreFiles || []).map(normalizeRelPath);
  const inList = (set) => (p) => set.has(p);
  const entrySet = new Set(entries.filter((p) => relPaths.includes(p)));
  const coreSet = new Set(cores.filter((p) => relPaths.includes(p) && !entrySet.has(p)));
  const rest = relPaths.filter((p) => !entrySet.has(p) && !coreSet.has(p)).sort();
  const entryList = entries.filter((p) => entrySet.has(p));
  const coreList = cores.filter((p) => coreSet.has(p));
  return [...entryList, ...coreList, ...rest];
}

/**
 * 逐文件剔除空行，拼接成"文件头 + 非空行"流。
 * 文件头格式：`===== 相对路径（x 行 / y 空行） =====`，本身计入页行数。
 * @param {string[]} relPaths 已排序的 relPath 数组
 * @param {(rel: string) => string} readContent 读取文件内容（不 trim 尾部）
 * @returns {string[]} 行数组（全部为非空行）
 */
export function buildDocLines(relPaths, readContent) {
  const out = [];
  for (const rel of relPaths) {
    const raw = readContent(rel);
    const lines = raw.split("\n");
    const nonEmpty = lines.filter((l) => l.trim() !== "");
    out.push(`===== ${rel}（${nonEmpty.length} 行 / ${lines.length - nonEmpty.length} 空行） =====`);
    out.push(...nonEmpty);
  }
  return out;
}

/**
 * 分页：每页最多 linesPerPage 行。
 * total ≥ minLinesForPartial 时取 [0, front*pp) + [total - back*pp, total)（前尾页不重叠）；
 * 否则全量。
 * @param {string[]} lines
 * @param {{ linesPerPage?: number, minLinesForPartial?: number, frontPages?: number, backPages?: number }} config
 * @returns {{ pages: string[][], mode: "full"|"partial", total: number, front: number, back: number }}
 */
export function paginate(lines, config = {}) {
  const pp = config.linesPerPage ?? 50;
  const minPartial = config.minLinesForPartial ?? 3000;
  const frontPages = config.frontPages ?? 30;
  const backPages = config.backPages ?? 30;
  const total = lines.length;
  const nPages = Math.ceil(total / pp);
  const pages = [];
  for (let i = 0; i < nPages; i++) pages.push(lines.slice(i * pp, (i + 1) * pp));

  let front = nPages;
  let back = 0;
  let mode = "full";
  if (total >= minPartial && nPages > frontPages + backPages) {
    mode = "partial";
    front = frontPages;
    back = backPages;
    const sel = [...pages.slice(0, front), ...pages.slice(nPages - back)];
    pages.splice(0, pages.length, ...sel);
  }
  return { pages, mode, total, front, back };
}

/**
 * 页完整性校验：首页与所有中间页必须恰好 linesPerPage 行，
 * 只有末页允许少于 linesPerPage（部分提交时首尾段各自独立校验：前段末页=front*pp 行，
 * 后段末页可能 < pp）。
 * 任一页行数异常（=0 或 > linesPerPage，或中间页 < linesPerPage）→ 抛错。
 * @param {string[][]} pages
 * @param {{ linesPerPage?: number, mode?: string }} config
 * @returns {number[]} 每页行数
 */
export function validatePages(pages, config = {}) {
  const pp = config.linesPerPage ?? 50;
  const counts = pages.map((p) => p.length);
  const bad = counts.map((c, i) => ({ c, i })).find(({ c, i }) => {
    if (c === 0) return true;
    if (c > pp) return true;
    return c < pp && i !== counts.length - 1; // 中间页必须满行
  });
  if (bad) {
    throw new Error(
      `分页异常：第 ${bad.i + 1} 页行数 ${bad.c}，期望 =${pp}（末页除外）`
    );
  }
  return counts;
}

/**
 * 最小行数校验：部分提交必有 ≥2 页（前段 30 页各 50 行），全量提交单页 < linesPerPage 视为失败
 * （2026 规范每页 ≥50 行，去空行后不足 50 行不能成册）。
 * @param {{ total: number, mode: string, linesPerPage: number }} opts
 * @returns {void}
 */
export function assertMinLines({ total, mode, linesPerPage }) {
  if (mode === "full" && total < linesPerPage) {
    throw new Error(
      `去空行后共 ${total} 行，低于每页 ${linesPerPage} 行，无法成册（软著规范每页 ≥${linesPerPage} 行）`
    );
  }
}

/**
 * Copyright (c) 检测：含该标记但未含软件全名的行记入警告（不中断）。
 * @param {string[]} lines
 * @param {string} softwareName
 * @returns {string[]}
 */
export function detectCopyrightWarnings(lines, softwareName) {
  const warns = [];
  lines.forEach((l, i) => {
    if (/Copyright\s*\(c\)/i.test(l) && !l.includes(softwareName)) {
      warns.push(`第 ${i + 1} 行（${l.trim().slice(0, 80)}…）`);
    }
  });
  return warns;
}

/**
 * 渲染自包含 HTML：每页一个 <section class="page">，首行页眉
 * （软件全称 + 版本号 + 页码），其后为 linesPerPage 行源码。
 * @param {string[][]} pages
 * @param {{ softwareName: string, version: string, mode: string }} config
 * @returns {string}
 */
export function renderHtml(pages, config = {}) {
  const { softwareName, version, mode } = config;
  const perPage = pages.length;
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const body = pages
    .map((lines, idx) => {
      const pageNo = idx + 1;
      const content = lines.map((l) => esc(l)).join("\n");
      const pageLabel =
        mode === "partial" && pageNo === 1
          ? `${softwareName} ${version} 源代码（部分提交：前${perPage}页含入口/核心文件）`
          : `${softwareName} ${version} 源代码文档`;
      return `<section class="page" data-page="${pageNo}">
  <header class="page-header"><span class="left">${esc(pageLabel)}</span><span class="right">第 ${pageNo} / ${perPage} 页</span></header>
  <pre class="code">${content}</pre>
</section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(softwareName)} ${esc(version)} 源代码文档</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  .page {
    break-after: page;
    page-break-after: always;
    padding: 0 0 8mm;
    font-family: "SF Mono", Menlo, Consolas, "Courier New", monospace;
    font-size: 9.5px;
    line-height: 1.45;
  }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 0 0 3px;
    margin-bottom: 6px;
    border-bottom: 0.5pt solid #999;
    font-size: 10px;
    color: #111;
  }
  .page-header .left { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .page-header .right { white-space: nowrap; font-weight: 600; }
  .code {
    white-space: pre-wrap;
    word-break: break-all;
    font: inherit;
    color: #000;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * 解析 PDF 页数（latin1 二进制安全，不依赖 pdftotext）。
 * Chromium 生成平衡页树：叶节点 /Type /Page + 内部节点 /Type /Pages 均含子串 "/Type /Page"，
 * 故用负向先行断言排除 /Type /Pages，只数叶节点。
 * @param {Buffer} pdfBuffer
 * @returns {number}
 */
export function countPdfPages(pdfBuffer) {
  const m = pdfBuffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : 0;
}

/**
 * 启动 Chromium（channel: "chrome"；缺失则降级 npx playwright install chromium 后重试）。
 * @returns {Promise<import("@playwright/test").Browser>}
 */
async function launchChrome() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("Executable doesn't exist") || msg.includes("channel 'chrome'")) {
      console.warn("[warn] 系统 Chrome 未找到，降级安装 chromium…");
      execSync("npx playwright install chromium", { stdio: "inherit" });
      return chromium.launch();
    }
    throw err;
  }
}

/**
 * 渲染 HTML → Playwright 打印 PDF → 落盘 pdf/html + meta.json，返回摘要。
 * @param {{ pages: string[][], mode: string, total: number, front: number, back: number }} paginated
 * @param {object} config 完整配置
 * @param {{ outDir: string, firstFile: string, lastFile: string, files: string[], copyrightWarnings: string[] }} opts
 * @returns {Promise<{ pdfPath: string, pdfBytes: number, pdfPages: number, expectedPages: number }>}
 */
export async function renderPdf(paginated, config, opts) {
  const perPage = paginated.pages.length;
  const html = renderHtml(paginated.pages, {
    softwareName: config.softwareName,
    version: config.version,
    mode: paginated.mode,
  });
  const htmlPath = path.join(opts.outDir, "source-doc.html");
  const pdfPath = path.join(opts.outDir, "source-doc.pdf");
  await fs.promises.mkdir(opts.outDir, { recursive: true });
  await fs.promises.writeFile(htmlPath, html, "utf8");

  const browser = await launchChrome();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "10mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: "<span></span>",
    });
    const pdfPages = countPdfPages(pdfBuffer);
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    // 页数一致性校验：PDF 页数必须等于分页器页数，否则说明行高溢出换行导致页偏移
    if (pdfPages !== perPage) {
      throw new Error(
        `PDF 页数(${pdfPages}) ≠ 分页页数(${perPage})：行高溢出导致换页错位，请调小字号/行高`
      );
    }

    const meta = {
      softwareName: config.softwareName,
      version: config.version,
      mode: paginated.mode,
      totalNonEmptyLines: paginated.total,
      totalFiles: opts.files.length,
      linesPerPage: config.linesPerPage,
      minLinesForPartial: config.minLinesForPartial,
      frontPages: paginated.front,
      backPages: paginated.back,
      expectedPages: perPage,
      pdfPages,
      firstFile: opts.firstFile,
      lastFile: opts.lastFile,
      files: opts.files,
      pdfPath: path.relative(process.cwd(), pdfPath),
      htmlPath: path.relative(process.cwd(), htmlPath),
      pdfBytes: pdfBuffer.length,
      copyrightWarnings: opts.copyrightWarnings,
    };
    const metaPath = path.join(opts.outDir, "source-doc-meta.json");
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
    return { pdfPath, pdfBytes: pdfBuffer.length, pdfPages, expectedPages: perPage };
  } finally {
    await browser.close();
  }
}

/**
 * 主构建入口（测试可直接调用）。
 * @param {string} configPath 配置文件绝对路径
 * @param {{ outDir?: string }} [opts]
 * @returns {Promise<object>} 摘要对象
 */
export async function buildSourceDoc(configPath, { outDir } = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const baseDir = config.baseDir ? path.resolve(__dirname, config.baseDir) : REPO_ROOT;
  const out = outDir ? path.resolve(outDir) : path.join(__dirname, "out");

  const collected = await collectFiles({
    sourceRoots: config.sourceRoots,
    includeExts: config.includeExts,
    excludeGlobs: config.excludeGlobs,
    entryFiles: config.entryFiles || [],
    baseDir,
  });
  const relPaths = sortFilesForDoc(collected.map((f) => f.relPath), config);

  const readContent = (rel) => fs.readFileSync(path.join(baseDir, rel), "utf8");
  const lines = buildDocLines(relPaths, readContent);
  const paginated = paginate(lines, config);
  validatePages(paginated.pages, config);
  assertMinLines({
    total: paginated.total,
    mode: paginated.mode,
    linesPerPage: config.linesPerPage ?? 50,
  });

  const firstFile = relPaths[0];
  const lastFile = relPaths[relPaths.length - 1];
  const copyrightWarnings = detectCopyrightWarnings(lines, config.softwareName);
  for (const w of copyrightWarnings) {
    console.warn(`[warn] Copyright (c) 行不含软件名「${config.softwareName}」：${w}`);
  }

  const result = await renderPdf(paginated, config, {
    outDir: out,
    firstFile,
    lastFile,
    files: relPaths,
    copyrightWarnings,
  });

  const summary = {
    mode: paginated.mode,
    totalFiles: relPaths.length,
    totalNonEmptyLines: paginated.total,
    expectedPages: result.expectedPages,
    pdfPages: result.pdfPages,
    pdfPath: result.pdfPath,
    pdfBytes: result.pdfBytes,
    firstFile,
    lastFile,
    copyrightWarnings: copyrightWarnings.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// ── CLI 入口（仅直接执行时运行，import 不触发） ──────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config: configArg, out: outArg } = parseArgv(process.argv.slice(2));
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(__dirname, "config.json");
  buildSourceDoc(configPath, { outDir: outArg })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[error] ${err && err.message ? err.message : err}`);
      process.exit(1);
    });
}

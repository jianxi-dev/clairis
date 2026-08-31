#!/usr/bin/env node
// 有效代码行数统计与页数判定工具（软著资料准备 · 任务 2）。
// 统计 sourceRoots 下白名单扩展名的文件：总行数、非空行数、注释行数与占比；
// 按 minLinesForPartial 判定全量 / 部分（前 30 页 + 后 30 页）；注释占比超 1/3 时向 stderr 告警。
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.join(__dirname, "config.json");

// 注释行判定前缀（按扩展名）。规则：去空白后以任一前缀开头即注释行；
// 多行块注释（/* ... */）跨行的每一行都计入注释行（以 /* 或 * 开头的行）。
const COMMENT_PREFIXES = {
  ts: ["//", "/*", "*"],
  tsx: ["//", "/*", "*"],
  rs: ["//", "/*", "*"],
  mjs: ["//", "/*", "*", "#"],
  mts: ["//", "/*", "*", "#"],
  css: ["/*", "*"],
};

function isCommentLine(trimmed, ext) {
  const prefixes = COMMENT_PREFIXES[ext];
  if (!prefixes) return false;
  return prefixes.some((p) => trimmed.startsWith(p));
}

/** 统计单文件：行数、非空行数、注释行数。 */
export function countFile(content, ext) {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  let totalLines = 0;
  let nonEmptyLines = 0;
  let commentLines = 0;
  for (const raw of lines) {
    totalLines += 1;
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    nonEmptyLines += 1;
    if (isCommentLine(trimmed, ext)) commentLines += 1;
  }
  return { totalLines, nonEmptyLines, commentLines };
}

function parseArgs(argv) {
  const args = { root: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root") {
      args.root = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

/**
 * 执行统计（供 CLI 与测试复用）。
 * @param {object} opts
 * @param {string} [opts.configPath] config.json 路径（默认脚本旁）
 * @param {string} [opts.root] 覆盖 sourceRoots 的单一源目录（相对 baseDir）
 * @param {string} [opts.baseDir] 基准目录（默认 process.cwd()）
 * @param {object} [opts.io] 注入 { warn } 用于测试捕获 WARN（默认 console.error）
 * @returns {Promise<object>} 统计结果对象
 */
export async function runCount({ configPath = DEFAULT_CONFIG_PATH, root = null, baseDir = process.cwd(), io = null } = {}) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const warn = io && io.warn ? io.warn : (msg) => console.error(msg);

  const sourceRoots = root ? [root] : config.sourceRoots;
  const files = await collectFiles({
    sourceRoots,
    includeExts: config.includeExts,
    excludeGlobs: config.excludeGlobs,
    entryFiles: config.entryFiles,
    baseDir,
  });

  const perFile = [];
  let totalLines = 0;
  let totalNonEmptyLines = 0;
  let totalCommentLines = 0;

  for (const f of files) {
    const content = await readFile(f.absPath, "utf8");
    const ext = path.extname(f.absPath).slice(1).toLowerCase();
    const stat = countFile(content, ext);
    const ratio = stat.nonEmptyLines > 0 ? stat.commentLines / stat.nonEmptyLines : 0;
    perFile.push({
      path: f.relPath,
      totalLines: stat.totalLines,
      nonEmptyLines: stat.nonEmptyLines,
      commentLines: stat.commentLines,
      commentRatio: Number(ratio.toFixed(4)),
    });
    totalLines += stat.totalLines;
    totalNonEmptyLines += stat.nonEmptyLines;
    totalCommentLines += stat.commentLines;
  }

  const topCommentFiles = [...perFile]
    .filter((f) => f.nonEmptyLines > 0)
    .sort((a, b) => b.commentRatio - a.commentRatio)
    .slice(0, 3);

  const commentRatio = totalNonEmptyLines > 0 ? Number((totalCommentLines / totalNonEmptyLines).toFixed(4)) : 0;
  const minLines = config.minLinesForPartial;
  const decision = totalNonEmptyLines < minLines ? "full" : "partial";

  const linesPerPage = config.linesPerPage;
  const pages = totalNonEmptyLines > 0 ? Math.ceil(totalNonEmptyLines / linesPerPage) : 0;
  const frontPages = config.frontPages;
  const backPages = config.backPages;
  const frontLines = decision === "partial" ? frontPages * linesPerPage : totalNonEmptyLines;
  const backLines = decision === "partial" ? backPages * linesPerPage : 0;

  if (topCommentFiles.some((f) => f.commentRatio > 1 / 3)) {
    warn(
      `[WARN] 注释占比超过 1/3（总 ${totalCommentLines} 注释行 / ${totalNonEmptyLines} 非空行，占比 ${(commentRatio * 100).toFixed(1)}%），注释占比最高的文件：`
    );
    for (const f of topCommentFiles) {
      warn(`  ${f.path}: ${(f.commentRatio * 100).toFixed(1)}%（${f.commentLines} 注释 / ${f.nonEmptyLines} 非空）`);
    }
  }

  return {
    totalFiles: perFile.length,
    totalLines,
    totalNonEmptyLines,
    totalCommentLines,
    commentRatio,
    decision,
    topCommentFiles,
    pages: {
      mode: decision,
      linesPerPage,
      pages,
      frontPages,
      backPages,
      frontLines,
      backLines,
      note:
        decision === "partial"
          ? `有效行数 ${totalNonEmptyLines} ≥ ${minLines}，输出前 ${frontPages} 页（${frontLines} 行）+ 后 ${backPages} 页（${backLines} 行）`
          : `有效行数 ${totalNonEmptyLines} < ${minLines}，输出全量（${pages} 页 / ${totalNonEmptyLines} 行）`,
    },
    files: perFile,
  };
}

// CLI 入口
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv);
  runCount({ root: args.root })
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((err) => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
}

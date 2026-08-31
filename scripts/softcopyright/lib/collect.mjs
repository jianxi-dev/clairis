// 共享文件收集模块：按 config（sourceRoots/includeExts/excludeGlobs/entryFiles）遍历源目录，
// 输出确定性顺序（入口文件置前、其余按路径字典序）的文件列表。
// 供 count-lines / build-source-doc 等工具复用。
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// 常见非源码目录，遍历时直接剪枝（与 sourceRoots/excludeGlobs 双重保险）。
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const REGEX_META = new Set([".", "+", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);

/**
 * 将受限 glob 模式转换为正则表达式。
 * 支持语法：双星加斜杠（任意层级目录前缀）、星号（单段通配）、问号（单字符）；其余字符按字面转义。
 */
export function globToRegExp(pattern) {
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) {
      re += "(?:.*/)?";
      i += 3;
    } else if (pattern.startsWith("**", i)) {
      re += ".*";
      i += 2;
    } else if (pattern[i] === "*") {
      re += "[^/]*";
      i += 1;
    } else if (pattern[i] === "?") {
      re += "[^/]";
      i += 1;
    } else {
      const ch = pattern[i];
      re += REGEX_META.has(ch) ? "\\" + ch : ch;
      i += 1;
    }
  }
  re += "$";
  return new RegExp(re);
}

/** 相对路径是否命中任一排除 glob。 */
export function matchesExclude(relPath, excludeGlobs) {
  const normalized = relPath.split(path.sep).join("/");
  return excludeGlobs.some((g) => globToRegExp(g).test(normalized));
}

/**
 * 收集文件列表。
 * @param {object} opts
 * @param {string[]} opts.sourceRoots 相对 baseDir 的自有代码根目录
 * @param {string[]} opts.includeExts 扩展名白名单（含点，如 ".ts"）
 * @param {string[]} opts.excludeGlobs 排除 glob（相对各 sourceRoot 匹配）
 * @param {string[]} opts.entryFiles 入口文件（相对 baseDir），排序置前
 * @param {string} [opts.baseDir] 基准目录（默认 process.cwd()）
 * @returns {Promise<{absPath: string, relPath: string}[]>} 确定性顺序：entryFiles 优先，其余按 relPath 字典序
 */
export async function collectFiles({
  sourceRoots,
  includeExts,
  excludeGlobs,
  entryFiles,
  baseDir = process.cwd(),
}) {
  const extSet = new Set(includeExts.map((e) => e.toLowerCase()));
  const files = [];

  async function walk(dirAbs, relToRoot) {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = path.join(dirAbs, entry.name);
      const rel = relToRoot ? path.join(relToRoot, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extSet.has(ext)) continue;
        if (matchesExclude(rel, excludeGlobs)) continue;
        files.push({ absPath: abs, relPath: path.relative(baseDir, abs) });
      }
    }
  }

  for (const root of sourceRoots) {
    const absRoot = path.resolve(baseDir, root);
    const st = await stat(absRoot).catch(() => null);
    if (!st || !st.isDirectory()) continue;
    await walk(absRoot, "");
  }

  const entryOrder = new Map(entryFiles.map((f, i) => [f.split("/").join(path.sep), i]));
  files.sort((a, b) => {
    const ia = entryOrder.get(a.relPath);
    const ib = entryOrder.get(b.relPath);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0;
  });
  return files;
}

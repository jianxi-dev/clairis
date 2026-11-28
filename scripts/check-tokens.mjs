#!/usr/bin/env node
/**
 * check-tokens.mjs — Q0 token 门禁（ui-quality-gate-v1 / 票 #1647）
 *
 * 三项检查：
 *   A 裸色值：src/components/** 与 src/editors/** 的 ts/tsx/css 不得新增
 *     hex / rgb() / rgba() 字面量；存量进 scripts/token-baseline.json，只减不增。
 *   B 双向对账：tokens.ts 键集 == tokens.css 唯一变量名集合；主题块声明的键
 *     必须存在于键集；src 内每个 var(--x) 必须有定义。
 *   C 对比度：语义色对按主题（:root / .dark / .warm）算 WCAG 比值，低于阈值退 1。
 *
 * 用法：
 *   node scripts/check-tokens.mjs                 跑 A + B + C
 *   node scripts/check-tokens.mjs --only=A         只跑指定项（可重复或逗号分隔，大小写不敏感）
 *   node scripts/check-tokens.mjs --update-baseline  由当前 A 扫描重生成基线（隐含 --only=A）
 *
 * 退出码：0 干净；1 有违例；2 用法错误。
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCAN_DIRS = ["src/components", "src/editors"];
const CSS_FILE = "src/styles/tokens.css";
const TS_FILE = "src/styles/tokens.ts";
const BASELINE_FILE = "scripts/token-baseline.json";
const BASELINE_VERSION = 1;
const DEFAULT_REASON = "存量（Q0 冻结）；迁移随 Q2 基件与后续专项";
const CHECKS = ["A", "B", "C"];

// 危险色由 --app-danger 承载（spec §6）；读不到时回落现值，保证 token 缺失也能诊断。
const DANGER_BY_THEME = { ":root": "#a8402f", ".warm": "#a8402f", ".dark": "#e08b7a" };

// 语义色对与阈值（design-system §7.8，唯一来源）。
const CONTRAST_PAIRS = [
  { label: "ink-1（--app-text-strong）", fg: "--app-text-strong", threshold: 7 },
  { label: "正文（--app-text-2）", fg: "--app-text-2", threshold: 4.5 },
  { label: "次要/大字（--app-text-3）", fg: "--app-text-3", threshold: 3 },
  { label: "accent 实底文字（--app-on-accent）", fg: "--app-on-accent", bg: "--app-accent-fill", threshold: 4.5 },
  { label: "危险色（danger）", fg: null, threshold: 4.5 },
];

const USAGE = `用法：
  node scripts/check-tokens.mjs                 跑 A + B + C
  node scripts/check-tokens.mjs --only=A         只跑指定项（可重复或逗号分隔）
  node scripts/check-tokens.mjs --update-baseline  重生成 A 基线（隐含 --only=A）`;

function fail2(message) {
  console.error(`用法错误：${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { only: null, updateBaseline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--update-baseline") {
      args.updateBaseline = true;
    } else if (arg === "--only") {
      const value = argv[i + 1];
      if (!value) fail2("--only 需要一个值");
      i += 1;
      args.only = (args.only ?? []).concat(splitList(value));
    } else if (arg.startsWith("--only=")) {
      args.only = (args.only ?? []).concat(splitList(arg.slice("--only=".length)));
    } else {
      fail2(`未知参数 ${arg}`);
    }
  }
  if (args.only) {
    const normalized = args.only.map((c) => c.toUpperCase());
    for (const c of normalized) {
      if (!CHECKS.includes(c)) fail2(`未知检查项 ${c}（可选 ${CHECKS.join("/")}）`);
    }
    args.only = normalized;
  }
  if (args.updateBaseline) args.only = ["A"];
  return args;
}

function splitList(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function walkFiles(dir, accept) {
  const out = [];
  const abs = resolve(ROOT, dir);
  if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const path = join(abs, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walkFiles(relative(ROOT, path), accept));
    } else if (accept(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

function toPosix(path) {
  return path.split("\\").join("/");
}

// ── A 裸色值 ───────────────────────────────────────────────────────────────

// 只匹配真实色值形状（3/4/6/8 位 hex），再剔除纯十进制 issue 引用（#564、#1700）。
const BARE_COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(/g;
const ISSUE_REF_RE = /^#[0-9]{3,4}$/;
const SCAN_EXT = /\.(ts|tsx|css)$/;

/**
 * 剥离注释，避免把注释里的 issue 号（`（#564）`、`// fixed …（#920）`）当裸色值。
 * 行注释只在 `//` 位于行首或前面是空白时剥离，字符串里的 `https://` 不受影响。
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[ \t])\/\/[^\n]*/g, "$1");
}

function isExcludedFromA(file) {
  const rel = toPosix(file);
  return (
    rel.includes("__tests__") ||
    rel.includes(".test.") ||
    rel.includes(".spec.") ||
    rel === CSS_FILE ||
    rel === TS_FILE ||
    rel.startsWith("scripts/")
  );
}

function scanBareColors() {
  const hits = new Map();
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(dir, (name) => SCAN_EXT.test(name))) {
      if (isExcludedFromA(file)) continue;
      const rel = toPosix(relative(ROOT, file));
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, index) => {
        const matches = line.match(BARE_COLOR_RE);
        if (!matches) return;
        const context = line.trim();
        for (const value of matches) {
          if (ISSUE_REF_RE.test(value)) continue;
          const key = `${rel}|${value}|${context}`;
          const entry = hits.get(key) ?? { file: rel, value, context, line: index + 1, count: 0 };
          entry.count += 1;
          hits.set(key, entry);
        }
      });
    }
  }
  return [...hits.values()].sort((a, b) =>
    a.file !== b.file
      ? a.file.localeCompare(b.file)
      : a.line !== b.line
        ? a.line - b.line
        : a.value.localeCompare(b.value),
  );
}

function loadBaseline() {
  return JSON.parse(readFileSync(resolve(ROOT, BASELINE_FILE), "utf8"));
}

function checkA(baselineOverride = null) {
  const current = scanBareColors();
  const baseline = baselineOverride ?? loadBaseline();
  const baselineMap = new Map(
    baseline.entries.map((e) => [`${e.file}|${e.value}|${e.context}`, e]),
  );
  const violations = [];
  for (const hit of current) {
    const key = `${hit.file}|${hit.value}|${hit.context}`;
    const base = baselineMap.get(key);
    if (!base) {
      violations.push(`新增裸色值 ${hit.file}:${hit.line} ${hit.value}（${hit.context.slice(0, 80)}）`);
    } else if (hit.count > base.count) {
      violations.push(
        `裸色值重复次数增加 ${hit.file}:${hit.line} ${hit.value}（基线 ${base.count} → 现在 ${hit.count}）`,
      );
    }
  }
  return { violations, current };
}

function writeBaseline(entries) {
  const payload = {
    version: BASELINE_VERSION,
    generatedBy: "scripts/check-tokens.mjs --update-baseline",
    entries: entries.map((e) => ({
      file: e.file,
      value: e.value,
      context: e.context,
      count: e.count,
      reason: DEFAULT_REASON,
    })),
  };
  writeFileSync(resolve(ROOT, BASELINE_FILE), `${JSON.stringify(payload, null, 2)}\n`);
}

// ── B 双向对账 ─────────────────────────────────────────────────────────────

function parseCssBlocks(css) {
  const blocks = {};
  let current = null;
  for (const raw of css.split("\n")) {
    const line = raw.trim();
    const open = line.match(/^(:root|\.dark|\.warm)\s*\{/);
    if (open) {
      current = open[1];
      blocks[current] = [];
      continue;
    }
    if (current && line === "}") {
      current = null;
      continue;
    }
    if (!current) continue;
    const decl = line.match(/^\s*(--[a-zA-Z0-9-]+)\s*:/);
    if (decl) blocks[current].push(decl[1]);
  }
  return blocks;
}

function parseTokenNames(ts) {
  const start = ts.indexOf("export const TOKEN_NAMES = [");
  const end = ts.indexOf("] as const;", start);
  if (start === -1 || end === -1) {
    throw new Error(`${TS_FILE} 中找不到 TOKEN_NAMES 字面量数组`);
  }
  const body = ts.slice(start + "export const TOKEN_NAMES = [".length, end);
  return [...body.matchAll(/"([a-zA-Z0-9-]+)"/g)].map((m) => `--${m[1]}`);
}

/**
 * 运行时由 JS 注入的 CSS 变量（无静态声明，属既有设计）：
 *  - --dc-N：预览内嵌 HTML 的深色替代值，渲染时按序编号注入（renderers/markdown.ts）。
 *  - --heading-h1..h6 / --heading-h*-font：标题色板与字体，配置注入（ContentArea / PreviewView）。
 *  - --pane-hotzone-px / --pane-hint-px / --pane-scale-factor：pane-modes 面与缩放（useConfig）。
 *  - --dpb-label-col：B 标签列实测加宽（DocPropertyBar）。
 *  - --sw：轮盘色板的 swatch 变量（roulette-view）。
 */
const RUNTIME_INJECTED = [
  "dc-N",
  "heading-h1",
  "heading-h2",
  "heading-h3",
  "heading-h4",
  "heading-h5",
  "heading-h6",
  "heading-h1-font",
  "heading-h2-font",
  "heading-h3-font",
  "heading-h4-font",
  "heading-h5-font",
  "heading-h6-font",
  "pane-hotzone-px",
  "pane-hint-px",
  "pane-scale-factor",
  "dpb-label-col",
  "sw",
];

/**
 * 可选覆盖变量：调用形如 `var(--x, <fallback>)`，未定义时走 fallback，属既有设计。
 * 登记在此以免误报「未定义」；新增此类变量须同步登记，否则 B 项退 1。
 */
const OPTIONAL_OVERRIDES = [
  "app-text-secondary",
  "art-theme",
  "callout-bg",
  "callout-border",
  "callout-text",
  "dpb-cal-wheels",
  "dpb-date-gap",
  "dpb-footer-font-size",
  "space-4",
];

/** 模板拼接的变量名（`var(--type-${kind})`）：展开为 tokens.css 已有的同类名。 */
function expandTemplateName(name) {
  if (!name.endsWith("-")) return [name];
  const prefix = name.slice(0, -1);
  return [...TOKEN_NAME_SET].filter((n) => n.startsWith(prefix)).map((n) => `${n}-`);
}

const TOKEN_NAME_SET = new Set(
  parseTokenNames(readFileSync(resolve(ROOT, TS_FILE), "utf8")).map((n) => n.slice(2)),
);

function collectCssDefinitions() {
  const defined = new Map();
  for (const file of walkFiles("src", (name) => name.endsWith(".css"))) {
    const rel = toPosix(relative(ROOT, file));
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      if (!defined.has(m[1])) defined.set(m[1], rel);
    }
  }
  return defined;
}

function checkB() {
  const violations = [];
  const css = readFileSync(resolve(ROOT, CSS_FILE), "utf8");
  const ts = readFileSync(resolve(ROOT, TS_FILE), "utf8");
  const blocks = parseCssBlocks(css);
  const cssNames = new Set(blocks[":root"] ?? []);
  const tsNames = new Set(parseTokenNames(ts));

  const onlyCss = [...cssNames].filter((n) => !tsNames.has(n)).sort();
  const onlyTs = [...tsNames].filter((n) => !cssNames.has(n)).sort();
  if (onlyCss.length || onlyTs.length) {
    violations.push(
      `tokens.ts 与 tokens.css 键集不等：仅 CSS ${onlyCss.join(", ") || "—"}；仅 TS ${onlyTs.join(", ") || "—"}`,
    );
  }

  for (const block of [".dark", ".warm"]) {
    for (const name of blocks[block] ?? []) {
      if (!cssNames.has(name)) {
        violations.push(`主题块 ${block} 声明了键集外的 ${name}`);
      }
    }
  }

  const defined = collectCssDefinitions();
  for (const name of RUNTIME_INJECTED) defined.set(`--${name}`, "（运行时注入）");
  for (const name of OPTIONAL_OVERRIDES) defined.set(`--${name}`, "（可选覆盖，带 fallback）");

  const used = new Map();
  const files = walkFiles("src", (name) => /\.(ts|tsx|css)$/.test(name));
  for (const file of files) {
    const rel = toPosix(relative(ROOT, file));
    if (rel === CSS_FILE || rel === TS_FILE) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      const name = m[1];
      if (defined.has(name)) continue;
      const expanded = expandTemplateName(name);
      if (expanded.every((n) => defined.has(n))) continue;
      const list = used.get(name) ?? [];
      list.push(rel);
      used.set(name, list);
    }
  }
  for (const [name, files2] of [...used.entries()].sort()) {
    violations.push(`var(${name}) 未定义，使用于 ${[...new Set(files2)].join(", ")}`);
  }
  return { violations };
}

// ── C 对比度 ───────────────────────────────────────────────────────────────

function parseDeclarations(css) {
  const blocks = {};
  let current = null;
  let depth = 0;
  let buffer = "";
  for (const raw of css.split("\n")) {
    const line = raw.trim();
    const open = line.match(/^(:root|\.dark|\.warm)\s*\{$/);
    if (open) {
      current = open[1];
      blocks[current] = {};
      depth = 1;
      buffer = "";
      continue;
    }
    if (!current) continue;
    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
    buffer += `${line}\n`;
    if (depth === 0) {
      for (const decl of buffer.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
        blocks[current][decl[1]] = decl[2].trim();
      }
      current = null;
      buffer = "";
    }
  }
  return blocks;
}

function resolveValue(value, blocks, theme, seen = new Set()) {
  const trimmed = value.trim();
  const ref = trimmed.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
  if (!ref) return trimmed;
  const name = ref[1];
  if (seen.has(name)) return null;
  seen.add(name);
  const declared = blocks[theme]?.[name] ?? blocks[":root"]?.[name];
  if (declared === undefined) return null;
  return resolveValue(declared, blocks, theme, seen);
}

function parseColor(value) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 4) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const to255 = (v) => (String(v).endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const alpha = rgb[4] === undefined ? 1 : String(rgb[4]).endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { r: to255(rgb[1]), g: to255(rgb[2]), b: to255(rgb[3]), a: alpha };
  }
  return null;
}

function luminance({ r, g, b, a }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return L === 0 ? 0 : a === 1 ? L : L * a + 0.05 * (1 - a);
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function checkC() {
  const css = readFileSync(resolve(ROOT, CSS_FILE), "utf8");
  const blocks = parseDeclarations(css);
  const rows = [];
  const failures = [];
  for (const theme of [":root", ".dark", ".warm"]) {
    const bgRaw = resolveValue("var(--app-bg)", blocks, theme);
    const bg = parseColor(bgRaw);
    if (!bg) {
      failures.push(`${theme} --app-bg 无法解析（${bgRaw ?? "缺失"}）`);
      continue;
    }
    for (const pair of CONTRAST_PAIRS) {
      const fgRaw =
        pair.fg === null
          ? (resolveValue("var(--app-danger)", blocks, theme) ?? DANGER_BY_THEME[theme])
          : resolveValue(`var(${pair.fg})`, blocks, theme);
      const fg = parseColor(fgRaw);
      const label = pair.fg === null ? "危险色（danger）" : pair.label;
      if (!fg) {
        failures.push(`${theme} ${label} 无法解析（${fgRaw ?? "缺失"}）`);
        continue;
      }
      const bgForPair = pair.bg
        ? parseColor(resolveValue(`var(${pair.bg})`, blocks, theme))
        : bg;
      if (!bgForPair) {
        failures.push(`${theme} ${pair.bg} 无法解析`);
        continue;
      }
      const ratio = contrastRatio(fg, bgForPair);
      const pass = ratio >= pair.threshold;
      rows.push({ theme, pair: label, ratio, threshold: pair.threshold, pass });
      if (!pass) {
        failures.push(
          `${theme} ${label} 对比度 ${ratio.toFixed(2)} < ${pair.threshold}`,
        );
      }
    }
  }
  return { rows, failures };
}

// ── 入口 ───────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const enabled = args.only ?? CHECKS;

if (args.updateBaseline) {
  const { current } = checkA({ entries: [] });
  writeBaseline(current);
  console.log(`已写入 ${BASELINE_FILE}：${current.length} 条，sum(count) = ${current.reduce((s, e) => s + e.count, 0)}`);
  process.exit(0);
}

let failed = false;

if (enabled.includes("A")) {
  const { violations } = checkA();
  if (violations.length) {
    failed = true;
    console.error(`A 裸色值：${violations.length} 处违例`);
    for (const v of violations) console.error(`  ✗ ${v}`);
  } else {
    console.log("A 裸色值：通过（无新增，基线只减不增）");
  }
}

if (enabled.includes("B")) {
  const { violations } = checkB();
  if (violations.length) {
    failed = true;
    console.error(`B 双向对账：${violations.length} 处违例`);
    for (const v of violations) console.error(`  ✗ ${v}`);
  } else {
    console.log("B 双向对账：通过（键集相等 / 主题块键存在 / var() 有定义）");
  }
}

if (enabled.includes("C")) {
  const { rows, failures } = checkC();
  for (const row of rows) {
    console.log(
      `C 对比度 ${row.theme.padEnd(6)} ${row.pair.padEnd(34)} ${row.ratio.toFixed(2)} ≥ ${row.threshold} ${row.pass ? "PASS" : "FAIL"}`,
    );
  }
  if (failures.length) {
    failed = true;
    console.error(`C 对比度：${failures.length} 处跌破`);
    for (const f of failures) console.error(`  ✗ ${f}`);
  } else {
    console.log("C 对比度：通过");
  }
}

process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * check-interaction.mjs — Q1 交互门禁（ui-quality-gate-v1 / 票 #1648）
 *
 * 两项检查（条款见 docs/design/system/interaction.md）：
 *   hairlines 零横线：src 下所有 css 不得新增 border-top/bottom 1px（含
 *     border-block-start/end）。存量进 scripts/interaction-baseline.json，只减不增。
 *   dialogs 反馈三档：src 下所有 ts/tsx 不得新增 window.alert/confirm/prompt。
 *     存量进同一基线，新增零容忍。
 *
 * 用法：
 *   node scripts/check-interaction.mjs                 跑 hairlines + dialogs
 *   node scripts/check-interaction.mjs --only=hairlines  只跑指定项（可重复或逗号分隔）
 *   node scripts/check-interaction.mjs --only=dialogs
 *   node scripts/check-interaction.mjs --update-baseline  由当前扫描重生成基线（隐含两项）
 *
 * 退出码：0 干净；1 有违例；2 用法错误。
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BASELINE_FILE = "scripts/interaction-baseline.json";
const BASELINE_VERSION = 1;
const HAIRLINE_REASON = "存量冻结；迁移随 Q2 基件与后续专项";
const DIALOG_REASON = "迁移留 Q2 dialog 之后";
const CHECKS = ["hairlines", "dialogs"];

const USAGE = `用法：
  node scripts/check-interaction.mjs                 跑 hairlines + dialogs
  node scripts/check-interaction.mjs --only=hairlines  只跑指定项（可重复或逗号分隔）
  node scripts/check-interaction.mjs --only=dialogs
  node scripts/check-interaction.mjs --update-baseline  重生成基线`;

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
    const normalized = args.only.map((c) => c.toLowerCase());
    for (const c of normalized) {
      if (!CHECKS.includes(c)) fail2(`未知检查项 ${c}（可选 ${CHECKS.join("/")}）`);
    }
    args.only = normalized;
  }
  if (args.updateBaseline) args.only = [...CHECKS];
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

/**
 * 剥离注释，避免把注释里的 `border-bottom: 1px` / `window.prompt` 当命中。
 * 与 check-tokens.mjs 同口径：块注释全删；行注释仅在 `//` 位于行首或前接空白时删，
 * 字符串里的 `https://` 不受影响。
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[ \t])\/\/[^\n]*/g, "$1");
}

// ── hairlines 零横线 ──────────────────────────────────────────────────────

// 匹配 border-top / border-bottom / border-block-start / border-block-end 的 1px。
const HAIRLINE_RE =
  /border-(?:top|bottom|block-start|block-end)\s*:\s*1px\b/g;
const CSS_EXT = /\.css$/;

function scanHairlines() {
  const hits = new Map();
  for (const file of walkFiles("src", (name) => CSS_EXT.test(name))) {
    const rel = toPosix(relative(ROOT, file));
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      const matches = line.match(HAIRLINE_RE);
      if (!matches) return;
      const context = line.trim();
      for (const _ of matches) {
        const key = `${rel}|${context}`;
        const entry = hits.get(key) ?? { file: rel, context, line: index + 1, count: 0 };
        entry.count += 1;
        hits.set(key, entry);
      }
    });
  }
  return [...hits.values()].sort((a, b) =>
    a.file !== b.file
      ? a.file.localeCompare(b.file)
      : a.line !== b.line
        ? a.line - b.line
        : a.context.localeCompare(b.context),
  );
}

// ── dialogs 反馈三档 ──────────────────────────────────────────────────────

const DIALOG_RE = /window\.(alert|confirm|prompt)\s*\(/g;
const TS_EXT = /\.(ts|tsx)$/;

function scanDialogs() {
  const hits = new Map();
  for (const file of walkFiles("src", (name) => TS_EXT.test(name))) {
    const rel = toPosix(relative(ROOT, file));
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      for (const m of line.matchAll(DIALOG_RE)) {
        const callee = m[1];
        const context = line.trim();
        const key = `${rel}|${callee}|${context}`;
        const entry = hits.get(key) ?? { file: rel, callee, context, line: index + 1, count: 0 };
        entry.count += 1;
        hits.set(key, entry);
      }
    });
  }
  return [...hits.values()].sort((a, b) =>
    a.file !== b.file
      ? a.file.localeCompare(b.file)
      : a.line !== b.line
        ? a.line - b.line
        : a.callee.localeCompare(b.callee),
  );
}

// ── 基线 ──────────────────────────────────────────────────────────────────

function loadBaseline() {
  return JSON.parse(readFileSync(resolve(ROOT, BASELINE_FILE), "utf8"));
}

function compareGroup(current, baselineEntries, keyOf, describe) {
  const baselineMap = new Map(baselineEntries.map((e) => [keyOf(e), e]));
  const violations = [];
  for (const hit of current) {
    const key = keyOf(hit);
    const base = baselineMap.get(key);
    if (!base) {
      violations.push(`新增 ${describe(hit)}`);
    } else if (hit.count > base.count) {
      violations.push(
        `${describe(hit)}（基线 ${base.count} → 现在 ${hit.count}）`,
      );
    }
  }
  return violations;
}

function checkHairlines(baselineOverride = null) {
  const current = scanHairlines();
  const baseline = baselineOverride ?? loadBaseline();
  const violations = compareGroup(
    current,
    baseline.groups.hairlines,
    (e) => `${e.file}|${e.context}`,
    (hit) => `1px 横线 ${hit.file}:${hit.line}（${hit.context.slice(0, 80)}）`,
  );
  return { violations, current };
}

function checkDialogs(baselineOverride = null) {
  const current = scanDialogs();
  const baseline = baselineOverride ?? loadBaseline();
  const violations = compareGroup(
    current,
    baseline.groups.dialogs,
    (e) => `${e.file}|${e.callee}|${e.context}`,
    (hit) => `原生对话框 ${hit.file}:${hit.line} window.${hit.callee}（${hit.context.slice(0, 80)}）`,
  );
  return { violations, current };
}

function writeBaseline(hairlines, dialogs) {
  const payload = {
    version: BASELINE_VERSION,
    generatedBy: "scripts/check-interaction.mjs --update-baseline",
    groups: {
      hairlines: hairlines.map((e) => ({
        file: e.file,
        context: e.context,
        count: e.count,
        reason: HAIRLINE_REASON,
      })),
      dialogs: dialogs.map((e) => ({
        file: e.file,
        callee: e.callee,
        context: e.context,
        count: e.count,
        reason: DIALOG_REASON,
      })),
    },
  };
  writeFileSync(resolve(ROOT, BASELINE_FILE), `${JSON.stringify(payload, null, 2)}\n`);
}

// ── 入口 ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const enabled = args.only ?? CHECKS;

if (args.updateBaseline) {
  const { current: hairlines } = checkHairlines({ groups: { hairlines: [], dialogs: [] } });
  const { current: dialogs } = checkDialogs({ groups: { hairlines: [], dialogs: [] } });
  writeBaseline(hairlines, dialogs);
  console.log(
    `已写入 ${BASELINE_FILE}：hairlines ${hairlines.length} 条（sum(count) = ${hairlines.reduce((s, e) => s + e.count, 0)}）；dialogs ${dialogs.length} 条（sum(count) = ${dialogs.reduce((s, e) => s + e.count, 0)}）`,
  );
  process.exit(0);
}

let failed = false;

if (enabled.includes("hairlines")) {
  const { violations } = checkHairlines();
  if (violations.length) {
    failed = true;
    console.error(`hairlines 零横线：${violations.length} 处违例`);
    for (const v of violations) console.error(`  ✗ ${v}`);
  } else {
    console.log("hairlines 零横线：通过（无新增，基线只减不增）");
  }
}

if (enabled.includes("dialogs")) {
  const { violations } = checkDialogs();
  if (violations.length) {
    failed = true;
    console.error(`dialogs 反馈三档：${violations.length} 处违例`);
    for (const v of violations) console.error(`  ✗ ${v}`);
  } else {
    console.log("dialogs 反馈三档：通过（无新增 window.alert/confirm/prompt）");
  }
}

process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * 图标纪检（ui-quality-primitives-v1 / 2.5；spec §2.1 / §2.2 / §2.4）。
 *
 * 四项机检，任一违规即退 1：
 *   A 两表对账：`src/editors/icons.ts` 里 `UI_ICONS.<键>` 的每一处引用都必须存在于
 *     `src/ui/icons.ts` 的 ICONS（概念键）；缺失即悬空引用。
 *   B 尺寸白名单：生产代码只允许 14 / 18 / 24；12 仅角标豁免清单内（spec §2.1）。
 *   C 动作 → 图标映射：三张动作表的取值必须存在于两表之一，且同一动作不得映射到
 *     两个不同图标（同一动作永远同一图标，spec §2.4）。
 *   D 孤儿键：声明了却全仓零引用的键必须进 `scripts/icon-baseline.json` 白名单，
 *     白名单只减不增；新增孤儿键即退 1。
 *
 * 用法：
 *   node scripts/check-icons.mjs            # 全量四项
 *   node scripts/check-icons.mjs --list-top # 只打印高频 18px 图标（裁决表用）
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const UI_ICONS_FILE = "src/ui/icons.ts";
const ED_ICONS_FILE = "src/editors/icons.ts";
const BASELINE_FILE = "scripts/icon-baseline.json";
const SCAN_ROOTS = ["src"];
/** 测试目录豁免尺寸检查：用例要能构造各档尺寸才测得出来。 */
const TEST_PREFIX = "src/__tests__/";

/** spec §2.1：14 / 18 / 24 三档，12 仅角标。 */
const ALLOWED_SIZES = new Set([12, 14, 18, 24]);
/** 12px 豁免清单：仅文档属性 footer 的锁图标（spec §7.2 明确该处比密集档小一号）。 */
const SIZE12_WHITELIST = [
  { file: "src/components/Content/DocPropertyBar.tsx", icon: "lock", count: 3 },
];

const violations = [];
const fail = (msg) => violations.push(msg);

/** 读文件（缺失即记为违规，避免脚本静默跳过）。 */
function read(rel) {
  try {
    return readFileSync(resolve(ROOT, rel), "utf8");
  } catch {
    fail(`读不到文件: ${rel}`);
    return "";
  }
}

/** 取对象字面量的顶层键（约定：定义处键名缩进两格）。 */
function topLevelKeys(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) {
    fail(`找不到声明: ${marker}`);
    return [];
  }
  const open = src.indexOf("{", at);
  const keys = [];
  let depth = 0;
  for (const line of src.slice(open).split("\n")) {
    const text = line.trim();
    if (depth === 1) {
      const m = text.match(/^["']?([A-Za-z_][\w.-]*)["']?\s*:/);
      if (m) keys.push(m[1]);
    }
    if (depth === 1 && text.startsWith("}")) break;
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return keys;
}

/** 取对象字面量的 键 → 字符串值 映射（动作表都是这种形状）。 */
function stringMap(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) {
    fail(`找不到动作表: ${marker}`);
    return new Map();
  }
  const open = src.indexOf("{", at);
  const out = new Map();
  let depth = 0;
  for (const line of src.slice(open).split("\n")) {
    const text = line.trim();
    if (depth === 1) {
      const m = text.match(/^["']?([A-Za-z_][\w.-]*)["']?\s*:\s*["']([A-Za-z][\w]*)["']/);
      if (m) out.set(m[1], m[2]);
    }
    if (depth === 1 && text.startsWith("}")) break;
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return out;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(resolve(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const uiSrc = read(UI_ICONS_FILE);
const edSrc = read(ED_ICONS_FILE);
const iconKeys = topLevelKeys(uiSrc, "export const ICONS");
const registryKeys = topLevelKeys(edSrc, "const ICON_REGISTRY");
const knownKeys = new Set([...iconKeys, ...registryKeys]);

/** A 两表对账：editors 侧引用的概念键必须都存在。 */
function checkA() {
  console.log("==> A 两表对账（UI_ICONS 引用完整性）");
  const refs = new Set(
    [...edSrc.matchAll(/UI_ICONS\.([A-Za-z_][\w]*)/g)].map((m) => m[1]),
  );
  const iconSet = new Set(iconKeys);
  const dangling = [...refs].filter((k) => !iconSet.has(k));
  for (const key of dangling) {
    fail(`[A] ${ED_ICONS_FILE} 引用了不存在的概念键: UI_ICONS.${key}`);
  }
  console.log(
    `    概念键 ${iconKeys.length} 个 / 编辑器侧引用 ${refs.size} 个 / 悬空 ${dangling.length} 个`,
  );
}

/** B 尺寸白名单。 */
function checkB() {
  console.log("==> B 尺寸白名单（14 / 18 / 24，12 仅角标豁免）");
  const files = SCAN_ROOTS.flatMap((d) => walk(d)).filter(
    (f) => !f.startsWith(TEST_PREFIX),
  );
  const size12 = new Map();
  for (const file of files) {
    const src = readFileSync(resolve(ROOT, file), "utf8");
    // 只看图标组件自身的 size：`size={96}` 这类视频/画布元素的尺寸不是图标档位。
    for (const el of src.matchAll(/<(Icon|IconButton)\b[^>]*?\/?>/g)) {
      const attrs = el[0];
      const sizeMatch = attrs.match(/\bsize=\{(\d+)\}/) ?? attrs.match(/\bsize="(\d+)"/);
      if (!sizeMatch) continue;
      const size = Number(sizeMatch[1]);
      const line = src.slice(0, el.index).split("\n").length;
      if (!ALLOWED_SIZES.has(size)) {
        fail(`[B] ${file}:${line} 使用了非法尺寸档 ${size}（只允许 12/14/18/24）`);
        continue;
      }
      if (size !== 12) continue;
      const icon = attrs.match(/\bname="([A-Za-z_][\w]*)"/)?.[1] ?? "";
      const key = `${file}|${icon}`;
      size12.set(key, (size12.get(key) ?? 0) + 1);
    }
  }
  const allowed = new Map(
    SIZE12_WHITELIST.map((w) => [`${w.file}|${w.icon}`, w.count]),
  );
  for (const [key, count] of size12) {
    const expected = allowed.get(key);
    if (expected === undefined) {
      fail(
        `[B] 12px 越档: ${key.replace("|", " 的图标 ")} 用了 ${count} 处（不在豁免清单）`,
      );
    } else if (count !== expected) {
      fail(
        `[B] 12px 数量变化: ${key.replace("|", " 的图标 ")} 现 ${count} 处，清单记 ${expected} 处`,
      );
    }
  }
  for (const [key, expected] of allowed) {
    if (!size12.has(key)) {
      fail(
        `[B] 12px 豁免项已消失: ${key.replace("|", " 的图标 ")}（请同步收紧清单，原记 ${expected} 处）`,
      );
    }
  }
  const total = [...size12.values()].reduce((a, b) => a + b, 0);
  console.log(`    12px 生产处数 ${total}（豁免 ${SIZE12_WHITELIST.length} 组）`);
}

/** C 动作 → 图标映射。 */
const ACTION_MAPS = ["COMMAND_ICON_NAME", "CONVERT_ICON_NAME", "ACTION_ICON_NAME"];

function checkC() {
  console.log("==> C 动作 → 图标映射（取值存在 + 唯一）");
  const seen = new Map();
  for (const name of ACTION_MAPS) {
    const map = stringMap(edSrc, `export const ${name}`);
    for (const [action, icon] of map) {
      if (!knownKeys.has(icon)) {
        fail(`[C] ${name}.${action} → ${icon} 不存在于两表`);
      }
      const prev = seen.get(action);
      if (prev && prev.icon !== icon) {
        fail(`[C] 动作 ${action} 同时映射到 ${prev.icon}（${prev.map}）与 ${icon}（${name}）`);
      } else if (!prev) {
        seen.set(action, { icon, map: name });
      }
    }
    console.log(`    ${name}: ${map.size} 项`);
  }
}

/** D 孤儿键（白名单只减不增）。 */
function checkD() {
  console.log("==> D 孤儿键（声明但全仓零引用）");
  let baseline = { orphans: [] };
  try {
    baseline = JSON.parse(readFileSync(resolve(ROOT, BASELINE_FILE), "utf8"));
  } catch {
    fail(`[D] 读不到白名单 ${BASELINE_FILE}（孤儿断言无基线，无法判定只减不增）`);
  }
  const allowed = new Set(baseline.orphans ?? []);
  // 语料排除 UI 图标表自身（其声明不能算「有人用」）；`editors/icons.ts` 必须留在语料里，
  // 因为注册表键正是在该文件的动作表（COMMAND/CONVERT/ACTION）里被消费的。
  const corpus = walk("src")
    .filter((f) => f !== UI_ICONS_FILE)
    .map((f) => readFileSync(resolve(ROOT, f), "utf8"))
    .join("\n");
  const countRefs = (key) =>
    (corpus.match(new RegExp(`\\b${key}\\b`, "g")) ?? []).length;
  // 概念键：UI 表是唯一定义处，语料里 0 次即孤儿。
  // 注册表键：定义在 `editors/icons.ts`，该声明本身算 1 次；≤1 说明没被动作表消费。
  const orphans = [
    ...iconKeys.filter((k) => countRefs(k) === 0),
    ...registryKeys.filter((k) => countRefs(k) <= 1),
  ];
  const added = orphans.filter((k) => !allowed.has(k));
  const stale = [...allowed].filter((k) => !orphans.includes(k));
  for (const key of added) {
    fail(`[D] 新增孤儿键: ${key}（无人引用；要么删除，要么进白名单并写明理由）`);
  }
  for (const key of stale) {
    fail(`[D] 白名单过期: ${key} 已被引用（请从 ${BASELINE_FILE} 移除该行）`);
  }
  console.log(
    `    孤儿 ${orphans.length} 个（白名单 ${allowed.size} 个，新增 ${added.length}，过期 ${stale.length}）`,
  );
}

/** 裁决表素材：高频 18px 图标。 */
function printTop18(limit = 11) {
  const counts = new Map();
  for (const file of SCAN_ROOTS.flatMap((d) => walk(d))) {
    if (file.startsWith(TEST_PREFIX)) continue;
    const src = readFileSync(resolve(ROOT, file), "utf8");
    for (const m of src.matchAll(
      /<Icon\s+name="([A-Za-z_][\w]*)"[^>]*?size=\{18\}/g,
    )) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  console.log(`==> 高频 18px 图标 Top${limit}`);
  for (const [name, count] of top) console.log(`    ${name}: ${count}`);
  return top;
}

const onlyTop = process.argv.includes("--list-top");
if (onlyTop) {
  printTop18();
  process.exit(0);
}

console.log(`==> 图标纪检: ${relative(ROOT, resolve(ROOT, UI_ICONS_FILE))} / ${ED_ICONS_FILE}`);
console.log(`    概念键 ${iconKeys.length} / 注册表键 ${registryKeys.length}`);
checkA();
checkB();
checkC();
checkD();

if (violations.length > 0) {
  console.error(`\n❌ 图标纪检未通过（${violations.length} 项）：`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("\n✅ 图标纪检通过（A 两表 / B 尺寸 / C 映射 / D 孤儿）");

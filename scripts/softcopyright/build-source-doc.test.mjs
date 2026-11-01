/**
 * 任务 5 测试：源代码文档 PDF 生成（软著资料准备）
 *
 * 覆盖：
 *   - paginate 分页边界（50/51 行、3100 行部分提交 60 页）
 *   - buildDocLines 空行剔除与文件头统计
 *   - sortFilesForDoc 排序（entry > core > 字典序）与 coreFiles 前置
 *   - renderHtml 页眉（软件全称 + 版本号 + 页码）与每页行数/无空行页
 *   - validatePages / assertMinLines 失败路径（中间页不足行、去空行后 < 50 行）
 *   - detectCopyrightWarnings（Copyright (c) 行不含软件名 → WARN）
 *   - 真实仓库构建（PDF 生成、页数一致、meta 落盘）
 *   - 3100 行 fixture 恰好 60 页、首页入口文件、末页到文件尾
 *   - CLI 失败路径退出非零
 *
 * 运行：node --test "scripts/softcopyright/"(glob)"/*.test.mjs"（glob 形式：任意子目录 + 文件名 *.test.mjs）
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSourceDoc,
  sortFilesForDoc,
  buildDocLines,
  paginate,
  validatePages,
  assertMinLines,
  detectCopyrightWarnings,
  renderHtml,
  countPdfPages,
} from "./build-source-doc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_CONFIG = path.join(__dirname, "config.json");
const SCRIPT_PATH = path.join(__dirname, "build-source-doc.mjs");

const BASE_CONFIG = {
  softwareName: "标月阅读编辑软件",
  softwareShortName: "标月",
  version: "V1.0",
  ownerName: "",
  sourceRoots: ["."],
  includeExts: [".ts"],
  excludeGlobs: ["**/*.test.ts", "**/config.json"],
  entryFiles: [],
  coreFiles: [],
  linesPerPage: 50,
  minLinesForPartial: 3000,
  frontPages: 30,
  backPages: 30,
  screenshotsDir: "",
  scenesFile: "",
};

/** 构造内存文件映射 fixture（不落盘） */
function memFixture() {
  const entry = ["// entry 入口文件"];
  for (let i = 0; i < 20; i++) entry.push(`const e${i}: number = ${i};`);
  const core = ["// core 核心文件"];
  for (let i = 0; i < 1550; i++) core.push(`export const c${i} = ${i};`);
  const z = ["// z 字典序最后"];
  for (let i = 0; i < 1530; i++) z.push(`const z${i} = ${i};`);
  const files = {
    "src/z.ts": z.join("\n") + "\n",
    "src/entry.ts": entry.join("\n") + "\n\n\n", // 尾部空行应被剔除
    "src/core.ts": core.join("\n") + "\n",
  };
  return files;
}

/** 构造落盘 fixture，返回 { dir, configPath } */
function diskFixture(files, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-doc-"));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(dir, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  const config = { ...BASE_CONFIG, ...overrides };
  if (config.baseDir === undefined) config.baseDir = dir; // 绝对路径，buildSourceDoc 直接采用
  const configPath = path.join(dir, "sc-config.json");
  fs.writeFileSync(configPath, JSON.stringify(config), "utf8");
  return { dir, configPath };
}

test("paginate：50 行 → 1 页全量", () => {
  const lines = Array.from({ length: 50 }, (_, i) => `l${i}`);
  const r = paginate(lines, BASE_CONFIG);
  assert.equal(r.mode, "full");
  assert.equal(r.pages.length, 1);
  assert.equal(r.total, 50);
  assert.deepEqual(validatePages(r.pages, BASE_CONFIG), [50]);
});

test("paginate：51 行 → 2 页（50+1），末页豁免", () => {
  const lines = Array.from({ length: 51 }, (_, i) => `l${i}`);
  const r = paginate(lines, BASE_CONFIG);
  assert.equal(r.mode, "full");
  assert.equal(r.pages.length, 2);
  assert.deepEqual(validatePages(r.pages, BASE_CONFIG), [50, 1]);
});

test("paginate：3100 行 → 部分提交 60 页（前 30 + 后 30）", () => {
  const lines = Array.from({ length: 3100 }, (_, i) => `l${i}`);
  const r = paginate(lines, BASE_CONFIG);
  assert.equal(r.mode, "partial");
  assert.equal(r.front, 30);
  assert.equal(r.back, 30);
  assert.equal(r.pages.length, 60);
  assert.equal(r.pages[0][0], "l0");
  assert.equal(r.pages[29][49], "l1499"); // 前段末页末行
  assert.equal(r.pages[30][0], "l1600"); // 后段首页首行（62 页取前 30+后 30，丢中段 100 行）
  assert.equal(r.pages[59][49], "l3099"); // 后段末页末行（3100 整除 50）
  assert.deepEqual(validatePages(r.pages, BASE_CONFIG), new Array(60).fill(50));
});

test("validatePages：中间页行数不足 → 抛错", () => {
  const pages = [
    Array.from({ length: 50 }, (_, i) => `l${i}`),
    ["only-one"],
    Array.from({ length: 50 }, (_, i) => `l${i}`),
  ];
  assert.throws(() => validatePages(pages, BASE_CONFIG), /分页异常/);
});

test("validatePages：空页 → 抛错", () => {
  assert.throws(() => validatePages([[], Array(50).fill("x")], BASE_CONFIG), /分页异常/);
});

test("assertMinLines：全量模式去空行后 < 50 行 → 抛错", () => {
  assert.throws(
    () => assertMinLines({ total: 30, mode: "full", linesPerPage: 50 }),
    /无法成册/
  );
});

test("assertMinLines：partial 模式 30 行不抛错（前段已满页）", () => {
  assert.doesNotThrow(() => assertMinLines({ total: 30, mode: "partial", linesPerPage: 50 }));
});

test("buildDocLines：剔除空行、文件头统计正确、文件边界清晰", () => {
  const files = memFixture();
  const readContent = (rel) => files[rel];
  const relPaths = sortFilesForDoc(Object.keys(files), {
    entryFiles: ["src/entry.ts"],
    coreFiles: ["src/core.ts"],
  });
  assert.deepEqual(relPaths, ["src/entry.ts", "src/core.ts", "src/z.ts"]);

  const lines = buildDocLines(relPaths, readContent);
  // 21 行 entry + 1551 行 core + 1531 行 z + 3 个文件头 = 3106
  assert.equal(lines.length, 3106);
  assert.equal(lines[0], "===== src/entry.ts（21 行 / 3 空行） =====");
  assert.ok(lines.every((l) => l.trim() !== ""), "流内不得出现空行");
  assert.ok(lines.includes("// z 字典序最后"), "z.ts 内容在流内");
});

test("sortFilesForDoc：entry > core > 字典序，coreFiles 前置", () => {
  const relPaths = ["src/z.ts", "src/a.ts", "src/entry.ts", "src/core.ts", "src/m.ts"];
  const sorted = sortFilesForDoc(relPaths, {
    entryFiles: ["src/entry.ts"],
    coreFiles: ["src/core.ts"],
  });
  assert.deepEqual(sorted, ["src/entry.ts", "src/core.ts", "src/a.ts", "src/m.ts", "src/z.ts"]);

  // coreFiles 置前：构造 fixture 全量流后 core 文件头必须落在前 30 页内
  // （注意：只用 fixture 里实际存在的文件，src/a.ts / src/m.ts 仅参与纯排序断言）
  const files = memFixture();
  const fixturePaths = sortFilesForDoc(["src/z.ts", "src/entry.ts", "src/core.ts"], {
    entryFiles: ["src/entry.ts"],
    coreFiles: ["src/core.ts"],
  });
  const lines = buildDocLines(fixturePaths, (rel) => files[rel]);
  const r = paginate(lines, BASE_CONFIG);
  const coreHeaderPage = r.pages.findIndex((p) => p.some((l) => l.startsWith("===== src/core.ts")));
  assert.ok(coreHeaderPage >= 0 && coreHeaderPage < 30, `core 文件头应在第 1 页内，实际第 ${coreHeaderPage + 1} 页`);
  // core 文件在 z 之前出现
  const coreIdx = lines.findIndex((l) => l.startsWith("===== src/core.ts"));
  const zIdx = lines.findIndex((l) => l.startsWith("===== src/z.ts"));
  assert.ok(coreIdx < zIdx);
});

test("3100 行 fixture：恰好 60 页、首页入口文件头、末页到文件尾", () => {
  const files = memFixture();
  const relPaths = sortFilesForDoc(["src/z.ts", "src/entry.ts", "src/core.ts"], {
    entryFiles: ["src/entry.ts"],
    coreFiles: ["src/core.ts"],
  });
  const lines = buildDocLines(relPaths, (rel) => files[rel]);
  const r = paginate(lines, BASE_CONFIG);
  assert.equal(r.mode, "partial");
  assert.equal(r.pages.length, 60, "3100 行 fixture 应恰好 60 页");
  validatePages(r.pages, BASE_CONFIG);

  // 首页首行 = 入口文件头
  assert.match(r.pages[0][0], /^===== src\/entry\.ts/);
  // 末页末行 = 文件尾（z.ts 最后一行内容，无空行残留）
  assert.equal(r.pages[59][r.pages[59].length - 1], "const z1529 = 1529;");
  // 末页行数 < 50 豁免
  assert.ok(r.pages[59].length < 50);
});

test("renderHtml：页眉含软件全称+版本号、页码正确、每页 50 行、无空行页", () => {
  const pages = [
    Array.from({ length: 50 }, (_, i) => `const a${i} = ${i};`),
    ["const last = true;"],
  ];
  const html = renderHtml(pages, {
    softwareName: "标月阅读编辑软件",
    version: "V1.0",
    mode: "full",
  });
  assert.ok(html.includes("标月阅读编辑软件"), "页眉含软件全称");
  assert.ok(html.includes("V1.0"), "页眉含版本号");
  assert.ok(html.includes("第 1 / 2 页") && html.includes("第 2 / 2 页"), "页码正确");
  assert.ok(html.includes("data-page=\"1\"") && html.includes("data-page=\"2\""));

  const sections = html.split('<section class="page"').length - 1;
  assert.equal(sections, 2);
  // 每页 pre 内容行数：第一页满 50，末页 1（无空行页，末页豁免）
  const codeBlocks = [...html.matchAll(/<pre class="code">([\s\S]*?)<\/pre>/g)].map((m) =>
    m[1].split("\n").filter((l) => l.trim() !== "")
  );
  assert.deepEqual(codeBlocks.map((b) => b.length), [50, 1]);
});

test("detectCopyrightWarnings：Copyright (c) 不含软件名 → WARN；含软件名 → 不 WARN", () => {
  const lines = [
    "// Copyright (c) 2024 外部作者",
    "// Copyright (c) 2026 标月阅读编辑软件",
    "const x = 1;",
  ];
  const warns = detectCopyrightWarnings(lines, "标月阅读编辑软件");
  assert.equal(warns.length, 1);
  assert.match(warns[0], /外部作者/);
});

test("真实仓库构建：PDF 生成、页数一致、meta 落盘", async () => {
  const summary = await buildSourceDoc(REAL_CONFIG);
  assert.equal(summary.mode, "partial");
  assert.ok(summary.totalFiles > 0, "应收集到源码文件");
  assert.ok(summary.totalNonEmptyLines >= 3000, "真实仓库应触发部分提交");
  assert.equal(summary.expectedPages, summary.pdfPages, "PDF 页数与分页器一致");
  assert.ok(summary.pdfBytes > 0);

  const pdfPath = path.join(__dirname, "out", "source-doc.pdf");
  assert.ok(fs.existsSync(pdfPath), "PDF 落盘");
  const buffer = fs.readFileSync(pdfPath);
  assert.equal(countPdfPages(buffer), summary.pdfPages, "独立解析 PDF 页数一致");

  const metaPath = path.join(__dirname, "out", "source-doc-meta.json");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  assert.equal(meta.softwareName, "标月阅读编辑软件");
  assert.equal(meta.version, "V1.0");
  assert.equal(meta.pdfPages, meta.expectedPages);
});

test("3100 行 fixture 真实构建：恰好 60 页 PDF、首页入口文件、末页到文件尾", async () => {
  const files = memFixture();
  const { dir, configPath } = diskFixture(files, {
    entryFiles: ["src/entry.ts"],
    coreFiles: ["src/core.ts"],
  });
  const outDir = path.join(dir, "out");
  try {
    const summary = await buildSourceDoc(configPath, { outDir });
    assert.equal(summary.mode, "partial");
    assert.equal(summary.expectedPages, 60, "3100 行 fixture 恰好 60 页");
    assert.equal(summary.pdfPages, 60);
    assert.equal(summary.firstFile, "src/entry.ts", "首页为入口文件");
    assert.equal(summary.lastFile, "src/z.ts", "末页为字典序最后文件");

    const pdfPath = path.join(outDir, "source-doc.pdf");
    assert.ok(fs.existsSync(pdfPath));
    assert.equal(countPdfPages(fs.readFileSync(pdfPath)), 60);

    const meta = JSON.parse(fs.readFileSync(path.join(outDir, "source-doc-meta.json"), "utf8"));
    assert.equal(meta.firstFile, "src/entry.ts");
    assert.equal(meta.lastFile, "src/z.ts");
    assert.equal(meta.pdfPages, 60);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI 失败路径：去空行后 < 50 行 → 退出非零", () => {
  const files = { "src/a.ts": Array.from({ length: 30 }, (_, i) => `const a${i} = ${i};`).join("\n") + "\n" };
  const { dir, configPath } = diskFixture(files, { minLinesForPartial: 999999 });
  try {
    const r = spawnSync(process.execPath, [SCRIPT_PATH, "--config", configPath, "--out", path.join(dir, "out")], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0, "不足 50 行应失败退出");
    assert.match(r.stderr, /无法成册/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

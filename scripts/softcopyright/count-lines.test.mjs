// count-lines.mjs 与 lib/collect.mjs 的 node --test 测试（Node >= 22 内置，无新依赖）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectFiles, globToRegExp, matchesExclude } from "./lib/collect.mjs";
import { countFile, runCount } from "./count-lines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.join(__dirname, "fixtures", "sample");
const COUNT_SCRIPT = path.join(__dirname, "count-lines.mjs");

test("globToRegExp：受限 glob 模式匹配", () => {
  const testPattern = globToRegExp("**/*.test.ts");
  assert.equal(testPattern.test("x.test.ts"), true);
  assert.equal(testPattern.test("a/b/x.test.ts"), true);
  assert.equal(testPattern.test("x.test.tsx"), false);
  assert.equal(testPattern.test("foo.ts"), false);

  const testsDir = globToRegExp("**/__tests__/**");
  assert.equal(testsDir.test("__tests__/x.ts"), true);
  assert.equal(testsDir.test("src/__tests__/x.ts"), true);
  assert.equal(testsDir.test("src/x.ts"), false);
});

test("matchesExclude：命中任一排除 glob 即排除", () => {
  const globs = ["**/*.test.ts", "**/*.test.tsx", "**/*.test.mjs", "**/__tests__/**"];
  assert.equal(matchesExclude("x.test.ts", globs), true);
  assert.equal(matchesExclude("src/util.test.ts", globs), true);
  assert.equal(matchesExclude("src/util.ts", globs), false);
  assert.equal(matchesExclude("__tests__/a/b.ts", globs), true);
});

test("collectFiles：fixture 收集、过滤与确定性顺序", async () => {
  const files = await collectFiles({
    sourceRoots: [SAMPLE_DIR],
    includeExts: [".ts", ".tsx", ".rs", ".mjs", ".mts", ".css"],
    excludeGlobs: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.test.mjs"],
    entryFiles: [],
    baseDir: path.join(__dirname, "..", ".."),
  });
  const names = files.map((f) => path.basename(f.relPath));
  assert.deepEqual(names, ["editor.ts", "empty.ts", "lib.rs", "mixed.ts"]); // x.test.ts 被排除，字典序
});

test("collectFiles：entryFiles 置前", async () => {
  const files = await collectFiles({
    sourceRoots: [SAMPLE_DIR],
    includeExts: [".ts", ".rs"],
    excludeGlobs: ["**/*.test.ts"],
    entryFiles: ["scripts/softcopyright/fixtures/sample/mixed.ts"],
    baseDir: path.join(__dirname, "..", ".."),
  });
  assert.equal(path.basename(files[0].relPath), "mixed.ts");
  const rest = files.slice(1).map((f) => path.basename(f.relPath));
  assert.deepEqual(rest, ["editor.ts", "empty.ts", "lib.rs"]);
});

test("countFile：注释行判定按扩展名", () => {
  const ts = countFile("// line\n/* block\n * mid\n */\nconst a = 1;\n\n", "ts");
  assert.equal(ts.totalLines, 6);
  assert.equal(ts.nonEmptyLines, 5);
  assert.equal(ts.commentLines, 4);

  const mjs = countFile("# shebang\n// comment\n# hash comment\nconst b = 2;\n", "mjs");
  assert.equal(mjs.commentLines, 3);

  const css = countFile("/* block\n * mid\n */\n// not a comment\nbody {}\n", "css");
  assert.equal(css.commentLines, 3);
  assert.equal(css.nonEmptyLines, 5);

  const blankOnly = countFile("   \n\t\n\n", "ts");
  assert.equal(blankOnly.totalLines, 3);
  assert.equal(blankOnly.nonEmptyLines, 0);
});

test("runCount：fixture 统计 = 110 行 / full 判定 / WARN 触发", async () => {
  const warns = [];
  const result = await runCount({
    root: SAMPLE_DIR,
    io: { warn: (msg) => warns.push(msg) },
  });
  assert.equal(result.totalFiles, 4);
  assert.equal(result.totalNonEmptyLines, 110);
  assert.equal(result.totalCommentLines, 23);
  assert.equal(result.decision, "full");
  assert.equal(result.commentRatio, 0.2091);
  assert.equal(result.pages.mode, "full");
  assert.equal(result.pages.pages, 3);
  // 40 行文件注释占比 50% > 1/3，必须触发 WARN
  assert.ok(warns.length > 0, "期望 stderr WARN 被触发");
  assert.ok(warns.some((w) => w.includes("超过 1/3")));
  // topCommentFiles 占比最高的是 mixed.ts（50%）
  assert.equal(result.topCommentFiles[0].path.endsWith("mixed.ts"), true);
  assert.equal(result.topCommentFiles[0].commentRatio, 0.5);
});

test("runCount：测试文件被排除（x.test.ts 不计入）", async () => {
  const result = await runCount({ root: SAMPLE_DIR, io: { warn: () => {} } });
  assert.equal(result.files.some((f) => f.path.includes("x.test.ts")), false);
});

test("失败路径：3100 行 → decision=partial，front/back 各 30 页", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "softcopyright-partial-"));
  try {
    const bigLines = [];
    for (let i = 0; i < 3100; i++) bigLines.push("const line" + i + ": number = " + i + ";");
    await writeFile(path.join(tmpDir, "big.ts"), bigLines.join("\n") + "\n");

    const warns = [];
    const result = await runCount({ root: tmpDir, io: { warn: (m) => warns.push(m) } });
    assert.equal(result.totalNonEmptyLines, 3100);
    assert.equal(result.decision, "partial");
    assert.equal(result.pages.mode, "partial");
    assert.equal(result.pages.frontPages, 30);
    assert.equal(result.pages.backPages, 30);
    assert.equal(result.pages.frontLines, 1500); // 30 页 x 50 行/页
    assert.equal(result.pages.backLines, 1500);
    assert.equal(result.pages.pages, 62); // ceil(3100 / 50)
    assert.ok(result.pages.note.includes("前 30 页"));
    assert.ok(result.pages.note.includes("后 30 页"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("CLI：--root 输出合法 JSON，退出码 0，WARN 写入 stderr", () => {
  const stdout = execFileSync(process.execPath, [COUNT_SCRIPT, "--root", SAMPLE_DIR], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.totalNonEmptyLines, 110);
  assert.equal(parsed.decision, "full");
  assert.ok(parsed.topCommentFiles.length === 3);
  assert.ok("totalFiles" in parsed);
  assert.ok("commentRatio" in parsed);
});

test("CLI：失败路径（3100 行临时目录）→ partial 且退出码 0", async (t) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "softcopyright-cli-partial-"));
  t.after(() => rm(tmpDir, { recursive: true, force: true }));
  const bigLines = [];
  for (let i = 0; i < 3100; i++) bigLines.push("const line" + i + ": number = " + i + ";");
  await writeFile(path.join(tmpDir, "big.ts"), bigLines.join("\n") + "\n");

  const stdout = execFileSync(process.execPath, [COUNT_SCRIPT, "--root", tmpDir], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, "partial");
  assert.equal(parsed.pages.frontPages, 30);
  assert.equal(parsed.pages.backPages, 30);
});

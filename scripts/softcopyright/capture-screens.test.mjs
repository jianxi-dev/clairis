/**
 * 任务 3 测试：node --test scripts/softcopyright/capture-screens.test.mjs
 *
 * 覆盖：
 *  1. 场景清单覆盖 6 功能域且各 ≥1 场景（reading/editing/file-management/navigation/capture/application-shell）
 *  2. 场景 schema 合法（id/name/action/status，pending 有明确标注）
 *  3. 脚本语法检查
 *  4. 真实运行：≥1 个 ready 场景产出规范命名 PNG（<scene-id>-<yyyy-mm-dd>.png），
 *     JSON 报告可解析、每场景有明确状态、覆盖层 textContent 断言含 softwareName
 *  5. pending 场景不尝试截图（无 PNG 产出）
 *  6. 不可达场景记录为 failed 而非挂死，退出码仍为 0
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SCRIPT = path.join(__dirname, "capture-screens.mjs");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const SCENES_CFG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CONFIG.scenesFile), "utf8"));
const DOMAINS = ["reading", "editing", "file-management", "navigation", "capture", "application-shell"];

function runScript(configPath) {
  const res = spawnSync("node", [SCRIPT, "--config", configPath], {
    encoding: "utf8",
    timeout: 240000,
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function makeTempConfig(scenes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sc-capture-"));
  const shots = path.join(tmp, "shots");
  fs.mkdirSync(shots, { recursive: true });
  const cfg = { ...CONFIG, screenshotsDir: shots, scenesFile: path.join(tmp, "scenes.json") };
  fs.writeFileSync(cfg.scenesFile, JSON.stringify({ scenes }));
  const cfgPath = path.join(tmp, "config.json");
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  return { cfgPath, shots };
}

test("场景清单覆盖 6 功能域且各 ≥1 场景", () => {
  const scenes = SCENES_CFG.scenes;
  assert.ok(Array.isArray(scenes) && scenes.length >= 6, `scenes 至少 6 个，实际 ${scenes.length}`);
  for (const d of DOMAINS) {
    assert.ok(scenes.some((s) => s.domain === d), `缺少 ${d} 域场景`);
  }
});

test("场景 schema 合法（id/name/action/status）", () => {
  for (const s of SCENES_CFG.scenes) {
    assert.ok(s.id && typeof s.id === "string", `${JSON.stringify(s)} 缺少 id`);
    assert.ok(s.name && typeof s.name === "string", `${s.id} 缺少 name`);
    assert.ok(s.action && typeof s.action === "object", `${s.id} 缺少 action`);
    assert.ok(["ready", "pending"].includes(s.status), `${s.id} status 非法: ${s.status}`);
    if (s.status === "ready") {
      assert.ok(["openFile", "none"].includes(s.action.type), `${s.id} action.type 非法: ${s.action.type}`);
      assert.ok(Array.isArray(s.steps ?? []), `${s.id} steps 应为数组`);
    }
  }
});

test("capture-screens.mjs 语法检查", () => {
  const res = spawnSync("node", ["--check", SCRIPT], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
});

test(
  "真实运行：≥1 ready 场景产出规范命名 PNG，报告可解析且含覆盖层断言（含 softwareName）",
  { timeout: 300000 },
  () => {
    const res = runScript(path.join(__dirname, "config.json"));
    assert.equal(res.status, 0, `脚本退出码非 0：${res.stderr}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.softwareName, CONFIG.softwareName);
    assert.equal(report.version, CONFIG.version);
    assert.ok(report.scenes.length >= 6, `场景数不足：${report.scenes.length}`);
    assert.ok(report.summary && report.summary.total === report.scenes.length, "summary 与场景数一致");

    const success = report.scenes.filter((s) => s.status === "success");
    assert.ok(success.length >= 1, `至少 1 个 ready 场景成功，实际 ${success.length}`);

    for (const s of success) {
      assert.ok(s.screenshot && fs.existsSync(s.screenshot), `${s.id} 截图不存在: ${s.screenshot}`);
      const base = path.basename(s.screenshot);
      assert.match(
        base,
        new RegExp(`^${s.id}-\\d{4}-\\d{2}-\\d{2}\\.png$`),
        `文件名不合规范: ${base}`,
      );
      assert.ok(s.overlay?.asserted === true, `${s.id} 覆盖层断言未通过`);
      assert.ok(
        s.overlay.expected.includes(CONFIG.softwareName),
        `${s.id} 覆盖层期望文本不含 softwareName`,
      );
    }

    // 每场景有明确状态
    for (const s of report.scenes) {
      assert.ok(["success", "failed", "pending"].includes(s.status), `${s.id} 状态不明: ${s.status}`);
    }
    // 真实清单中 pending 场景（如有）不应有截图
    for (const s of report.scenes.filter((x) => x.status === "pending")) {
      assert.equal(s.screenshot, null, `${s.id} pending 场景不应有截图`);
    }
  },
);

test("pending 场景不尝试截图", { timeout: 180000 }, () => {
  const { cfgPath, shots } = makeTempConfig([
    {
      id: "pending-only",
      name: "仅 pending",
      domain: "capture",
      status: "pending",
      action: { type: "none" },
      steps: [],
    },
  ]);
  const res = runScript(cfgPath);
  assert.equal(res.status, 0, res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.scenes.length, 1);
  assert.equal(report.scenes[0].status, "pending");
  assert.equal(fs.readdirSync(shots).length, 0, "pending 场景不应产生任何截图文件");
});

test("不可达场景记录为 failed 而非挂死，退出码仍为 0", { timeout: 180000 }, () => {
  const { cfgPath, shots } = makeTempConfig([
    {
      id: "unreachable-step",
      name: "不可达步骤场景",
      domain: "reading",
      status: "ready",
      action: {
        type: "openFile",
        path: "/Users/test/不可达.md",
        content: "# 内容",
        title: "不可达.md",
      },
      steps: [{ op: "click", role: "button", name: "界面中绝不存在的按钮", exact: true }],
    },
  ]);
  const res = runScript(cfgPath);
  assert.equal(res.status, 0, "场景失败不应导致脚本退出码非 0");
  const report = JSON.parse(res.stdout);
  assert.equal(report.scenes[0].status, "failed");
  assert.ok(report.scenes[0].error, "failed 场景应记录错误信息");
  assert.equal(fs.readdirSync(shots).length, 0, "failed 场景不应产出截图");
});

#!/usr/bin/env node
/**
 * check-pele-upstream.mjs — 检查 pele 上游是否有新版本（design D9）。
 *
 * 退出码：
 *   0  本地已是最新版本
 *   10 上游存在更新版本（供 CI 开 issue）
 *   1  运行错误（读不到本地版本 / npm view 失败 / 输出无法解析）
 *
 * 用法：node scripts/check-pele-upstream.mjs
 * 无新增依赖，仅用 Node 内置模块；macOS / Linux 均可运行。
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NPM_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[pele-upstream] 错误：${message}`);
}

/** 解析 semver（容错 v 前缀与缺省 patch）。 */
function parseVersion(raw) {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-.]([0-9A-Za-z.-]+))?/.exec(
    String(raw).trim(),
  );
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
    prerelease: match[4] ?? '',
  };
}

/** a > b 返回正数，a < b 返回负数，相等返回 0。 */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) return pa[key] - pb[key];
  }
  // 预发布版本低于同主版本（1.2.3-beta < 1.2.3）
  if (pa.prerelease === pb.prerelease) return 0;
  if (pa.prerelease === '') return 1;
  if (pb.prerelease === '') return -1;
  return pa.prerelease < pb.prerelease ? -1 : 1;
}

/**
 * 本地 pele 版本：优先 node_modules 实际安装版本，其次 package.json 的依赖范围。
 * 返回 null 表示读取失败（已打印错误）。
 */
function readLocalVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'node_modules', 'pele', 'package.json'), 'utf8'),
    );
    if (typeof pkg.version === 'string' && pkg.version.trim()) {
      return { version: pkg.version.trim(), source: 'node_modules/pele' };
    }
  } catch {
    // 未安装时回退到 package.json 范围
  }

  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const range = pkg.dependencies && pkg.dependencies.pele;
    if (typeof range === 'string' && range.trim()) {
      return {
        version: range.replace(/^[\^~>=<\s]+/, '').trim(),
        source: 'package.json range',
      };
    }
  } catch (err) {
    fail(`无法读取 package.json：${err.message}`);
    return null;
  }

  fail('本地未找到 pele 版本（node_modules/pele/package.json 与 package.json 均不可用）');
  return null;
}

/** 查询 npm registry 上的最新版本；返回 null 表示查询失败（已打印错误）。 */
function readLatestVersion() {
  const result = spawnSync('npm', ['view', 'pele', 'version'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: NPM_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error) {
    fail(`执行 npm view 失败：${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    fail(
      `npm view pele version 失败（退出码 ${result.status}）：${(result.stderr || '').trim()}`,
    );
    return null;
  }
  const latest = (result.stdout || '').trim();
  if (!parseVersion(latest)) {
    fail(`无法解析上游版本输出：${JSON.stringify(latest)}`);
    return null;
  }
  return latest;
}

const local = readLocalVersion();
if (!local) {
  process.exitCode = 1;
} else {
  const latest = readLatestVersion();
  if (!latest) {
    process.exitCode = 1;
  } else {
    console.log(`本地 pele 版本：${local.version}（来源：${local.source}）`);
    console.log(`上游 pele 版本：${latest}`);
    if (compareVersions(latest, local.version) > 0) {
      console.error(`[pele-upstream] 发现新版本：${local.version} → ${latest}`);
      process.exitCode = 10;
    } else {
      console.log('[pele-upstream] 已是最新版本。');
    }
  }
}

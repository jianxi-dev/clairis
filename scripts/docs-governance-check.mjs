#!/usr/bin/env node
/**
 * docs-governance-check.mjs — Clairis 文档治理检查器（任务 5）
 *
 * 默认只读。单一入口。用 unified + remark-parse + remark-frontmatter 构建
 * Markdown AST 并用 yaml 解析 frontmatter；严禁用正则替代 Markdown 语法解析链接。
 *
 * 用法：
 *   node scripts/docs-governance-check.mjs --fixture <dir>     检查指定夹具目录
 *   node scripts/docs-governance-check.mjs --root [--root-dir <dir>]  检查真实仓库（任务 14 用）
 *   node scripts/docs-governance-check.mjs ... --out <file>    JSON 写入文件（人类摘要仍在 stderr）
 *   node scripts/docs-governance-check.mjs --quiet             仅 JSON，省略 stderr 人类摘要
 *
 * 退出码：0 = 全部通过；1 = 存在违例；2 = 运行错误（目录缺失 / 参数错误）。
 *
 * JSON 到 stdout（或 --out），人类摘要到 stderr，保证 stdout 始终是可机读 JSON。
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// 元数据契约（硬编码常量，必须与治理契约完全一致，不得增删；不运行时读取文件）
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = Object.freeze(['title', 'type', 'status', 'last_updated']);

const TYPE_ENUM = Object.freeze([
  'product',
  'design',
  'architecture',
  'adr',
  'research',
  'delivery',
  'guide',
  'archive',
]);

const STATUS_ENUM = Object.freeze([
  'draft',
  'in-review',
  'accepted',
  'implemented',
  'deprecated',
  'superseded',
  'archived',
]);

const SOURCE_OF_TRUTH_ENUM = Object.freeze(['canonical', 'supporting', 'historical']);
const DEFAULT_SOURCE_OF_TRUTH = 'supporting';
const ARCHIVE_STATUSES = Object.freeze(['superseded', 'archived']);
const MANIFEST_FILE = 'manifest.json';

// 旧路径（legacy-paths）。匹配用纯字符串操作，绝不用正则。
const LEGACY_EXACT_TARGETS = Object.freeze(['docs/architecture.md', 'plan.md']);
const LEGACY_DIR_SEGMENTS = Object.freeze(['doc']);

// 规则 ID（固定）
const RULE = Object.freeze({
  inventory: 'inventory',
  frontmatter: 'frontmatter',
  relativeLinks: 'relative-links',
  canonicalUniqueness: 'canonical-uniqueness',
  archivePlacement: 'archive-placement',
  legacyPaths: 'legacy-paths',
});

// ---------------------------------------------------------------------------
// 参数解析
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    mode: null,
    rootDir: null,
    out: null,
    quiet: false,
    help: false,
    // 门禁（任务 14）相关
    repoRoot: null,
    allowlist: null,
    fixturesRoot: null,
    skipOpenspec: false,
    openspecBin: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--fixture') {
      args.mode = 'fixture';
      args.rootDir = argv[++i];
    } else if (a === '--root') {
      args.mode = 'root';
    } else if (a === '--root-dir') {
      args.rootDir = argv[++i];
    } else if (a === '--gate') {
      args.mode = 'gate';
    } else if (a === '--repo') {
      args.repoRoot = argv[++i];
    } else if (a === '--allowlist') {
      args.allowlist = argv[++i];
    } else if (a === '--fixtures') {
      args.fixturesRoot = argv[++i];
    } else if (a === '--openspec-bin') {
      args.openspecBin = argv[++i];
    } else if (a === '--skip-openspec') {
      args.skipOpenspec = true;
    } else if (a === '--out') {
      args.out = argv[++i];
    } else if (a === '--quiet' || a === '-q') {
      args.quiet = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error(`未知参数: ${a}`);
    }
  }
  return args;
}

const HELP = `docs-governance-check.mjs — Clairis 文档治理检查器（只读）

用法:
  --fixture <dir>          检查指定夹具目录
  --root                   检查真实仓库（默认 root-dir 为进程 cwd）
  --root-dir <dir>         指定仓库根（配合 --root）
  --gate                   全库文档治理门禁（任务 14）：强校验段 + needs-review 报告段
  --repo <dir>             门禁的仓库根（配合 --gate，默认进程 cwd）
  --allowlist <file>       intentional-history 登记表路径（配合 --gate，默认任务 12 登记表）
  --fixtures <dir>         夹具根目录（配合 --gate，默认 scripts/fixtures/docs-governance）
  --openspec-bin <path>    openspec 可执行文件路径（配合 --gate）
  --skip-openspec          门禁跳过 openspec validate（仅测试用）
  --out <file>             将 JSON 报告写入文件（默认输出到 stdout）
  --quiet, -q              省略 stderr 人类摘要
  --help, -h               显示本帮助

六项检查（规则 ID 固定）:
  inventory            清单覆盖：manifest 所列文件必须存在；活树文件须被清单收录（无孤儿）
  frontmatter          必需字段 title/type/status/last_updated；type/status/source_of_truth 枚举；
                       superseded_by 仅在 status=superseded 时必填
  relative-links       Markdown 相对链接指向的目标必须存在
  canonical-uniqueness 同一主题（标题）至多一个 source_of_truth=canonical
  archive-placement    status=superseded/archived 的文档必须位于 archive/ 或声明 redirect
  legacy-paths         不得引用旧路径（docs/ARCHITECTURE.md、旧 doc/ 目录、根目录 PLAN.md 活入口）

门禁（--gate）强校验段（任一失败→退出非零）:
  (a) 夹具套件   6 valid→exit0、6 invalid→exit1 且命中对应规则、2 QA（malformed 不崩溃、misleading 检出）
  (b) 已治理域   内容文档过 frontmatter+archive-placement；全子集过 relative-links+canonical+legacy(登记表降级)
                 README 索引文件与 openspec/ 豁免 frontmatter/archive-placement（由其他门校验）
  (c) allowlist   intentional-history 登记表存在且可载入
  (d) openspec    openspec validate --all 退出 0
needs-review 报告段: INFO，仅输出统计与迁移账本核对，不影响退出码。

退出码: 0 全部通过 | 1 存在违例 | 2 运行错误`;

// ---------------------------------------------------------------------------
// 文件系统遍历（只读）
// ---------------------------------------------------------------------------
function isMarkdownFile(name) {
  return name.endsWith('.md') || name.endsWith('.markdown');
}

function listMarkdownFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name.startsWith('.git')) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && isMarkdownFile(name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Markdown 解析（AST，禁止正则解析链接）
// ---------------------------------------------------------------------------
const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']);

/**
 * 返回 { ast, frontmatter: { present, ok, data, error } }
 * frontmatter YAML 语法损坏时 ok=false 且 error 记录原因，绝不抛到上层（不崩溃）。
 */
function parseMarkdown(content) {
  const ast = processor.parse(content);
  const frontmatter = { present: false, ok: false, data: null, error: null };
  const yamlNode = (ast.children || []).find((n) => n.type === 'yaml');
  if (yamlNode) {
    frontmatter.present = true;
    try {
      const data = parseYaml(yamlNode.value, { prettyErrors: false });
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        frontmatter.ok = true;
        frontmatter.data = data;
      } else {
        frontmatter.error = 'frontmatter 不是 YAML 映射（mapping）';
      }
    } catch (err) {
      frontmatter.error = `frontmatter YAML 解析失败: ${err.message.split('\n')[0]}`;
    }
  }
  return { ast, frontmatter };
}

/** 通过 AST 收集相对链接目标（link / image / definition 节点的 url）。 */
function collectLinks(ast) {
  const links = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
      typeof node.url === 'string'
    ) {
      links.push({ url: node.url, line: node.position ? node.position.start.line : null });
    }
    for (const child of node.children || []) visit(child);
  };
  visit(ast);
  return links;
}

/** 判断是否为需校验存在性的相对链接。纯字符串判断，不用正则。 */
function isRelativeTarget(url) {
  if (!url) return false;
  if (url.startsWith('#')) return false; // 页内锚点
  if (url.startsWith('/')) return false; // 绝对路径（站点根），不在夹具范围
  if (url.startsWith('mailto:')) return false;
  const colon = url.indexOf(':');
  const slash = url.indexOf('/');
  // 形如 http:// https:// tel: 等协议（协议出现在第一个斜杠之前）
  if (colon !== -1 && (slash === -1 || colon < slash)) return false;
  return true;
}

/** 去掉锚点/查询片段后取目标路径。纯字符串操作。 */
function stripFragment(url) {
  const hash = url.indexOf('#');
  const q = url.indexOf('?');
  let end = url.length;
  if (hash !== -1) end = Math.min(end, hash);
  if (q !== -1) end = Math.min(end, q);
  return url.slice(0, end);
}

function normalizeKey(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// 检查实现
// ---------------------------------------------------------------------------
function makeViolation(rule, path, message, extra) {
  return { rule, path, message, ...(extra || {}) };
}

/** inventory：清单覆盖 + 无孤儿/悬空引用。 */
function checkInventory(rootDir, mdFiles) {
  const violations = [];
  const manifestPath = join(rootDir, MANIFEST_FILE);
  let manifest = null;
  if (!existsSync(manifestPath)) {
    violations.push(
      makeViolation(
        RULE.inventory,
        MANIFEST_FILE,
        `缺少清单文件 ${MANIFEST_FILE}（无法证明文档覆盖）`,
      ),
    );
    return violations;
  }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    violations.push(
      makeViolation(RULE.inventory, MANIFEST_FILE, `清单 JSON 解析失败: ${err.message}`),
    );
    return violations;
  }
  const listed = Array.isArray(manifest.files) ? manifest.files : null;
  if (!listed) {
    violations.push(
      makeViolation(RULE.inventory, MANIFEST_FILE, '清单缺少 files 数组'),
    );
    return violations;
  }

  const listedSet = new Set();
  // 悬空引用：清单所列文件必须存在。
  for (const entry of listed) {
    if (typeof entry !== 'string') {
      violations.push(makeViolation(RULE.inventory, MANIFEST_FILE, `清单条目不是字符串: ${entry}`));
      continue;
    }
    const norm = posix.normalize(entry.split(join('/', '')).join('/'));
    listedSet.add(norm);
    if (!existsSync(resolve(rootDir, entry))) {
      violations.push(
        makeViolation(RULE.inventory, entry, `清单引用了不存在的文件（悬空引用）`),
      );
    }
  }

  // 孤儿：活树中存在的 .md 文件须被清单收录。
  for (const md of mdFiles) {
    const rel = posix.normalize(relative(rootDir, md).split(join('/', '')).join('/'));
    if (!listedSet.has(rel)) {
      violations.push(
        makeViolation(RULE.inventory, rel, '活树文件未被清单收录（孤儿文件）'),
      );
    }
  }
  return violations;
}

/** frontmatter：必需字段 / 枚举 / superseded_by 契约。 */
function checkFrontmatter(rootDir, docs) {
  const violations = [];
  for (const doc of docs) {
    const rel = toRel(rootDir, doc.path);
    const fm = doc.frontmatter;
    if (!fm.present) {
      violations.push(makeViolation(RULE.frontmatter, rel, '缺少 frontmatter'));
      continue;
    }
    if (!fm.ok) {
      violations.push(makeViolation(RULE.frontmatter, rel, fm.error || 'frontmatter 无效'));
      continue;
    }
    const data = fm.data;
    // 必需字段恰好 4 个。
    for (const field of REQUIRED_FIELDS) {
      const v = data[field];
      if (v === undefined || v === null || String(v).trim() === '') {
        violations.push(
          makeViolation(RULE.frontmatter, rel, `缺少必需字段: ${field}`),
        );
      }
    }
    // 枚举校验。
    if (data.type !== undefined && !TYPE_ENUM.includes(data.type)) {
      violations.push(
        makeViolation(
          RULE.frontmatter,
          rel,
          `非法 type 枚举值: ${JSON.stringify(data.type)}（允许: ${TYPE_ENUM.join(', ')}）`,
        ),
      );
    }
    if (data.status !== undefined && !STATUS_ENUM.includes(data.status)) {
      violations.push(
        makeViolation(
          RULE.frontmatter,
          rel,
          `非法 status 枚举值: ${JSON.stringify(data.status)}（允许: ${STATUS_ENUM.join(', ')}）`,
        ),
      );
    }
    if (
      data.source_of_truth !== undefined &&
      data.source_of_truth !== null &&
      !SOURCE_OF_TRUTH_ENUM.includes(data.source_of_truth)
    ) {
      violations.push(
        makeViolation(
          RULE.frontmatter,
          rel,
          `非法 source_of_truth 枚举值: ${JSON.stringify(
            data.source_of_truth,
          )}（允许: ${SOURCE_OF_TRUTH_ENUM.join(', ')}）`,
        ),
      );
    }
    // superseded_by 契约。
    const isSuperseded = data.status === 'superseded';
    const hasSupersededBy =
      data.superseded_by !== undefined &&
      data.superseded_by !== null &&
      String(data.superseded_by).trim() !== '';
    if (isSuperseded && !hasSupersededBy) {
      violations.push(
        makeViolation(RULE.frontmatter, rel, 'status=superseded 时必须提供 superseded_by'),
      );
    }
    if (!isSuperseded && hasSupersededBy) {
      violations.push(
        makeViolation(RULE.frontmatter, rel, 'superseded_by 仅在 status=superseded 时允许'),
      );
    }
  }
  return violations;
}

/** relative-links：相对链接目标必须存在。 */
function checkRelativeLinks(rootDir, docs) {
  const violations = [];
  for (const doc of docs) {
    const rel = toRel(rootDir, doc.path);
    const base = dirname(doc.path);
    for (const link of doc.links) {
      if (!isRelativeTarget(link.url)) continue;
      const target = stripFragment(link.url);
      if (target === '') continue; // 纯锚点
      const abs = resolve(base, decodeURIComponentSafe(target));
      if (!existsSync(abs)) {
        violations.push(
          makeViolation(
            RULE.relativeLinks,
            rel,
            `相对链接指向不存在的目标: ${link.url}`,
            { target: link.url, line: link.line },
          ),
        );
      }
    }
  }
  return violations;
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** canonical-uniqueness：同一主题（标题）至多一个 canonical。 */
function checkCanonicalUniqueness(rootDir, docs) {
  const violations = [];
  const byTitle = new Map();
  for (const doc of docs) {
    const fm = doc.frontmatter;
    if (!fm.ok) continue; // frontmatter 已单独报告，跳过
    const data = fm.data;
    const sot = data.source_of_truth || DEFAULT_SOURCE_OF_TRUTH;
    if (sot !== 'canonical') continue;
    const key = normalizeKey(data.title);
    if (key === '') continue;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(toRel(rootDir, doc.path));
  }
  for (const [title, paths] of byTitle) {
    if (paths.length > 1) {
      violations.push(
        makeViolation(
          RULE.canonicalUniqueness,
          paths[0],
          `主题「${title}」存在 ${paths.length} 个 source_of_truth=canonical 文档`,
          { duplicatePaths: paths, title },
        ),
      );
    }
  }
  return violations;
}

/** archive-placement：superseded/archived 文档须在 archive/ 或声明 redirect。 */
function checkArchivePlacement(rootDir, docs) {
  const violations = [];
  for (const doc of docs) {
    const fm = doc.frontmatter;
    if (!fm.ok) continue;
    const data = fm.data;
    if (!ARCHIVE_STATUSES.includes(data.status)) continue;
    const rel = toRel(rootDir, doc.path);
    const segments = rel.split('/').filter(Boolean);
    const inArchive = segments.some((seg) => seg === 'archive');
    const hasRedirect =
      data.redirect !== undefined &&
      data.redirect !== null &&
      String(data.redirect).trim() !== '';
    if (!inArchive && !hasRedirect) {
      violations.push(
        makeViolation(
          RULE.archivePlacement,
          rel,
          `status=${data.status} 的文档位于活树位置，应移入 archive/ 或声明 redirect`,
          { status: data.status },
        ),
      );
    }
  }
  return violations;
}

/** legacy-paths：引用旧路径（基于 AST 链接 url 的纯字符串匹配，不用正则）。 */
function checkLegacyPaths(rootDir, docs) {
  const violations = [];
  for (const doc of docs) {
    const rel = toRel(rootDir, doc.path);
    const base = dirname(doc.path);
    for (const link of doc.links) {
      const target = stripFragment(link.url);
      if (target === '') continue;
      const decoded = decodeURIComponentSafe(target);
      const asPosix = decoded.split(join('/', '')).join('/').replace(/^\.?\//, '');
      const abs = isRelativeTarget(link.url) ? resolve(base, decoded) : null;

      // 旧 doc/ 目录（任意 doc/ 段），或精确命中旧入口，或根目录 PLAN.md 活入口。
      const segs = asPosix.split('/').filter(Boolean);
      const hitsLegacyDir = segs.some((seg, idx) =>
        LEGACY_DIR_SEGMENTS.includes(seg.toLowerCase()) && idx < segs.length - 1,
      );
      const lowerNorm = normalizeKey(asPosix);
      const hitsExact = LEGACY_EXACT_TARGETS.includes(lowerNorm);

      // 根目录 PLAN.md 作为活入口：解析后位于 rootDir 直接子级且基名为 plan.md。
      let hitsRootPlan = false;
      if (abs) {
        const absPosix = abs.split(join('/', '')).join('/');
        const relToRoot = absPosix.startsWith(rootDir)
          ? absPosix.slice(rootDir.length).replace(/^\//, '')
          : null;
        if (relToRoot && normalizeKey(relToRoot) === 'plan.md') hitsRootPlan = true;
      }

      if (hitsLegacyDir || hitsExact || hitsRootPlan) {
        violations.push(
          makeViolation(
            RULE.legacyPaths,
            rel,
            `引用了旧路径: ${link.url}`,
            { target: link.url },
          ),
        );
      }
    }
  }
  return violations;
}

function toRel(rootDir, fullPath) {
  return posix.normalize(relative(rootDir, fullPath).split(join('/', '')).join('/'));
}

// ---------------------------------------------------------------------------
// 全库文档治理门禁（任务 14）
// ---------------------------------------------------------------------------

/** 已治理域强校验子集（相对仓库根）：已迁移/已裁定的文档。 */
const GOVERNED_DIRS = Object.freeze([
  'docs/product',
  'docs/delivery',
  'docs/architecture',
  'docs/research',
  'docs/design/approved',
  'docs/design/explorations',
  'docs/design/system',
  'openspec/specs',
]);
const GOVERNED_FILES = Object.freeze([
  'docs/MIGRATION-REPORT.md',
  'docs/MIGRATION-MAP.md',
  'docs/GOVERNANCE.md',
  'docs/README.md',
]);
/** intentional-history 登记表默认路径（任务 12 交付物）。 */
const DEFAULT_ALLOWLIST_REL =
  '.omo/evidence/ulw/clairis-doc-governance/task-12/intentional-history-allowlist.json';

function toPosixRel(p) {
  return posix.normalize(String(p == null ? '' : p).split(join('/', '')).join('/'));
}

/**
 * 治理 frontmatter / archive-placement 契约豁免的参考类文档（相对仓库根）。
 * docs/MIGRATION-MAP.md 为迁移账本/参考文档（纯表格账册，登记表以 token:"*" 整文件登记），
 * 与 README 索引、openspec 制品同属非内容文档：不承载权威/生命周期元数据，
 * 强加治理 frontmatter 既属『预存问题』又会扰动账本字节稳定性，故豁免。
 * 这些文档仍受 relative-links / canonical-uniqueness / legacy-paths 约束。
 */
const FRONTMATTER_EXEMPT_REFS = Object.freeze(['docs/migration-map.md']);

/**
 * 豁免治理 frontmatter / archive-placement 契约的路径（但仍受 relative-links / canonical / legacy 约束）：
 *  - 任意 README 索引文件（导航/索引，非治理制品）；
 *  - openspec/ 下文档（其完整性由 openspec validate 校验，格式由 OpenSpec 规范约束，
 *    强加治理 frontmatter 会破坏 openspec validate）；
 *  - FRONTMATTER_EXEMPT_REFS 登记的参考/账本文档（如迁移账本）。
 */
function isFrontmatterExempt(relPath) {
  const rel = toPosixRel(relPath);
  const base = (rel.split('/').pop() || '').toLowerCase();
  if (base === 'readme.md') return true;
  if (rel === 'openspec' || rel.startsWith('openspec/')) return true;
  if (FRONTMATTER_EXEMPT_REFS.includes(rel.toLowerCase())) return true;
  return false;
}

function parseDocs(rootDir, filePaths) {
  return filePaths.map((path) => {
    const content = readFileSync(path, 'utf8');
    const { ast, frontmatter } = parseMarkdown(content);
    return { path, links: collectLinks(ast), frontmatter };
  });
}

/** 载入 intentional-history 登记表（任务 12）。只读，载入失败不抛。 */
function loadAllowlist(file) {
  try {
    if (!existsSync(file)) {
      return { ok: false, entries: [], path: file, error: `allowlist 不存在: ${file}` };
    }
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!data || !Array.isArray(data.entries)) {
      return { ok: false, entries: [], path: file, error: 'allowlist 缺少 entries 数组' };
    }
    for (const e of data.entries) {
      if (!e || typeof e.file !== 'string' || typeof e.token !== 'string') {
        return {
          ok: false,
          entries: [],
          path: file,
          error: `allowlist 条目缺少 file/token 字符串字段: ${JSON.stringify(e)}`,
        };
      }
    }
    return { ok: true, entries: data.entries, path: file, error: null };
  } catch (err) {
    return { ok: false, entries: [], path: file, error: `allowlist 载入失败: ${err.message}` };
  }
}

/**
 * 将登记表命中的 legacy-paths 违例降级为 allowlisted-historical（不计入门禁）。
 * 匹配口径：entry.file == 违例文件（或 '*'），且 entry.token == 链接目标（归一化比较，或 '*'）。
 * 返回 { kept, downgraded }。
 */
function applyAllowlistToLegacy(legacyViolations, entries) {
  const kept = [];
  const downgraded = [];
  const list = Array.isArray(entries) ? entries : [];
  for (const v of legacyViolations) {
    const pathNorm = toPosixRel(v.path);
    const targetRaw = v.target != null ? String(v.target) : '';
    const targetDec = decodeURIComponentSafe(stripFragment(targetRaw));
    const targetNorm = toPosixRel(targetDec.replace(/^\.?\//, ''));
    const hit = list.some((e) => {
      const fileNorm = toPosixRel(e.file);
      if (e.file !== '*' && fileNorm !== pathNorm) return false;
      if (e.token === '*') return true;
      const tokNorm = toPosixRel(decodeURIComponentSafe(e.token).replace(/^\.?\//, ''));
      return tokNorm === targetNorm || toPosixRel(e.token) === toPosixRel(targetRaw);
    });
    if (hit) downgraded.push({ ...v, allowlisted: true });
    else kept.push(v);
  }
  return { kept, downgraded };
}

/**
 * 已治理域强校验。内容文档须过 frontmatter + archive-placement；全子集须过
 * relative-links + canonical-uniqueness + legacy-paths（登记表降级后须为 0）。
 * 可通过 opts.governedDirs / opts.governedFiles 覆盖（测试夹具用）。
 */
function runGoverned(repoRoot, allowlistEntries, opts) {
  const options = opts || {};
  const govDirs = options.governedDirs || GOVERNED_DIRS;
  const govFiles = options.governedFiles == null ? GOVERNED_FILES : options.governedFiles;

  const files = new Set();
  for (const d of govDirs) {
    const abs = resolve(repoRoot, d);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      for (const f of listMarkdownFiles(abs)) files.add(f);
    }
  }
  for (const f of govFiles) {
    const abs = resolve(repoRoot, f);
    if (existsSync(abs) && statSync(abs).isFile()) files.add(abs);
  }

  const sorted = [...files].sort();
  const allDocs = parseDocs(repoRoot, sorted);
  const contentDocs = allDocs.filter((doc) => !isFrontmatterExempt(toRel(repoRoot, doc.path)));

  const violations = [
    ...checkFrontmatter(repoRoot, contentDocs),
    ...checkArchivePlacement(repoRoot, contentDocs),
    ...checkRelativeLinks(repoRoot, allDocs),
    ...checkCanonicalUniqueness(repoRoot, contentDocs),
  ];

  const legacyRaw = checkLegacyPaths(repoRoot, allDocs);
  const { kept, downgraded } = applyAllowlistToLegacy(legacyRaw, allowlistEntries);
  violations.push(...kept);

  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] || 0) + 1;

  return {
    ok: violations.length === 0,
    repoRoot,
    filesScanned: sorted.length,
    contentFiles: contentDocs.length,
    exemptFiles: sorted.length - contentDocs.length,
    governedDirs: [...govDirs],
    violations,
    legacyDowngraded: downgraded,
    byRule,
  };
}

// 夹具名 → 期望命中的规则 ID（valid/invalid 各 6 个夹具同名）。
const FIXTURE_NAMES = Object.freeze([
  'inventory',
  'frontmatter',
  'relative-links',
  'canonical-uniqueness',
  'archive-placement',
  'legacy-paths',
]);
const FIXTURE_EXPECTED_RULE = Object.freeze({
  'inventory': RULE.inventory,
  'frontmatter': RULE.frontmatter,
  'relative-links': RULE.relativeLinks,
  'canonical-uniqueness': RULE.canonicalUniqueness,
  'archive-placement': RULE.archivePlacement,
  'legacy-paths': RULE.legacyPaths,
});

function runOneFixture(fixturesRoot, category, name) {
  const dir = resolve(fixturesRoot, category, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { category, name, ok: false, reason: 'fixture 目录不存在', exitCode: 2, report: null };
  }
  try {
    const report = run({ mode: 'fixture', rootDir: dir });
    return { category, name, ok: true, exitCode: report.ok ? 0 : 1, report, reason: null };
  } catch (err) {
    return { category, name, ok: false, reason: `运行崩溃: ${err.message}`, exitCode: 2, report: null };
  }
}

/**
 * 夹具套件强校验：
 *  - 6 valid → exit 0；
 *  - 6 invalid → exit 1 且命中对应规则；
 *  - QA malformed-frontmatter → 不得崩溃（退出码 ∈ {0,1}，不得为 2）；
 *  - QA misleading-broken-link → 检出 relative-links 违例（exit 1）。
 */
function runFixtureSuite(fixturesRoot) {
  const results = [];
  for (const name of FIXTURE_NAMES) {
    const r = runOneFixture(fixturesRoot, 'valid', name);
    r.expect = 'exit0';
    r.pass = r.exitCode === 0;
    results.push(r);
  }
  for (const name of FIXTURE_NAMES) {
    const expectedRule = FIXTURE_EXPECTED_RULE[name];
    const r = runOneFixture(fixturesRoot, 'invalid', name);
    r.expect = `exit1+${expectedRule}`;
    r.expectedRule = expectedRule;
    r.pass =
      r.exitCode === 1 &&
      !!r.report &&
      (r.report.summary.byRule[expectedRule] || 0) > 0;
    results.push(r);
  }
  {
    const r = runOneFixture(fixturesRoot, 'qa', 'malformed-frontmatter');
    r.expect = 'no-crash(exit0|1)';
    r.pass = r.exitCode === 0 || r.exitCode === 1;
    results.push(r);
  }
  {
    const r = runOneFixture(fixturesRoot, 'qa', 'misleading-broken-link');
    r.expect = 'exit1+relative-links';
    r.pass =
      r.exitCode === 1 &&
      !!r.report &&
      (r.report.summary.byRule[RULE.relativeLinks] || 0) > 0;
    results.push(r);
  }
  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, total: results.length, results, failed };
}

/** 运行 `openspec validate --all`。按优先级依次尝试候选可执行文件，找不到/失败均返回结构化结果（不抛）。 */
function runOpenSpec(repoRoot, preferredBin) {
  const candidates = [];
  if (preferredBin) candidates.push(preferredBin);
  if (process.env.OPENSPEC_BIN) candidates.push(process.env.OPENSPEC_BIN);
  candidates.push('openspec');
  candidates.push(join(process.env.HOME || '', '.local', 'bin', 'openspec'));

  let last = null;
  for (const cmd of candidates) {
    if (cmd.includes('/') && !existsSync(cmd)) {
      last = { ok: false, command: `${cmd} validate --all`, exitCode: 2, stdout: '', stderr: '', error: `可执行文件不存在: ${cmd}` };
      continue;
    }
    const res = spawnSync(cmd, ['validate', '--all'], { cwd: repoRoot, encoding: 'utf8' });
    if (res.error && res.error.code === 'ENOENT') {
      last = { ok: false, command: `${cmd} validate --all`, exitCode: 2, stdout: '', stderr: '', error: `未找到可执行文件: ${cmd}` };
      continue;
    }
    const exitCode = res.status == null ? 2 : res.status;
    return {
      ok: exitCode === 0,
      command: `${cmd} validate --all`,
      exitCode,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
      error: res.error ? res.error.message : null,
    };
  }
  return last || { ok: false, command: 'openspec validate --all', exitCode: 2, stdout: '', stderr: '', error: '无可用 openspec' };
}

/** 解析 MIGRATION-MAP.md 的 needs-review 动作行数（账本条目数），并做独立交叉核对。 */
function parseMigrationMapNeedsReview(repoRoot) {
  const mapPath = resolve(repoRoot, 'docs/MIGRATION-MAP.md');
  if (!existsSync(mapPath)) {
    return { ok: false, error: 'docs/MIGRATION-MAP.md 不存在', entries: 0, crossCheck: 0, consistent: false, currentPaths: [] };
  }
  const lines = readFileSync(mapPath, 'utf8').split('\n');
  let methodA = 0; // 精确动作单元 == `needs-review`
  let methodB = 0; // 含 `needs-review` token 的数据行（交叉核对）
  const currentPaths = [];
  for (const ln of lines) {
    const t = ln.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.some((c) => /^:?-+:?$/.test(c))) continue; // 分隔行
    if (cells.some((c) => c === 'current_path' || c === 'action')) continue; // 表头行
    const hasExact = cells.includes('`needs-review`');
    const hasToken = t.includes('`needs-review`');
    if (hasExact) {
      methodA += 1;
      currentPaths.push(cells[0]);
    }
    if (hasToken) methodB += 1;
  }
  return { ok: true, error: null, entries: methodA, crossCheck: methodB, consistent: methodA === methodB, currentPaths };
}

/** 统计 docs/ 工作区中无有效 frontmatter 的 Markdown 数量（needs-review backlog 现状子集）。 */
function countLiveDocsWithoutFrontmatter(repoRoot, dir) {
  const root = resolve(repoRoot, dir || 'docs');
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { total: 0, withoutFrontmatter: 0, files: [] };
  }
  const files = listMarkdownFiles(root);
  const without = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf8');
    const { frontmatter } = parseMarkdown(content);
    if (!(frontmatter.present && frontmatter.ok)) without.push(toRel(repoRoot, f));
  }
  return { total: files.length, withoutFrontmatter: without.length, files: without.sort() };
}

/** needs-review 报告段（INFO，不计入门禁退出码）。 */
function needsReviewReport(repoRoot) {
  const migrationMap = parseMigrationMapNeedsReview(repoRoot);
  const liveDocs = countLiveDocsWithoutFrontmatter(repoRoot, 'docs');
  return {
    info: true,
    affectsExitCode: false,
    migrationMap,
    liveDocs,
    tracked: migrationMap.ok && migrationMap.entries > 0 && migrationMap.consistent,
    note:
      'MIGRATION-MAP needs-review 条目为人工裁定 backlog，不影响门禁退出码。' +
      'migrationMap.entries 与 crossCheck 核对一致即证明 needs-review 全被跟踪；' +
      'liveDocs 为工作区现存 .md 无有效 frontmatter 的子集（账本条目另含非 .md/根目录/doc HEAD 行，两者含义不同）。',
  };
}

/**
 * 全库文档治理门禁。强校验段（任一失败 → 退出非零）：
 *   (a) 夹具套件 (b) 已治理域强校验 (c) allowlist 完整性 (d) openspec validate --all
 * needs-review 报告段为 INFO，不影响退出码。
 */
function runGate(options) {
  const opts = options || {};
  const repoRoot = resolve(process.cwd(), opts.repoRoot || '.');
  const fixturesRoot = resolve(repoRoot, opts.fixturesRoot || 'scripts/fixtures/docs-governance');
  const allowlistPath = resolve(repoRoot, opts.allowlistPath || DEFAULT_ALLOWLIST_REL);
  const failures = [];

  // (c) allowlist 完整性
  const allowlist = loadAllowlist(allowlistPath);
  if (!allowlist.ok) failures.push(`[allowlist] ${allowlist.error}`);

  // (a) 夹具套件
  const fixtures = runFixtureSuite(fixturesRoot);
  for (const r of fixtures.failed) {
    const detail = r.report
      ? `byRule=${JSON.stringify(r.report.summary.byRule)}`
      : r.reason || '';
    failures.push(`[fixture:${r.category}/${r.name}] 期望 ${r.expect}，实际 exit=${r.exitCode}${detail ? ` (${detail})` : ''}`);
  }

  // (b) 已治理域强校验
  const governed = runGoverned(repoRoot, allowlist.ok ? allowlist.entries : [], opts.governed);
  for (const v of governed.violations) {
    failures.push(`[governed:${v.rule}] ${v.path}: ${v.message}`);
  }

  // (d) openspec validate --all
  let openspec = { skipped: true };
  if (!opts.skipOpenspec) {
    openspec = runOpenSpec(repoRoot, opts.openspecBin);
    if (!openspec.ok) {
      failures.push(`[openspec] ${openspec.command} 退出 ${openspec.exitCode}${openspec.error ? ` (${openspec.error})` : ''}`);
    }
  }

  // needs-review 报告段（INFO）
  const needsReview = needsReviewReport(repoRoot);

  const ok = failures.length === 0;
  return {
    tool: 'docs-governance-check',
    mode: 'gate',
    repoRoot,
    generatedAt: new Date().toISOString(),
    ok,
    exitCode: ok ? 0 : 1,
    strong: {
      allowlist: {
        ok: allowlist.ok,
        path: allowlistPath,
        entries: allowlist.entries.length,
        error: allowlist.error,
      },
      fixtures: {
        ok: fixtures.ok,
        total: fixtures.total,
        failed: fixtures.failed.length,
        results: fixtures.results.map((r) => ({
          fixture: `${r.category}/${r.name}`,
          expect: r.expect,
          exit: r.exitCode,
          pass: r.pass,
          byRule: r.report ? r.report.summary.byRule : null,
        })),
      },
      governed,
      openspec,
    },
    needsReview,
    failures,
  };
}

function gateHumanSummary(g) {
  const L = [];
  L.push(`文档治理门禁 [gate] 根: ${g.repoRoot}`);
  L.push(`结果: ${g.ok ? '通过 ✓' : '失败 ✗'}（退出码 ${g.exitCode}）`);
  const s = g.strong;
  L.push(`  (c) allowlist 完整性: ${s.allowlist.ok ? 'OK' : 'FAIL'}（${s.allowlist.entries} 条）`);
  L.push(`  (a) 夹具套件: ${s.fixtures.ok ? 'OK' : 'FAIL'}（${s.fixtures.total - s.fixtures.failed}/${s.fixtures.total} 通过）`);
  L.push(
    `  (b) 已治理域: ${s.governed.ok ? 'OK' : 'FAIL'}` +
      `（扫描 ${s.governed.filesScanned}，内容文档 ${s.governed.contentFiles}，豁免 ${s.governed.exemptFiles}，违例 ${s.governed.violations.length}，登记表降级 legacy ${s.governed.legacyDowngraded.length}）`,
  );
  if (s.openspec.skipped) {
    L.push('  (d) openspec validate: 已跳过 (--skip-openspec)');
  } else {
    L.push(`  (d) openspec validate --all: ${s.openspec.ok ? 'OK' : 'FAIL'}（退出 ${s.openspec.exitCode}）`);
  }
  const nr = g.needsReview;
  L.push('── needs-review 报告段（INFO，不影响退出码）──');
  L.push(`  MIGRATION-MAP needs-review 条目: ${nr.migrationMap.entries}（交叉核对 ${nr.migrationMap.crossCheck}，一致: ${nr.migrationMap.consistent}）`);
  L.push(`  needs-review 全被跟踪: ${nr.tracked}`);
  L.push(`  docs/ 工作区 .md 无有效 frontmatter: ${nr.liveDocs.withoutFrontmatter}/${nr.liveDocs.total}`);
  if (g.failures.length) {
    L.push('失败明细:');
    for (const f of g.failures) L.push(`  ${f}`);
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function run(args) {
  let rootDir;
  if (args.mode === 'fixture') {
    if (!args.rootDir) throw new Error('--fixture 需要一个目录参数');
    rootDir = resolve(process.cwd(), args.rootDir);
  } else if (args.mode === 'root') {
    rootDir = resolve(process.cwd(), args.rootDir || '.');
  } else {
    throw new Error('必须指定 --fixture <dir> 或 --root');
  }
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`目录不存在或不是目录: ${rootDir}`);
  }

  const mdFiles = listMarkdownFiles(rootDir);
  const docs = mdFiles.map((path) => {
    const content = readFileSync(path, 'utf8');
    const { ast, frontmatter } = parseMarkdown(content);
    return { path, links: collectLinks(ast), frontmatter };
  });

  const violations = [
    ...checkInventory(rootDir, mdFiles),
    ...checkFrontmatter(rootDir, docs),
    ...checkRelativeLinks(rootDir, docs),
    ...checkCanonicalUniqueness(rootDir, docs),
    ...checkArchivePlacement(rootDir, docs),
    ...checkLegacyPaths(rootDir, docs),
  ];

  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] || 0) + 1;

  const report = {
    tool: 'docs-governance-check',
    mode: args.mode,
    root: rootDir,
    generatedAt: new Date().toISOString(),
    ok: violations.length === 0,
    summary: {
      filesScanned: mdFiles.length,
      violations: violations.length,
      byRule: Object.keys(byRule).sort().reduce((acc, k) => ((acc[k] = byRule[k]), acc), {}),
    },
    violations: violations.map((v) => ({ ...v, ...(v.path ? {} : {}) })),
    contract: {
      requiredFields: REQUIRED_FIELDS,
      typeEnum: TYPE_ENUM,
      statusEnum: STATUS_ENUM,
      sourceOfTruthEnum: SOURCE_OF_TRUTH_ENUM,
      defaultSourceOfTruth: DEFAULT_SOURCE_OF_TRUTH,
    },
  };
  return report;
}

function humanSummary(report) {
  const lines = [];
  lines.push(
    `文档治理检查 [${report.mode}] 根: ${report.root}`,
  );
  lines.push(`扫描 Markdown 文件: ${report.summary.filesScanned}`);
  if (report.ok) {
    lines.push('结果: 通过 ✓（无违例）');
  } else {
    lines.push(`结果: 失败 ✗（违例 ${report.summary.violations} 条）`);
    for (const rule of Object.keys(report.summary.byRule).sort()) {
      lines.push(`  - ${rule}: ${report.summary.byRule[rule]}`);
    }
    lines.push('违例明细:');
    for (const v of report.violations) {
      lines.push(`  [${v.rule}] ${v.path}: ${v.message}`);
    }
  }
  return lines.join('\n');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${HELP}\n`);
    process.exit(2);
    return;
  }
  if (args.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
    return;
  }

  // 门禁模式（任务 14）
  if (args.mode === 'gate') {
    const gate = runGate({
      repoRoot: args.repoRoot,
      allowlistPath: args.allowlist,
      fixturesRoot: args.fixturesRoot,
      skipOpenspec: args.skipOpenspec,
      openspecBin: args.openspecBin,
    });
    const gateJson = `${JSON.stringify(gate, null, 2)}\n`;
    if (args.out) {
      writeFileSync(resolve(process.cwd(), args.out), gateJson, 'utf8');
      if (!args.quiet) {
        process.stderr.write(`JSON 报告已写入: ${args.out}\n`);
      }
    } else {
      process.stdout.write(gateJson);
    }
    if (!args.quiet) {
      process.stderr.write(`${gateHumanSummary(gate)}\n`);
    }
    process.exit(gate.exitCode);
    return;
  }

  let report;
  try {
    report = run(args);
  } catch (err) {
    process.stderr.write(`运行错误: ${err.message}\n`);
    process.exit(2);
    return;
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    writeFileSync(resolve(process.cwd(), args.out), json, 'utf8');
    if (!args.quiet) {
      process.stderr.write(`JSON 报告已写入: ${args.out}\n`);
    }
  } else {
    process.stdout.write(json);
  }

  if (!args.quiet) {
    process.stderr.write(`${humanSummary(report)}\n`);
  }

  process.exit(report.ok ? 0 : 1);
}

// 允许作为模块被测试导入，也允许直接执行。
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}

export {
  run,
  parseArgs,
  parseMarkdown,
  collectLinks,
  REQUIRED_FIELDS,
  TYPE_ENUM,
  STATUS_ENUM,
  SOURCE_OF_TRUTH_ENUM,
  RULE,
  // 门禁（任务 14）
  runGate,
  runGoverned,
  runFixtureSuite,
  runOneFixture,
  loadAllowlist,
  applyAllowlistToLegacy,
  runOpenSpec,
  needsReviewReport,
  parseMigrationMapNeedsReview,
  countLiveDocsWithoutFrontmatter,
  isFrontmatterExempt,
  GOVERNED_DIRS,
  GOVERNED_FILES,
  DEFAULT_ALLOWLIST_REL,
  FRONTMATTER_EXEMPT_REFS,
  FIXTURE_NAMES,
  FIXTURE_EXPECTED_RULE,
};

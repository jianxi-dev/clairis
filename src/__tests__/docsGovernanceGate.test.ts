// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAllowlist,
  isFrontmatterExempt,
  runGoverned,
  runFixtureSuite,
  applyAllowlistToLegacy,
  needsReviewReport,
  RULE,
  GOVERNED_DIRS,
  FIXTURE_NAMES,
} from "../../scripts/docs-governance-check.mjs";

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const realAllowlist = resolve(
  projectRoot,
  ".omo/evidence/ulw/clairis-doc-governance/task-12/intentional-history-allowlist.json",
);
const realFixtures = resolve(projectRoot, "scripts/fixtures/docs-governance");

const FM_VALID = [
  "---",
  "title: 产品愿景",
  "type: product",
  "status: accepted",
  "last_updated: 2026-07-31",
  "source_of_truth: canonical",
  "---",
  "",
].join("\n");

describe("loadAllowlist", () => {
  it("载入真实 intentional-history 登记表成功且含 entries", () => {
    const res = loadAllowlist(realAllowlist);
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.entries)).toBe(true);
    expect(res.entries.length).toBeGreaterThan(0);
    expect(res.error).toBeNull();
  });

  it("缺失文件返回 ok=false 且不抛", () => {
    const res = loadAllowlist(join(projectRoot, "no-such-allowlist.json"));
    expect(res.ok).toBe(false);
    expect(res.entries).toEqual([]);
    expect(res.error).toBeTruthy();
  });
});

describe("isFrontmatterExempt", () => {
  it("README 索引 / openspec / 迁移账本 豁免", () => {
    expect(isFrontmatterExempt("docs/README.md")).toBe(true);
    expect(isFrontmatterExempt("docs/product/README.md")).toBe(true);
    expect(isFrontmatterExempt("openspec/specs/reading/spec.md")).toBe(true);
    expect(isFrontmatterExempt("docs/MIGRATION-MAP.md")).toBe(true);
  });

  it("内容文档不豁免", () => {
    expect(isFrontmatterExempt("docs/product/vision.md")).toBe(false);
    expect(isFrontmatterExempt("docs/architecture/overview.md")).toBe(false);
    expect(isFrontmatterExempt("docs/GOVERNANCE.md")).toBe(false);
  });
});

describe("runGoverned — 已治理域强校验", () => {
  it("真实仓库已治理域 0 违例（强校验段通过）", () => {
    const allow = loadAllowlist(realAllowlist);
    const res = runGoverned(projectRoot, allow.entries, {});
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
    expect(res.filesScanned).toBeGreaterThan(0);
    expect(res.contentFiles).toBeGreaterThan(0);
    expect(res.exemptFiles).toBeGreaterThan(0);
    expect(res.governedDirs).toEqual([...GOVERNED_DIRS]);
  });
});

describe("runGoverned — 故意破坏的已治理域 fixture 失败", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "gov-gate-"));
    mkdirSync(join(dir, "product"), { recursive: true });
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("干净的受治产品文档通过", () => {
    writeFileSync(
      join(dir, "product", "vision.md"),
      `${FM_VALID}\n# 愿景\n\n稳定的产品定义。\n`,
    );
    const res = runGoverned(dir, [], {
      governedDirs: ["product"],
      governedFiles: [],
    });
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it("缺必需 frontmatter 字段 → frontmatter 违例且门禁失败", () => {
    const incomplete = FM_VALID.replace("last_updated: 2026-07-31\n", "");
    writeFileSync(
      join(dir, "product", "bad-meta.md"),
      `${incomplete}\n# 缺字段\n`,
    );
    const res = runGoverned(dir, [], {
      governedDirs: ["product"],
      governedFiles: [],
    });
    expect(res.ok).toBe(false);
    expect(res.byRule[RULE.frontmatter] || 0).toBeGreaterThan(0);
    rmSync(join(dir, "product", "bad-meta.md"));
  });

  it("断裂相对链接 → relative-links 违例且门禁失败", () => {
    const body = `${FM_VALID.replace("source_of_truth: canonical", "source_of_truth: supporting")}\n# 断链\n\n见 [缺失](./NOT-A-FILE.md)。\n`;
    writeFileSync(join(dir, "product", "broken-link.md"), body);
    const res = runGoverned(dir, [], {
      governedDirs: ["product"],
      governedFiles: [],
    });
    expect(res.ok).toBe(false);
    expect(res.byRule[RULE.relativeLinks] || 0).toBeGreaterThan(0);
    const hit = res.violations.find((v) => v.rule === RULE.relativeLinks);
    expect(hit).toBeTruthy();
    expect(hit?.path).toBe("product/broken-link.md");
    rmSync(join(dir, "product", "broken-link.md"));
  });
});

describe("applyAllowlistToLegacy", () => {
  it("命中登记表 (file, token) 的 legacy 违例被降级", () => {
    const violations = [
      {
        rule: RULE.legacyPaths,
        path: "docs/product/vision.md",
        message: "x",
        target: "docs/CORE-REQUIREMENTS-clairis.md",
      },
    ];
    const entries = [
      {
        file: "docs/product/vision.md",
        token: "docs/CORE-REQUIREMENTS-clairis.md",
        reason: "来源存根注",
      },
    ];
    const { kept, downgraded } = applyAllowlistToLegacy(violations, entries);
    expect(kept).toEqual([]);
    expect(downgraded).toHaveLength(1);
    expect(downgraded[0].allowlisted).toBe(true);
  });

  it('token:"*" 整文件登记表降级该文件全部 legacy 违例', () => {
    const violations = [
      {
        rule: RULE.legacyPaths,
        path: "docs/MIGRATION-MAP.md",
        message: "x",
        target: "doc/ARCHITECTURE.md",
      },
    ];
    const entries = [
      { file: "docs/MIGRATION-MAP.md", token: "*", reason: "迁移账本本体" },
    ];
    const { kept, downgraded } = applyAllowlistToLegacy(violations, entries);
    expect(kept).toEqual([]);
    expect(downgraded).toHaveLength(1);
  });

  it("未登记的 legacy 违例保留为 kept", () => {
    const violations = [
      {
        rule: RULE.legacyPaths,
        path: "docs/product/scope.md",
        message: "x",
        target: "docs/ARCHITECTURE.md",
      },
    ];
    const entries = [
      {
        file: "docs/product/vision.md",
        token: "docs/CORE-REQUIREMENTS-clairis.md",
        reason: "来源存根注",
      },
    ];
    const { kept, downgraded } = applyAllowlistToLegacy(violations, entries);
    expect(downgraded).toEqual([]);
    expect(kept).toHaveLength(1);
  });
});

describe("needsReviewReport", () => {
  // 该用例扫描整个仓库的文档与 MIGRATION-MAP，CI（2 核 + coverage 插桩）
  // 实测 9s+，超过 5s 默认超时。放宽到 30s：断言不变，只承载真实 I/O 耗时。
  it(
    "MIGRATION-MAP needs-review 条目 > 0 且与交叉核对一致（全被跟踪）",
    { timeout: 30_000 },
    () => {
      const rep = needsReviewReport(projectRoot);
      expect(rep.affectsExitCode).toBe(false);
      expect(rep.migrationMap.ok).toBe(true);
      expect(rep.migrationMap.entries).toBeGreaterThan(0);
      expect(rep.migrationMap.consistent).toBe(true);
      expect(rep.migrationMap.entries).toBe(rep.migrationMap.crossCheck);
      expect(rep.tracked).toBe(true);
      expect(rep.liveDocs.total).toBeGreaterThan(0);
    },
  );
});

describe("runFixtureSuite — 任务 5 夹具套件（6+6+2）", () => {
  it("真实夹具套件 14 项全过", () => {
    const res = runFixtureSuite(realFixtures);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(6 + 6 + 2);
    expect(res.failed).toHaveLength(0);
    for (const name of FIXTURE_NAMES) {
      const valid = res.results.find(
        (r) => r.category === "valid" && r.name === name,
      );
      const invalid = res.results.find(
        (r) => r.category === "invalid" && r.name === name,
      );
      expect(valid?.exitCode).toBe(0);
      expect(invalid?.exitCode).toBe(1);
    }
  });
});

/**
 * 类型声明：scripts/docs-governance-check.mjs 的公共导出（任务 5 + 任务 14 门禁）。
 * 与实现保持同步；仅用于 TypeScript 消费方的类型解析。
 */

export interface AllowlistEntry {
  file: string;
  token: string;
  reason?: string;
}

export interface AllowlistResult {
  ok: boolean;
  entries: AllowlistEntry[];
  path: string;
  error: string | null;
}

export interface Violation {
  rule: string;
  path: string;
  message: string;
  target?: string;
  line?: number | null;
  allowlisted?: boolean;
  [key: string]: unknown;
}

export interface GovernedResult {
  ok: boolean;
  repoRoot: string;
  filesScanned: number;
  contentFiles: number;
  exemptFiles: number;
  governedDirs: string[];
  violations: Violation[];
  legacyDowngraded: Violation[];
  byRule: Record<string, number>;
}

export interface FixtureReport {
  ok: boolean;
  summary: { filesScanned: number; violations: number; byRule: Record<string, number> };
  [key: string]: unknown;
}

export interface FixtureResult {
  category: string;
  name: string;
  ok: boolean;
  reason: string | null;
  exitCode: number;
  report: FixtureReport | null;
  expect?: string;
  expectedRule?: string;
  pass?: boolean;
}

export interface FixtureSuiteResult {
  ok: boolean;
  total: number;
  results: FixtureResult[];
  failed: FixtureResult[];
}

export interface LegacySplit {
  kept: Violation[];
  downgraded: Violation[];
}

export interface OpenSpecResult {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  error: string | null;
  skipped?: boolean;
}

export interface NeedsReviewMap {
  ok: boolean;
  error: string | null;
  entries: number;
  crossCheck: number;
  consistent: boolean;
  currentPaths: string[];
}

export interface NeedsReviewLive {
  total: number;
  withoutFrontmatter: number;
  files: string[];
}

export interface NeedsReviewReport {
  info: boolean;
  affectsExitCode: boolean;
  migrationMap: NeedsReviewMap;
  liveDocs: NeedsReviewLive;
  tracked: boolean;
  note: string;
}

export interface RunReport {
  tool: string;
  mode: string;
  root: string;
  generatedAt: string;
  ok: boolean;
  summary: { filesScanned: number; violations: number; byRule: Record<string, number> };
  violations: Violation[];
  contract: Record<string, unknown>;
}

export interface GateResult {
  tool: string;
  mode: "gate";
  repoRoot: string;
  generatedAt: string;
  ok: boolean;
  exitCode: number;
  strong: {
    allowlist: { ok: boolean; path: string; entries: number; error: string | null };
    fixtures: {
      ok: boolean;
      total: number;
      failed: number;
      results: Array<{
        fixture: string;
        expect: string;
        exit: number;
        pass: boolean;
        byRule: Record<string, number> | null;
      }>;
    };
    governed: GovernedResult;
    openspec: OpenSpecResult;
  };
  needsReview: NeedsReviewReport;
  failures: string[];
}

export interface GateOptions {
  repoRoot?: string;
  fixturesRoot?: string;
  allowlistPath?: string;
  openspecBin?: string;
  skipOpenspec?: boolean;
  governed?: {
    governedDirs?: string[];
    governedFiles?: string[] | null;
  };
}

export interface ParsedArgs {
  mode: string | null;
  rootDir: string | null;
  out: string | null;
  quiet: boolean;
  help: boolean;
  repoRoot: string | null;
  allowlist: string | null;
  fixturesRoot: string | null;
  skipOpenspec: boolean;
  openspecBin: string | null;
}

export declare const REQUIRED_FIELDS: readonly string[];
export declare const TYPE_ENUM: readonly string[];
export declare const STATUS_ENUM: readonly string[];
export declare const SOURCE_OF_TRUTH_ENUM: readonly string[];
export declare const RULE: Readonly<{
  inventory: string;
  frontmatter: string;
  relativeLinks: string;
  canonicalUniqueness: string;
  archivePlacement: string;
  legacyPaths: string;
}>;
export declare const GOVERNED_DIRS: readonly string[];
export declare const GOVERNED_FILES: readonly string[];
export declare const FRONTMATTER_EXEMPT_REFS: readonly string[];
export declare const DEFAULT_ALLOWLIST_REL: string;
export declare const FIXTURE_NAMES: readonly string[];
export declare const FIXTURE_EXPECTED_RULE: Readonly<Record<string, string>>;

export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function parseMarkdown(content: string): {
  ast: unknown;
  frontmatter: { present: boolean; ok: boolean; data: Record<string, unknown> | null; error: string | null };
};
export declare function collectLinks(ast: unknown): Array<{ url: string; line: number | null }>;
export declare function run(args: { mode: string | null; rootDir?: string | null }): RunReport;

export declare function isFrontmatterExempt(relPath: string): boolean;
export declare function loadAllowlist(file: string): AllowlistResult;
export declare function applyAllowlistToLegacy(
  legacyViolations: Violation[],
  entries: AllowlistEntry[] | null | undefined,
): LegacySplit;
export declare function runGoverned(
  repoRoot: string,
  allowlistEntries: AllowlistEntry[] | null | undefined,
  opts?: { governedDirs?: readonly string[]; governedFiles?: readonly string[] | null },
): GovernedResult;
export declare function runOneFixture(
  fixturesRoot: string,
  category: string,
  name: string,
): FixtureResult;
export declare function runFixtureSuite(fixturesRoot: string): FixtureSuiteResult;
export declare function runOpenSpec(repoRoot: string, preferredBin?: string): OpenSpecResult;
export declare function parseMigrationMapNeedsReview(repoRoot: string): NeedsReviewMap;
export declare function countLiveDocsWithoutFrontmatter(
  repoRoot: string,
  dir?: string,
): NeedsReviewLive;
export declare function needsReviewReport(repoRoot: string): NeedsReviewReport;
export declare function runGate(options?: GateOptions): GateResult;

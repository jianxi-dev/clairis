// 手写类型声明：vendor/mdpkg-web.js 是逐字节复制的 ESM bundle，不能改。
// 只声明本仓库封装层（../index.ts）实际消费的导出；其余导出保持未类型化。

export interface ManifestResource {
  path: string;
  media_type: string;
  size: number;
  sha256: string;
  source_url?: string;
}

/** manifest v1.0，封闭 schema（additionalProperties: false）。 */
export interface Manifest {
  format: "mdpkg";
  spec_version: string;
  entrypoint?: string;
  encoding?: "utf-8";
  extensions?: {
    symbols?: "off" | "core" | "extended";
    include?: boolean;
  };
  extensions_required?: string[];
  resources: ManifestResource[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  externalCount: number;
}

export interface OpenOptions {
  symbols?: "off" | "core" | "extended";
  include?: boolean;
}

export interface OpenResult {
  files: Map<string, Uint8Array>;
  manifest: Manifest | null;
  validation: ValidationResult;
  /** 渲染后的完整 HTML 文档；渲染失败时为 null，原因见 error。 */
  html: string | null;
  degraded: boolean;
  /** 渲染阶段错误（原始技术错误码）；成功时为 null。 */
  error: string | null;
  /** 包内没有 manifest.json。 */
  unverified: boolean;
  entry: string;
}

export class MdeError extends Error {
  code: string;
}

export function openMdpkg(
  bytes: Uint8Array,
  opts?: OpenOptions,
): Promise<OpenResult>;

export function readEntrySource(
  files: Map<string, Uint8Array>,
  entry?: string,
): string;

export function packMdpkg(
  files: Map<string, Uint8Array>,
  prevManifest?: Manifest,
): Uint8Array;

export function buildManifest(
  files: Map<string, Uint8Array>,
  prev?: Manifest,
): Manifest;

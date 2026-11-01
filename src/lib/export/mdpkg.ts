// 导出 .mdpkg：收集本地图片 → files Map（document.md 原文 + 资产原始字节）
// → A1 buildManifest/packPackage → base64 → 主进程写盘。绝不抛出。
// v1 不内嵌 viewer/renderer（design D2）：包由标月自己打开。
import { invoke } from "@tauri-apps/api/core";
import { buildManifest, packPackage } from "../mdpkg";
import { collectLocalImages } from "./docx";
import { blobToBase64 } from "./base64";

export const MDPKG_ENTRY = "document.md";

export interface ExportMdpkgInput {
  title: string;
  markdown: string;
  baseDir: string;
}

export type ExportMdpkgResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** 测试/嵌入用的注入点；生产路径全部走默认实现。 */
export interface ExportMdpkgSeams {
  /** 读图片文件为 base64（默认 invoke read_file_base64）。 */
  readBase64?: (path: string) => Promise<string | null>;
  /** 写盘（默认 invoke save_binary_as_file）。 */
  save?: (base64: string, defaultName: string) => Promise<string | null>;
}

/** 导出文件名：`标题.mdpkg`，去掉路径分隔符与首尾空白。 */
export function mdpkgFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.mdpkg`;
}

/**
 * 组装包内文件：入口 Markdown 逐字保留（含 frontmatter），资产按原引用路径写入。
 * 远程 / data / 绝对路径图片由 collectLocalImages 跳过，不进包。
 */
export async function buildMdpkgFiles(
  input: ExportMdpkgInput,
  readBase64: (path: string) => Promise<string | null>,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  files.set(MDPKG_ENTRY, new TextEncoder().encode(input.markdown));
  const assets = await collectLocalImages(
    input.markdown,
    input.baseDir,
    readBase64,
  );
  for (const asset of assets) files.set(asset.name, asset.bytes);
  return files;
}

/** Markdown → .mdpkg 字节（未写盘）。失败抛出，由 exportMdpkgFromMarkdown 收敛。 */
export async function packMdpkgFromMarkdown(
  input: ExportMdpkgInput,
  readBase64: (path: string) => Promise<string | null>,
): Promise<Uint8Array> {
  const files = await buildMdpkgFiles(input, readBase64);
  const manifest = buildManifest(files);
  return packPackage(files, manifest);
}

export async function exportMdpkgFromMarkdown(
  input: ExportMdpkgInput,
  seams: ExportMdpkgSeams = {},
): Promise<ExportMdpkgResult> {
  try {
    if (!input.markdown.trim()) {
      return { status: "error", message: "文档为空，无法导出 .mdpkg" };
    }

    const readBase64 =
      seams.readBase64 ??
      (async (path: string) => {
        try {
          return await invoke<string>("read_file_base64", { path });
        } catch {
          return null;
        }
      });
    const save =
      seams.save ??
      ((base64: string, defaultName: string) =>
        invoke<string | null>("save_binary_as_file", { base64, defaultName }));

    const bytes = await packMdpkgFromMarkdown(input, readBase64);
    const base64 = await blobToBase64(
      new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
    );

    const path = await save(base64, mdpkgFileName(input.title));
    if (path === null) return { status: "cancelled" };
    return { status: "saved", path };
  } catch (e) {
    // Rust AppError::Cancelled 序列化为字符串 "Cancelled"。
    const reason = e instanceof Error ? e.message : String(e);
    if (reason === "Cancelled" || reason === "Operation cancelled") {
      return { status: "cancelled" };
    }
    return { status: "error", message: reason };
  }
}

export function exportMdpkgMessage(result: ExportMdpkgResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split(/[\\/]/).pop() || result.path;
    return `已导出 ${name}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}

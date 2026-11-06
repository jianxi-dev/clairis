// 导出 ZIP：document.md 原文 + 本地图片资源，经 vendored md-bundle toZip 生成标准 zip
// （include 展开、无 manifest.json、附 README.md）。不新增依赖。
import { invoke } from "@tauri-apps/api/core";
import { toZip } from "../mdpkg";
import { blobToBase64 } from "./base64";
import { collectLocalImages } from "./docx";

export const ZIP_DOCUMENT = "document.md";

export interface ExportZipInput {
  title: string;
  markdown: string;
  baseDir: string;
}

export type ExportZipResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** 测试/嵌入用的注入点；生产路径全部走默认实现。 */
export interface ExportZipSeams {
  /** 读图片文件为 base64（默认 invoke read_file_base64）。 */
  readBase64?: (path: string) => Promise<string | null>;
  /** 写盘（默认 invoke save_binary_as_file）。 */
  save?: (base64: string, defaultName: string) => Promise<string | null>;
}

/** 导出文件名：`标题.zip`，去掉路径分隔符与首尾空白。 */
export function zipFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.zip`;
}

/** 组装包内文件：document.md 原文 + 本地图片资源。失败抛出，由导出函数收敛。 */
export async function buildZipFiles(
  input: ExportZipInput,
  readBase64: (path: string) => Promise<string | null>,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  files.set(ZIP_DOCUMENT, new TextEncoder().encode(input.markdown));
  const assets = await collectLocalImages(
    input.markdown,
    input.baseDir,
    readBase64,
  );
  for (const asset of assets) files.set(asset.name, asset.bytes);
  return files;
}

export async function exportZipFromMarkdown(
  input: ExportZipInput,
  seams: ExportZipSeams = {},
): Promise<ExportZipResult> {
  try {
    if (!input.markdown.trim()) {
      return { status: "error", message: "文档为空，无法导出 ZIP" };
    }

    const cache = new Map<string, string | null>();
    const readBase64 =
      seams.readBase64 ??
      (async (path: string) => {
        try {
          return await invoke<string>("read_file_base64", { path });
        } catch {
          return null;
        }
      });
    const cachedRead = async (path: string): Promise<string | null> => {
      if (!cache.has(path)) cache.set(path, await readBase64(path));
      return cache.get(path) ?? null;
    };

    const save =
      seams.save ??
      ((base64: string, defaultName: string) =>
        invoke<string | null>("save_binary_as_file", { base64, defaultName }));

    const files = await buildZipFiles(input, cachedRead);
    const bytes = toZip(files);
    const base64 = await blobToBase64(
      new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
    );

    const path = await save(base64, zipFileName(input.title));
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

export function exportZipMessage(result: ExportZipResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split(/[\\/]/).pop() || result.path;
    return `已导出 ${name}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}

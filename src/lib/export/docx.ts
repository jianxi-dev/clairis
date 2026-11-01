// 导出 Word：剥离 frontmatter → 组装 files Map → vendor toDocx → base64 → 主进程写盘。
// OOXML 写入 / 图片内联全在 vendor；本模块只做胶水，绝不抛出。
import { invoke } from "@tauri-apps/api/core";
import { toDocx } from "../mdpkg/vendor/mdpkg-web.js";
import { blobToBase64 } from "./png";

export interface ExportDocxAsset {
  name: string;
  bytes: Uint8Array;
}

export interface ExportDocxInput {
  title: string;
  markdown: string;
  assets?: ExportDocxAsset[];
}

export type ExportDocxResult =
  | { status: "saved"; path: string; warnings: string[] }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export interface ExportDocxSeams {
  toDocx?: (
    files: Map<string, Uint8Array>,
    opts: Record<string, unknown>,
    onWarning?: (msg: string) => void,
  ) => Uint8Array | Promise<Uint8Array>;
  save?: (base64: string, defaultName: string) => Promise<string | null>;
}

export const DOCX_ENTRY = "document.md";

export function stripFrontmatter(markdown: string): string {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() !== "---") return markdown;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") return lines.slice(i + 1).join("\n");
  }
  return markdown;
}

export function docxFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.docx`;
}

export function exportDocxMessage(result: ExportDocxResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split(/[\\/]/).pop() || result.path;
    const tail =
      result.warnings.length > 0 ? `（${result.warnings.length} 条提示）` : "";
    return `已导出 ${name}${tail}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}

export async function exportDocxFromMarkdown(
  input: ExportDocxInput,
  seams: ExportDocxSeams = {},
): Promise<ExportDocxResult> {
  try {
    if (!input.markdown.trim()) {
      return { status: "error", message: "文档为空，无法导出 Word" };
    }

    const generate = seams.toDocx ?? toDocx;
    const save =
      seams.save ??
      ((base64: string, defaultName: string) =>
        invoke<string | null>("save_binary_as_file", { base64, defaultName }));

    const files = new Map<string, Uint8Array>();
    files.set(
      DOCX_ENTRY,
      new TextEncoder().encode(stripFrontmatter(input.markdown)),
    );
    for (const asset of input.assets ?? []) files.set(asset.name, asset.bytes);

    const warnings: string[] = [];
    const bytes = await generate(files, {}, (msg) => warnings.push(msg));

    const base64 = await blobToBase64(
      new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    const path = await save(base64, docxFileName(input.title));
    if (path === null) return { status: "cancelled" };
    return { status: "saved", path, warnings };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (reason === "Cancelled" || reason === "Operation cancelled") {
      return { status: "cancelled" };
    }
    return { status: "error", message: reason };
  }
}

const IMAGE_REF = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 收集 markdown 里引用的本地图片（远程/data/绝对路径跳过），读不到的直接略过。 */
export async function collectLocalImages(
  markdown: string,
  baseDir: string,
  readBase64: (path: string) => Promise<string | null>,
): Promise<ExportDocxAsset[]> {
  const names = new Set<string>();
  for (const match of markdown.matchAll(IMAGE_REF)) {
    const src = match[1]!;
    if (/^(?:https?:|data:|\/)/i.test(src)) continue;
    names.add(src);
  }
  const assets: ExportDocxAsset[] = [];
  for (const name of names) {
    const base64 = await readBase64(baseDir ? `${baseDir}/${name}` : name);
    if (!base64) continue;
    assets.push({ name, bytes: base64ToBytes(base64) });
  }
  return assets;
}

/** Tab 级入口：先收集本地图片，再走导出。 */
export async function exportDocxDocument(input: {
  title: string;
  markdown: string;
  baseDir: string;
}): Promise<ExportDocxResult> {
  const assets = await collectLocalImages(
    input.markdown,
    input.baseDir,
    async (path) => {
      try {
        return await invoke<string>("read_file_base64", { path });
      } catch {
        return null;
      }
    },
  );
  return exportDocxFromMarkdown({
    title: input.title,
    markdown: input.markdown,
    assets,
  });
}

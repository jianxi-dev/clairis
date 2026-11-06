// 导出 HTML 的 UI 胶水层：读样式 → 渲染 → 内联图片 → 系统保存对话框。
import { invoke } from "@tauri-apps/api/core";
import readerCss from "../../styles/reader.css?raw";
import tokensCss from "../../styles/tokens.css?raw";
import { ensureDiagramEngine } from "../../renderers/diagram/engine";
import { buildHtmlDocument } from "./html";
import { inlineImages } from "./inlineImages";

export interface ExportHtmlInput {
  title: string;
  markdown: string;
  baseDir: string;
}

export type ExportHtmlResult =
  | { status: "saved"; path: string; inlined: number; failed: number }
  | { status: "cancelled" }
  | { status: "error"; message: string };

interface SaveResult {
  path: string;
}

export async function exportCurrentDocHtml(
  input: ExportHtmlInput,
): Promise<ExportHtmlResult> {
  try {
    const engine = await ensureDiagramEngine();
    const doc = buildHtmlDocument(input.markdown, {
      title: input.title,
      css: `${tokensCss}\n${readerCss}`,
      diagramSvg: engine
        ? (source) => engine.renderToSvgOrNull(source)
        : undefined,
    });
    const { html, inlined, failed } = await inlineImages(
      doc,
      input.baseDir,
      async (path) => {
        try {
          return await invoke<string>("read_file_base64", { path });
        } catch {
          return null;
        }
      },
    );

    const saved = await invoke<SaveResult>("save_as_file", {
      content: html,
      defaultName: htmlFileName(input.title),
    });
    return { status: "saved", path: saved?.path ?? "", inlined, failed };
  } catch (e) {
    // Rust 的 AppError::Cancelled 是 unit variant，序列化为字符串 "Cancelled"。
    const reason = String(e);
    if (reason === "Cancelled" || reason === "Operation cancelled") {
      return { status: "cancelled" };
    }
    return { status: "error", message: String(e) };
  }
}

/** 导出文件名：`标题.html`，去掉路径分隔符与首尾空白。 */
export function htmlFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.html`;
}

export function exportMessage(result: ExportHtmlResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split(/[\\/]/).pop() || result.path;
    const tail = result.failed > 0 ? `，${result.failed} 张图片未能内联` : "";
    return `已导出 ${name}${tail}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}

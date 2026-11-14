// 文件级导出动作的共享执行层（editor-surface-batch18 D2）：页签右键菜单与任何
// 未来入口共用同一套管线与提示文案，不再依赖格头菜单的打开状态。
import { exportCurrentDocHtml, exportMessage } from "./export/exportDocument";
import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
import { exportDocxDocument, exportDocxMessage } from "./export/docx";
import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
import { log } from "../utils/log";
import type { ExportMenuAction } from "./paneHeaderMenu";

/** 导出目标：当前活动页签或右键命中的页签。 */
export interface ExportTarget {
  title: string;
  content: string;
  path: string | null;
}

/** 结果提示回调；UI 层决定何时消失（浮层 notice）。 */
export type ExportNotice = (message: string) => void;

function baseDirOf(path: string | null): string {
  if (!path) return "";
  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}

/** 执行一个导出动作并给出提示；失败收敛为提示文案，不向调用方抛出。 */
export async function runExportAction(
  action: ExportMenuAction,
  target: ExportTarget,
  notify: ExportNotice,
): Promise<void> {
  const { title, content } = target;
  const baseDir = baseDirOf(target.path);
  if (action === "exportHtml") {
    void exportCurrentDocHtml({ title, markdown: content, baseDir }).then(
      (result) => {
        const message = exportMessage(result);
        if (result.status === "error") {
          log.error("Export", "导出 HTML 失败", result.message);
          notify(message ?? "导出失败");
        } else if (result.status === "saved") {
          notify(message ?? "已导出");
        }
      },
    );
    return;
  }
  const run = async <R extends { status: string; message?: string }>(
    exportFn: () => Promise<R>,
    messageFn: (result: R) => string | null,
    pending: string,
    label: string,
  ) => {
    notify(pending);
    let message: string | null = null;
    try {
      const result = await exportFn();
      if (result.status === "error") {
        log.error("Export", `${label}失败`, result.message);
      }
      message = messageFn(result);
    } catch (e) {
      log.error("Export", `${label}失败`, String(e));
      message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
    }
    if (message) notify(message);
  };
  if (action === "exportPng") {
    void run(
      () => exportPngFromMarkdown({ title, markdown: content, baseDir }),
      exportPngMessage,
      "正在生成图片…",
      "导出图片",
    );
    return;
  }
  if (action === "exportPdf") {
    void run(
      () => exportPdfFromMarkdown({ title, markdown: content, baseDir }),
      exportPdfMessage,
      "正在生成 PDF…",
      "导出 PDF",
    );
    return;
  }
  if (action === "exportDocx") {
    void run(
      () => exportDocxDocument({ title, markdown: content, baseDir }),
      exportDocxMessage,
      "正在生成 Word…",
      "导出 Word",
    );
    return;
  }
  if (action === "exportMdpkg") {
    void run(
      () => exportMdpkgFromMarkdown({ title, markdown: content, baseDir }),
      exportMdpkgMessage,
      "正在打包 .mdpkg…",
      "导出 .mdpkg",
    );
    return;
  }
  if (action === "exportZip") {
    void run(
      () => exportZipFromMarkdown({ title, markdown: content, baseDir }),
      exportZipMessage,
      "正在打包 ZIP…",
      "导出 ZIP",
    );
  }
}

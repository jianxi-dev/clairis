/** 打印专用预览视图（issue #807 / design D3、D4）。
 *
 * 从页签的 Markdown 源文构造一份**独立**打印视图：同一 `renderMarkdown` 管线、
 * 同一图片属性与媒体解析，mermaid 走既有渲染器绘制成 SVG。屏幕外可布局地挂载
 * （不能用 `display:none`，mermaid 文本测量会失败），绘制完成后调用一次
 * `window.print()`；`afterprint` + 兜底超时清理，清理幂等。
 *
 * 不切换 store 的 editorMode，不改屏幕 DOM；打印前记下所属格滚动容器的
 * scrollTop，清理时精确还原。
 */
import { renderMarkdown } from "../renderers/markdown";
import { renderAll } from "../renderers/diagram/engine";
import { resolveDocMediaHref } from "./mediaUrl";
import { getPanelScrollEl } from "../editors/editorRef";
import { log } from "../utils/log";

export const PRINT_ROOT_ID = "biaoyue-print-root";
/** documentElement 上的打印标记：打印期间置位，清理时移除。 */
const PRINT_MARKER_ATTR = "data-biaoyue-printing";
/**
 * `window.print()` 不触发 `afterprint` 的环境（Firefox / 测试桩）里的兜底清理时长。
 * 计时从 print() 返回后起算：Chrome 打印期间阻塞，返回时 afterprint 已触发，
 * 不会提前摘掉正在出纸的视图。
 */
const CLEANUP_SAFETY_MS = 3000;

export interface PrintPreviewTarget {
  /** Markdown 源文。 */
  content: string;
  /** 文档绝对路径；用于解析相对媒体引用，未保存文档传 null。 */
  path?: string | null;
}

export interface PrintPreviewOptions {
  /** 该文档所在格 id；提供时打印后还原此格滚动位置。 */
  paneId?: string | null;
}

function escapeHtml(source: string): string {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 打印根内把 `<video>` 换成可见占位：有 poster 用图片，否则文件名 + 图标。只改打印根，不动屏幕预览。 */
function replaceVideosWithPrintPlaceholder(root: ParentNode): void {
  for (const video of Array.from(
    root.querySelectorAll<HTMLVideoElement>("video"),
  )) {
    const src = video.getAttribute("src") ?? "";
    const name = src.split("/").filter(Boolean).pop() || src || "视频";
    const poster = video.getAttribute("poster");
    if (poster) {
      const img = document.createElement("img");
      img.setAttribute("src", poster);
      img.setAttribute("alt", name);
      img.className = "print-poster";
      video.replaceWith(img);
      continue;
    }
    const box = document.createElement("div");
    box.className = "print-video";
    const icon = document.createElement("span");
    icon.className = "print-video-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▶";
    const label = document.createElement("span");
    label.className = "print-video-name";
    label.textContent = name;
    const note = document.createElement("span");
    note.className = "print-video-note";
    note.textContent = "视频在打印稿中以占位显示";
    box.append(icon, label, note);
    video.replaceWith(box);
  }
}

/**
 * 把 target 的 Markdown 以预览排版输出到纸张。
 *
 * 不抛异常：渲染或图表失败仍继续打印（失败处保留可读源码块）。
 */
export function printMarkdownPreview(
  target: PrintPreviewTarget,
  options: PrintPreviewOptions = {},
): void {
  if (typeof document === "undefined") return;

  const scrollEl = options.paneId ? getPanelScrollEl(options.paneId) : null;
  const scrollTop = scrollEl?.scrollTop ?? 0;

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.setAttribute("aria-hidden", "true");
  const shell = document.createElement("div");
  shell.className = "preview-shell";
  const content = document.createElement("div");
  content.className = "preview-content";

  let html: string;
  try {
    html = renderMarkdown(target.content, {
      resolveMedia: (href) => resolveDocMediaHref(href, target.path ?? null),
    });
  } catch (error) {
    // 与预览失败态一致：保留可读源码，不阻断打印。
    log.error("PrintPreview", "渲染失败，退化为源码块", error);
    html = `<pre class="print-source">${escapeHtml(target.content)}</pre>`;
  }
  content.innerHTML = html;
  shell.appendChild(content);
  root.appendChild(shell);
  document.body.appendChild(root);

  let cleaned = false;
  let safetyTimer: number | undefined;

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("afterprint", cleanup);
    if (safetyTimer !== undefined) window.clearTimeout(safetyTimer);
    root.remove();
    document.documentElement.removeAttribute(PRINT_MARKER_ATTR);
    if (scrollEl) scrollEl.scrollTop = scrollTop;
  };

  window.addEventListener("afterprint", cleanup);

  void (async () => {
    try {
      await renderAll(root);
      replaceVideosWithPrintPlaceholder(root);
      // 等一帧让 SVG 布局落定，再进打印。
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    } catch (error) {
      // 单块失败已由引擎兜底（源码可见）；这里是整批渲染的外层保险。
      log.error("PrintPreview", "图表绘制失败，保留源码继续打印", error);
    }

    document.documentElement.setAttribute(PRINT_MARKER_ATTR, "true");
    try {
      window.print();
    } catch (error) {
      log.error("PrintPreview", "调用 window.print 失败", error);
      cleanup();
      return;
    }
    // Chrome 的 print() 阻塞到对话框关闭，返回时 afterprint 通常已触发；
    // 未触发时由这个兜底计时器收场。
    if (cleaned) return;
    safetyTimer = window.setTimeout(cleanup, CLEANUP_SAFETY_MS);
  })();
}

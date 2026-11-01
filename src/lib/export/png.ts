// 导出 PNG 长图：同一份自包含 HTML → 良构 XHTML → foreignObject SVG → canvas 2x → PNG。
// 零新依赖（不用 html2canvas）：排版交给浏览器，CJK/emoji 走系统字体。
// 浏览器 API（高度测量 / Image / canvas）全部走可注入 seam —— jsdom 无实现，
// 单测注入 fake，真机走默认实现。
import { invoke } from "@tauri-apps/api/core";
import readerCss from "../../styles/reader.css?raw";
import tokensCss from "../../styles/tokens.css?raw";
import { buildHtmlDocument } from "./html";
import { inlineImages } from "./inlineImages";

/** 出图宽度（px）。与阅读区 --type-measure 一致。 */
export const PNG_WIDTH = 1080;
/** 栅格倍率：2x 出图，文字边缘不发虚。 */
export const PNG_SCALE = 2;
/** 高度上限（px）：再高 canvas 会爆内存/被浏览器拒绝，且长图已失去可读性。 */
export const PNG_MAX_HEIGHT = 20000;

export const PNG_TOO_TALL_MESSAGE = "文档过长，建议导出 HTML";

// ── HTML → 良构 XHTML ────────────────────────────────────────
//
// SVG 以图片加载时整体按 XML 解析：foreignObject 内容必须是良构 XML，
// 否则整图加载失败。marked 输出的 <img>/<hr> 不自闭合，`data-x` 这类
// 无值属性在 HTML 合法、在 XML 非法 —— 两者都得补。

const VOID_TAG =
  /<(img|br|hr|meta|input|link|source|wbr|area|base|col|embed|param|track)\b([^>]*)>/gi;

/**
 * 给标签属性串里的无值属性补 `=""`。
 * 逐字符走，跳过引号内的内容 —— 引号里的词不能被当成属性名。
 */
function fixBareAttrs(attrs: string): string {
  let out = "";
  let i = 0;
  while (i < attrs.length) {
    const ch = attrs[i]!;
    if (ch === '"' || ch === "'") {
      const q = ch;
      out += q;
      i++;
      while (i < attrs.length && attrs[i] !== q) {
        out += attrs[i];
        i++;
      }
      if (i < attrs.length) {
        out += attrs[i];
        i++;
      }
    } else if (/[a-z]/.test(ch)) {
      let word = "";
      let j = i;
      while (j < attrs.length && /[a-z0-9-]/.test(attrs[j]!)) {
        word += attrs[j];
        j++;
      }
      if (j < attrs.length && attrs[j] === "=") {
        out += word;
      } else {
        out += `${word}=""`;
      }
      i = j;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * HTML 文档 → 良构 XHTML：去 doctype、void 元素自闭合、无值属性补 `=""`。
 * `<style>` 先整块换成哨兵，避免 CSS 里的 `<` / `&` 被当成标签改写；
 * 还原时 CSS 包进 CDATA（`]]>` 拆成两段，CDATA 里不允许出现它）。
 */
export function toWellFormedXhtml(html: string): string {
  const styles: string[] = [];
  const MARK_OPEN = "__MDBS__";
  const MARK_CLOSE = "__MDBC__";
  const sentinelRx = /__MDBS__(\d+)__MDBC__/g;

  let out = html.replace(/<!doctype html>/i, "");
  out = out.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open: string, css: string, close: string) => {
      const i = styles.length;
      styles.push(
        `${open}<![CDATA[${css.split("]]>").join("]]]]><![CDATA[>")}]]>${close}`,
      );
      return `${MARK_OPEN}${i}${MARK_CLOSE}`;
    },
  );

  out = out
    .replace(VOID_TAG, (m, tag: string, attrs: string) =>
      attrs.trimEnd().endsWith("/") ? m : `<${tag}${attrs}/>`,
    )
    .replace(
      /<([a-z][a-z0-9]*)\b([^>]*)(\/?)>/gi,
      (_m, tag: string, attrs: string, slash: string) =>
        `<${tag}${fixBareAttrs(attrs)}${slash}>`,
    );

  return out.replace(sentinelRx, (_m, i: string) => styles[Number(i)]);
}

export interface SvgFromHtmlOptions {
  width: number;
  height: number;
}

/**
 * 把 HTML 包进一张定宽定高 SVG：内容放 `<foreignObject>`，内层 div 声明
 * XHTML 命名空间（XML 必需）—— 浏览器对该子树按 HTML 排版。
 * 高度必须由调用方显式给出：SVG 没有确定高度就无法栅格化。
 */
export function svgFromHtml(html: string, opts: SvgFromHtmlOptions): string {
  const { width, height } = opts;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">`,
    toWellFormedXhtml(html),
    `</div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join("\n");
}

// ── 高度测量 ────────────────────────────────────────────────

export type MeasureHtmlHeight = (
  html: string,
  width: number,
) => Promise<number>;

/**
 * 默认测量（浏览器）：把 HTML 塞进离屏 div，读 scrollHeight。
 * 导出文档的 body 有 0 边距，所以 scrollHeight 就是内容高度。
 * jsdom 无布局引擎（恒 0）→ node 单测必须注入。
 */
export const measureHtmlHeight: MeasureHtmlHeight = async (html, width) => {
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${width}px`;
  host.style.visibility = "hidden";
  host.style.pointerEvents = "none";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    return Math.ceil(host.scrollHeight);
  } finally {
    host.remove();
  }
};

// ── 栅格化 ──────────────────────────────────────────────────

export type SvgToBlob = (svg: string) => Promise<Blob>;

export interface RasterizeOptions {
  width: number;
  height: number;
  /** 缩放倍率，默认 2。 */
  scale?: number;
  /** 可注入的 SVG → Blob 实现（jsdom 无 Image/canvas，单测注入 fake）。 */
  toBlob?: SvgToBlob;
}

/**
 * 默认栅格化：SVG data URI → `<img>` → canvas(scale) → toBlob('image/png')。
 * 任一步失败都 reject —— 绝不产出损坏或截断的 PNG。
 */
const rasterizeWithCanvas: SvgToBlob = async (svg) => {
  const dims = svg.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  if (!dims) throw new Error("PNG 栅格化失败：SVG 缺少 width/height");
  const width = Number(dims[1]);
  const height = Number(dims[2]);
  const scale = PNG_SCALE;

  const img = new Image();
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("PNG 栅格化失败：SVG 图片加载出错"));
    img.src = dataUri;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PNG 栅格化失败：无法创建 canvas 2D 上下文");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG 编码失败：canvas.toBlob 返回空");
  return blob;
};

export async function rasterizeSvgToPng(
  svg: string,
  opts: RasterizeOptions,
): Promise<Blob> {
  const toBlob = opts.toBlob ?? rasterizeWithCanvas;
  return toBlob(svg);
}

// ── UI 胶水：Markdown → 保存 ────────────────────────────────

export interface ExportPngInput {
  title: string;
  markdown: string;
  baseDir: string;
  /** 已读入的样式原文（默认 tokens.css + reader.css）。 */
  css?: string;
}

export type ExportPngResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** 测试/嵌入用的注入点；生产路径全部走默认实现。 */
export interface ExportPngSeams {
  measure?: MeasureHtmlHeight;
  toBlob?: SvgToBlob;
  /** 读图片文件为 base64（默认 invoke read_file_base64）。 */
  readBase64?: (path: string) => Promise<string | null>;
  /** 写盘（默认 invoke save_binary_as_file）。 */
  save?: (base64: string, defaultName: string) => Promise<string | null>;
}

function defaultCss(): string {
  return `${tokensCss}\n${readerCss}`;
}

/** 导出文件名：`标题.png`，去掉路径分隔符与首尾空白。 */
export function pngFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.png`;
}

/** Blob → 纯 base64（去掉 data URL 前缀）。 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** 浏览器端等待字体就绪，避免 CJK 回退字体导致字形错位。 */
async function waitForFonts(): Promise<void> {
  const fonts = (
    document as Document & { fonts?: { ready?: Promise<unknown> } }
  ).fonts;
  if (fonts?.ready) await fonts.ready;
}

/**
 * Markdown → PNG 长图 → 主进程写盘。
 * 失败一律返回人话 message（UI 直接展示），取消返回 cancelled。
 */
export async function exportPngFromMarkdown(
  input: ExportPngInput,
  seams: ExportPngSeams = {},
): Promise<ExportPngResult> {
  try {
    if (!input.markdown.trim()) {
      return { status: "error", message: "文档为空，无法导出图片" };
    }

    const measure = seams.measure ?? measureHtmlHeight;
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

    const doc = buildHtmlDocument(input.markdown, {
      title: input.title,
      css: input.css ?? defaultCss(),
    });
    const { html } = await inlineImages(doc, input.baseDir, readBase64);

    await waitForFonts();
    const height = await measure(html, PNG_WIDTH);
    if (height > PNG_MAX_HEIGHT) {
      return { status: "error", message: PNG_TOO_TALL_MESSAGE };
    }

    const svg = svgFromHtml(html, { width: PNG_WIDTH, height });
    const blob = await rasterizeSvgToPng(svg, {
      width: PNG_WIDTH,
      height,
      scale: PNG_SCALE,
      toBlob: seams.toBlob,
    });
    const base64 = await blobToBase64(blob);

    const path = await save(base64, pngFileName(input.title));
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

export function exportPngMessage(result: ExportPngResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split(/[\\/]/).pop() || result.path;
    return `已导出 ${name}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}

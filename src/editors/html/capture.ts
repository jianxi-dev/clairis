/**
 * 区域截图（E-21）。
 *
 * 不另写渲染管线：排版交给浏览器，栅格化交给 `src/lib/export/png.ts` 已有的
 * SVG foreignObject → canvas（design D4）。这里只做两件事——从 content 里取出
 * 「样式 + body 内容」，以及把选区变成一个裁剪窗口。
 *
 * 已知边界（design D6）：SVG 作为图片加载时浏览器不请求外部资源，所以外链
 * 样式表与 `@import` 拿不到。内联 `<style>` 与相对路径图片会保留（后者由
 * `inlineImages` 转成 data URL）。
 */

import { invoke } from "@tauri-apps/api/core";
import { inlineImages } from "../../lib/export/inlineImages";
import {
  blobToBase64,
  rasterizeSvgToPng,
  toWellFormedXhtml,
} from "../../lib/export/png";

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** body 级计算样式。SVG 里嵌套的 `<body>` 会被解析忽略，必须由主侧复制到包装层。 */
export const CAPTURE_BODY_STYLE_KEYS = [
  "margin",
  "padding",
  "background-color",
  "background-image",
  "color",
  "font-family",
  "font-size",
  "line-height",
  "font-weight",
  "font-style",
] as const;

export type CaptureBodyStyle = Record<string, string>;

export interface CaptureParts {
  /** 文档内联样式（`<style>` 原文拼接） */
  styles: string;
  /** body 内容 */
  body: string;
}

/** 从原始 content 取出样式与 body 内容——不带锚点、不带注入运行时。 */
export function buildCaptureParts(content: string): CaptureParts {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((el) => el.outerHTML)
    .join("");
  return { styles, body: doc.body.innerHTML };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bodyStyleDecl(style?: CaptureBodyStyle): string {
  if (!style) return "";
  return CAPTURE_BODY_STYLE_KEYS.flatMap((key) => {
    const value = style[key];
    if (typeof value !== "string" || !value.trim()) return [];
    return [`${key}: ${escapeAttr(value.trim())}`];
  }).join("; ");
}

export interface CaptureSvgOptions {
  /** iframe 视口宽度：内层按同样宽度排版，截出来才与预览一致 */
  viewportWidth: number;
  bodyStyle?: CaptureBodyStyle;
}

/**
 * 组装裁剪用的 SVG：外层定宽高 + `overflow:hidden` 当窗口，内层按负偏移把
 * 目标区域推到窗口里。内部排版与预览完全一致，只是被窗口裁掉。
 */
export function buildCaptureSvg(
  parts: CaptureParts,
  region: CaptureRegion,
  options: CaptureSvgOptions,
): string {
  const width = Math.max(1, Math.round(region.width));
  const height = Math.max(1, Math.round(region.height));
  const viewport = Math.max(1, Math.round(options.viewportWidth));
  const offsetX = Math.round(region.x);
  const offsetY = Math.round(region.y);
  const decl = bodyStyleDecl(options.bodyStyle);

  const inner = [
    parts.styles,
    `<div style="position:absolute;left:${-offsetX}px;top:${-offsetY}px;width:${viewport}px;${decl}">`,
    parts.body,
    `</div>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;position:relative;">`,
    toWellFormedXhtml(inner),
    `</div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join("\n");
}

export interface CaptureInput {
  content: string;
  filePath?: string | null;
  region: CaptureRegion;
  viewportWidth: number;
  bodyStyle?: CaptureBodyStyle;
}

export type CaptureResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export interface CaptureSeams {
  /** 读图片为 base64（默认 invoke read_file_base64） */
  readBase64?: (path: string) => Promise<string | null>;
  /** SVG → PNG Blob（默认走 canvas） */
  toBlob?: (svg: string) => Promise<Blob>;
  /** 写盘（默认 invoke save_binary_as_file） */
  save?: (base64: string, defaultName: string) => Promise<string | null>;
}

function dirOf(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return idx === -1 ? "" : filePath.slice(0, idx);
}

export function captureFileName(filePath?: string | null): string {
  const base = (filePath ?? "").split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.[^.]+$/, "").trim() || "选区";
  return `${stem}-截图.png`;
}

/** 区域无效：宽或高不到 1px 时不该产出文件，也不该白跑一遍栅格化。 */
export function isRegionValid(region: CaptureRegion): boolean {
  return (
    Number.isFinite(region.width) &&
    Number.isFinite(region.height) &&
    region.width >= 1 &&
    region.height >= 1
  );
}

/**
 * 选区 → PNG → 写盘。
 * 与 `exportPngFromMarkdown` 同一套错误语义：失败返回人话 message，取消返回 cancelled。
 */
export async function captureRegionToPng(
  input: CaptureInput,
  seams: CaptureSeams = {},
): Promise<CaptureResult> {
  if (!isRegionValid(input.region)) {
    return { status: "error", message: "选区太小，无法截图" };
  }
  try {
    const parts = buildCaptureParts(input.content);
    if (!parts.body.trim()) {
      return { status: "error", message: "文档为空，无法截图" };
    }

    const html = input.filePath
      ? (
          await inlineImages(
            parts.body,
            dirOf(input.filePath),
            seams.readBase64 ??
              ((path: string) =>
                invoke<string>("read_file_base64", { path }).catch(() => null)),
          )
        ).html
      : parts.body;

    const svg = buildCaptureSvg({ ...parts, body: html }, input.region, {
      viewportWidth: input.viewportWidth,
      bodyStyle: input.bodyStyle,
    });

    const blob = await rasterizeSvgToPng(svg, {
      width: Math.round(input.region.width),
      height: Math.round(input.region.height),
      toBlob: seams.toBlob,
    });
    const base64 = await blobToBase64(blob);

    const save =
      seams.save ??
      ((data: string, defaultName: string) =>
        invoke<string | null>("save_binary_as_file", {
          base64: data,
          defaultName,
        }));

    const path = await save(base64, captureFileName(input.filePath));
    if (path === null) return { status: "cancelled" };
    return { status: "saved", path };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (reason === "Cancelled" || reason === "Operation cancelled") {
      return { status: "cancelled" };
    }
    return { status: "error", message: reason };
  }
}

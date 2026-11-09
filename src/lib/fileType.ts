/**
 * 文件类型 → 图标 + 类型色（Layout Portal §10）。
 *
 * 8 类固定色，颜色写在 `src/styles/tokens.css` 的 `--type-*` 上，
 * 这里只给变量名，组件侧用 `var(...)` 取值——这样深色模式可以整体换色。
 */

import type { IconName } from "../ui/icons";

export type FileTypeKind =
  "markdown" | "html" | "text" | "pdf" | "video" | "image" | "code" | "audio";

/** 规格 §10 的 8 类色值，与 tokens.css 必须一致（有 e2e 断言兜底）。 */
export const TYPE_COLORS: Record<FileTypeKind, string> = {
  markdown: "#6366f1",
  html: "#f59e0b",
  text: "#64748b",
  pdf: "#ef4444",
  video: "#a855f7",
  image: "#10b981",
  code: "#06b6d4",
  audio: "#ec4899",
};

const EXT: Record<string, FileTypeKind> = {
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  txt: "text",
  log: "text",
  pdf: "pdf",
  mp4: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  avif: "image",
  heif: "image",
  heic: "image",
  ts: "code",
  tsx: "code",
  js: "code",
  jsx: "code",
  json: "code",
  css: "code",
  py: "code",
  rs: "code",
  toml: "code",
  yaml: "code",
  yml: "code",
  sh: "code",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  flac: "audio",
  ogg: "audio",
};

/** 取文件类型；认不出的按文本处理（图标与颜色都不至于缺） */
export function fileTypeOf(path: string | null | undefined): FileTypeKind {
  if (!path) return "text";
  const name = path.split("/").pop() ?? path;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return EXT[ext] ?? "text";
}

/** 类型 → 图标名（与类型一一对应，避免每个调用点自己挑图标） */
export function iconOfType(kind: FileTypeKind): IconName {
  return kind;
}

/** 类型 → CSS 颜色表达式 */
export function colorOfType(kind: FileTypeKind): string {
  return `var(--type-${kind}, ${TYPE_COLORS[kind]})`;
}

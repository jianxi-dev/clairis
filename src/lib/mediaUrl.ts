/**
 * 文档内媒体引用的路径解析。
 *
 * markdown 里的 `![x](assets/pic.png)` 是**相对文档**的，导航器按文档页面的
 * base URL 解析它 → 打到 dev server 上 404，于是「插进去了但看不到」。
 *
 * 这里把它落到文档所在目录，再换成 WebView 能读的协议：
 * - 图片走 `asset://`（convertFileSrc）
 * - 视频/音频走 `media://`（支持 Range，能拖进度条）
 *
 * 外部链接（http/https/data/已有协议）原样返回——用户自己写的远程图片不该被改写。
 */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type MediaKind = "image" | "video" | "audio" | "file";

const VIDEO_EXT = new Set(["mp4", "webm", "ogv", "mov", "m4v", "mkv", "avi"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "flac", "ogg", "aac"]);
const IMAGE_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "ico",
  "avif",
]);

/** 带协议、协议相对、锚点、data URL：都不是文档内相对路径。 */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * markdown 的目标里含空格/括号时用 `<...>` 包住（CommonMark 允许这样写，
 * `marked` 也认）。解析路径前要先把这层壳拆掉。
 */
export function stripAngleWrappers(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isExternalHref(href: string): boolean {
  return EXTERNAL.test(href.trim());
}

/** 按扩展名判媒体类型；认不出的一律当普通文件。 */
export function mediaKindOf(path: string): MediaKind {
  const clean = stripAngleWrappers(path).split(/[?#]/)[0] ?? path;
  const dot = clean.lastIndexOf(".");
  const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "file";
}

function inTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
      undefined
  );
}

/** 本地绝对路径 → media:// URL（斜杠不编码，避免 WKWebView 解析成 //）。 */
export function mediaUrlForPath(path: string): string {
  const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
  const withSlash = encoded.startsWith("/") ? encoded : `/${encoded}`;
  return `media://localhost${withSlash}`;
}

/** 把文档内相对引用拼成绝对路径；`..` 与 `./` 就地规整。 */
export function resolveRelativeToDoc(
  href: string,
  docPath: string,
): string | null {
  const clean = decodeURI(stripAngleWrappers(href));
  if (clean === "") return null;
  if (clean.startsWith("/")) return clean;

  const slash = docPath.lastIndexOf("/");
  if (slash <= 0) return null;
  const segments = [...docPath.slice(0, slash).split("/"), ...clean.split("/")];
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return `/${stack.join("/")}`;
}

/**
 * 把一个 markdown href 解析成可直接放进 `src` 的 URL。
 *
 * @returns null 表示当前环境读不了本地文件（浏览器 / 未保存文档），
 *   调用方应退回文字回退，而不是放一个必然 404 的 src。
 */
export function resolveDocMediaHref(
  href: string,
  docPath: string | null,
  kind: MediaKind = mediaKindOf(href),
): string | null {
  if (isExternalHref(href)) return href;
  if (!inTauri()) return null;
  if (!docPath) return null;

  const absolute = resolveRelativeToDoc(href, docPath);
  if (!absolute) return null;

  if (kind === "video" || kind === "audio") {
    // media:// 只服务登记过的路径（防任意本地文件读取）。不登记就是 404，
    // 表现是「播放器出来了但播不动」。
    void invoke("register_media_path", { path: absolute }).catch(() => {});
    return mediaUrlForPath(absolute);
  }
  return convertFileSrc(absolute);
}

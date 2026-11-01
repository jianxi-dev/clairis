// 导出 HTML：把相对路径图片内联成 data URL，让产物断网也能看图（D1/D5）。
// 读文件的能力由调用方注入（UI 层注入 read_file_base64），本模块不直接 invoke，
// 便于单测。
import { escapeHtml } from "./html";

export type Base64Reader = (path: string) => Promise<string | null>;

export interface InlineImagesResult {
  html: string;
  /** 成功内联的图片数 */
  inlined: number;
  /** 读不到、保留原引用的图片数 */
  failed: number;
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
};

const IMG_SRC_RE = /(<img\b[^>]*?\ssrc=")([^"]*)(")/gi;

/** 外部 URL / data URL / 绝对路径不参与内联，原样保留 */
function isInlinable(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:)/i.test(s)) return false; // http:, data:, asset:, file:, media: …
  if (s.startsWith("//") || s.startsWith("/") || s.startsWith("#"))
    return false;
  return true;
}

function mimeOf(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function joinPath(baseDir: string, rel: string): string {
  const dir = baseDir.replace(/[\\/]+$/, "");
  const clean = rel.replace(/^\.\//, "").replace(/\\/g, "/");
  return dir ? `${dir}/${clean}` : clean;
}

export async function inlineImages(
  html: string,
  baseDir: string,
  readBase64: Base64Reader,
): Promise<InlineImagesResult> {
  const matches = Array.from(html.matchAll(IMG_SRC_RE));
  if (matches.length === 0) return { html, inlined: 0, failed: 0 };

  // 同一张图只读一次
  const cache = new Map<string, string | null>();
  let inlined = 0;
  let failed = 0;

  const replacements = await Promise.all(
    matches.map(async (m) => {
      const src = m[2];
      if (!isInlinable(src)) return null;

      const path = joinPath(baseDir, src);
      if (!cache.has(path)) {
        let data: string | null = null;
        try {
          data = await readBase64(path);
        } catch {
          data = null;
        }
        cache.set(path, data);
      }
      const data = cache.get(path) ?? null;
      if (!data) {
        failed += 1;
        return null;
      }
      inlined += 1;
      return {
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        dataUrl: `data:${mimeOf(src)};base64,${data}`,
      };
    }),
  );

  // 从后往前替换：前面的下标不会被已替换的片段挪动
  const hits = replacements.filter(
    (r): r is { start: number; end: number; dataUrl: string } => r !== null,
  );
  hits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const r of hits) {
    out =
      out.slice(0, r.start) +
      `<img src="${escapeHtml(r.dataUrl)}"` +
      out.slice(r.end);
  }

  return { html: out, inlined, failed };
}

/**
 * 阅读空间卡片规格（layout-portal 7.1）——纯逻辑层。
 *
 * 密度三档的高度、卡片高度滑杆的夹取、meta 行、缩略图类型判定与指纹缓存
 * 全部放在这里，无 DOM / 无 store。渲染侧只消费结果，渲染占位图本身留在
 * ReadingRail.tsx（这样才能复用 `Icon` 与 `--type-*` 变量）。
 */

import { fileTypeOf } from "./fileType";
import type { RecentFile, ScrollPosition } from "../types";
import type { RailDensity } from "./railView";

/** 三档密度高度（严格像素值，e2e 会量）。 */
export const DENSITY_HEIGHT: Record<RailDensity, number> = {
  compact: 32,
  comfortable: 56,
  card: 112,
};

/** 卡片高度滑杆上下界；默认值即卡片档的 112。 */
export const CARD_MIN = 88;
export const CARD_MAX = 160;

/** 4:3 缩略图盒（卡片右侧，严格 72×54）。 */
export const CARD_RATIO_W = 64;
export const CARD_RATIO_H = 48;

/** 夹取卡片高度：非有限值回默认 112，越界贴边，小数取整。 */
export function clampCardHeight(n: number): number {
  if (!Number.isFinite(n)) return DENSITY_HEIGHT.card;
  return Math.min(CARD_MAX, Math.max(CARD_MIN, Math.round(n)));
}

/** 缩略图盒的唯一尺寸来源——e2e 与组件都从这里取 4:3 契约。 */
export function thumbnailBox(): { w: number; h: number } {
  return { w: CARD_RATIO_W, h: CARD_RATIO_H };
}

/** 父路径（不含文件名）；根目录返回 "/"，无路径分隔符返回空串。 */
export function parentPathOf(path: string): string {
  if (!path) return "";
  const idx = path.lastIndexOf("/");
  if (idx < 0) return "";
  if (idx === 0) return "/";
  return path.slice(0, idx);
}

/**
 * 父文件夹名：`/Users/x/Documents/Notes/a.md` → `Notes`。
 * 根目录回 `/`，无分隔符回空串——卡片 meta 只显示文件夹名，不显示完整路径。
 */
export function parentFolderNameOf(path: string): string {
  const parent = parentPathOf(path);
  if (!parent) return "";
  if (parent === "/") return "/";
  const name = parent.split("/").filter(Boolean).pop();
  return name ?? parent;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  laquo: "«",
  raquo: "»",
};

/**
 * 纯文本化：去掉 `<script>` / `<style>` 整块、所有标签与基本实体，再压平空白。
 * HTML 摘要与本机最近文件摘要共用，保证卡片不露 `<tag>` 源码。
 */
export function plainTextOf(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
      (match, entity: string) => {
        const key = entity.toLowerCase();
        if (!key.startsWith("#")) return HTML_ENTITIES[key] ?? match;
        const code = key.startsWith("#x")
          ? Number.parseInt(key.slice(2), 16)
          : Number.parseInt(key.slice(1), 10);
        // 越界 / 代理区码点会让 String.fromCodePoint 抛错，原样保留实体
        const valid =
          Number.isFinite(code) &&
          code >= 0 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff);
        return valid ? String.fromCodePoint(code) : match;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** 摘要：HTML 去标签后截 160 字；其余类型只压平空白。门户卡片与阅读空间卡片共用。 */
export function excerptOf(text: string | undefined, path?: string): string {
  if (!text) return "";
  const plain = path && /\.html?$/i.test(path) ? plainTextOf(text) : text;
  return plain.replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * 去掉 Markdown 语法标记，只留可读文字（卡片摘要展示用）。
 *
 * 与 `plainTextOf` 平行：HTML 在 `excerptOf` 里已去标签，Markdown 的语法
 * 则在渲染卡片时经这里剥离。**不改写 `excerptOf`**——存储的摘要要保留
 * `- [ ]` 任务标记与 `![img]()` 首图语法，供任务进度与封面缩略图解析。
 */
export function stripMarkdownOf(text: string): string {
  if (!text) return "";
  let out = text;

  // 围栏代码块：去掉围栏标记、保留块内文字；未闭合的围栏只删开栏行
  out = out.replace(/^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, "$1");
  out = out.replace(/^[ \t]*```[^\n]*$/gm, "");
  out = out.replace(/`+([^`]*)`+/g, "$1");

  // 图片保留 alt，链接保留文字，自动链接去掉尖括号
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  out = out.replace(/<((?:https?|mailto):[^>]+)>/g, "$1");

  // 强调：先双后单，避免 **x** 被单星号规则切碎
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");
  out = out.replace(/~~([^~]+)~~/g, "$1");
  out = out.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2");

  // 标题 / 引用 / 列表（任务勾选框连标记一起去掉）
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  out = out.replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/gm, "");
  out = out.replace(/^[ \t]*\d+[.)][ \t]+\[[ xX]\][ \t]+/gm, "");
  out = out.replace(/^[ \t]*[-*+][ \t]+/gm, "");
  out = out.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");

  // 表格：删分隔行，竖线换空格
  out = out
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.length > 0 && t.includes("-") && /^[|:\-\s]+$/.test(t));
    })
    .map((line) =>
      line
        .replace(/^[ \t]*\|/, "")
        .replace(/\|[ \t]*$/, "")
        .replace(/[ \t]*\|[ \t]*/g, " "),
    )
    .join("\n");

  // 分割线
  out = out.replace(/^[ \t]{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/gm, "");

  return out.replace(/\s+/g, " ").trim();
}

function openedAtValue(file: RecentFile): number {
  const ms = Date.parse(file.openedAt ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 合并最近文件：按 path 去重，按 openedAt 倒序，截到 cap。本机扫描结果与
 * 会话内打开的记录同 path 时保留历史摘要；历史条目没有摘要时采纳扫描摘要。
 */
export function mergeRecentFileList(
  existing: RecentFile[],
  incoming: RecentFile[],
  cap = 10,
): RecentFile[] {
  const byPath = new Map<string, RecentFile>();
  for (const file of existing) {
    if (file?.path) byPath.set(file.path, file);
  }
  for (const file of incoming) {
    if (!file?.path) continue;
    const prev = byPath.get(file.path);
    if (!prev) {
      byPath.set(file.path, file);
      continue;
    }
    const newer = openedAtValue(file) > openedAtValue(prev);
    // 旧配置里的历史条目可能没有摘要；扫描读到了就用上，别让卡片空着
    const adoptExcerpt = !prev.excerpt && !!file.excerpt;
    if (newer || adoptExcerpt) {
      byPath.set(file.path, {
        ...prev,
        openedAt: newer ? file.openedAt : prev.openedAt,
        excerpt: prev.excerpt ?? file.excerpt,
      });
    }
  }
  return Array.from(byPath.values())
    .sort((a, b) => openedAtValue(b) - openedAtValue(a))
    .slice(0, Math.max(0, cap));
}

/** 相对时间（10 分钟前 / 昨天 / 6月20日）；`now` 可注入以便单测确定。 */
export function relativeDate(iso: string, now: number = Date.now()): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const diff = Math.max(0, now - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return new Date(time).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
}

export interface TaskProgress {
  done: number;
  total: number;
}

/**
 * 阅读进度百分比（scrollPos / contentHeight）。没有记录或 contentHeight 非法时
 * 返回 undefined——绝不退化成伪造的 0%。
 */
export function readPercentOf(pos?: ScrollPosition): number | undefined {
  if (!pos || pos.contentHeight <= 0) return undefined;
  return Math.min(100, Math.round((pos.scrollPos / pos.contentHeight) * 100));
}

/**
 * 从真实正文摘要里数任务项（GFM 勾选框）。
 *
 * 没有勾选框 = 没有任务数据，返回 null——绝不伪造 0/3 这种进度。
 * `excerpt` 是打开文件时从正文截下的真实开头，不是占位文案。
 */
export function taskProgressOf(text: string | undefined): TaskProgress | null {
  if (!text) return null;
  const marks = text.match(/[-*+]\s+\[( |x|X)\]/g);
  if (!marks || marks.length === 0) return null;
  const done = marks.filter((m) => /\[[xX]\]/.test(m)).length;
  return { done, total: marks.length };
}

export type MetaKind = "task" | "read" | "none";

export interface MetaLine {
  kind: MetaKind;
  /** 任务进度形如 "3/10"；阅读进度形如 "已读 42%"；none 为空串。 */
  text: string;
  date: string;
  path: string;
}

/**
 * meta 行：任务进度优先，其次阅读进度，两者都没有则只留日期 + 路径。
 *
 * `readPercent` 只在调用方确有滚动进度数据时传入（undefined = 没有数据，
 * 不退化成伪造的 0%）。`now` 可注入以便单测确定。
 */
export function metaLine(
  item: RecentFile,
  readPercent?: number,
  now?: number,
): MetaLine {
  const date = relativeDate(item.openedAt, now);
  const path = parentPathOf(item.path);
  const tasks = taskProgressOf(item.excerpt);
  if (tasks) {
    return {
      kind: "task",
      text: `${tasks.done}/${tasks.total}`,
      date,
      path,
    };
  }
  if (typeof readPercent === "number" && Number.isFinite(readPercent)) {
    const pct = Math.min(100, Math.max(0, Math.round(readPercent)));
    return { kind: "read", text: `已读 ${pct}%`, date, path };
  }
  return { kind: "none", text: "", date, path };
}

export type ThumbKind =
  | "md-cover"
  | "html-page"
  | "pdf-page"
  | "video-poster"
  | "image"
  | "audio-wave";

export interface ThumbDescriptor {
  kind: ThumbKind;
  /**
   * 本地路径：image / md-cover 的真图，video / html 的原文件。渲染层按 kind
   * 转成 asset:// 或 media://；其余为 null。
   */
  src: string | null;
  /** 文件指纹：path + openedAt + 首图地址；索引缓存以它为键。 */
  fingerprint: string;
}

const MD_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/;
const HTML_IMAGE = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i;

/** 从摘要里取首图地址（Markdown 语法优先，其次裸 `<img src>`）。 */
export function firstImageOf(text: string | undefined): string | null {
  if (!text) return null;
  const md = MD_IMAGE.exec(text);
  if (md) return md[1];
  const html = HTML_IMAGE.exec(text);
  return html ? html[1] : null;
}

/**
 * 把首图地址解析成本地路径。远程 URL 一律拒绝（缩略图不联网），
 * `data:` / `blob:` / `asset:` 原样返回，绝对路径原样，相对路径相对 MD 目录。
 */
export function coverSrcOf(item: RecentFile): string | null {
  const raw = firstImageOf(item.excerpt);
  if (!raw) return null;
  if (/^https?:/i.test(raw) || raw.startsWith("//")) return null;
  if (/^(data:|blob:|asset:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  const parent = parentPathOf(item.path);
  const clean = raw.replace(/^\.\//, "");
  return parent ? `${parent}/${clean}` : clean;
}

/**
 * 缩略图类型。纯文本 / 代码 / 无首图的 MD 返回 null —— 它们渲染时必须
 * 一个缩略图节点都不产生（不是隐藏的空盒）。
 */
export function thumbKindOf(item: RecentFile): ThumbKind | null {
  const kind = fileTypeOf(item.path);
  switch (kind) {
    case "markdown":
      return coverSrcOf(item) ? "md-cover" : null;
    case "html":
      return "html-page";
    case "pdf":
      return "pdf-page";
    case "video":
      return "video-poster";
    case "image":
      return "image";
    case "audio":
      return "audio-wave";
    default:
      return null;
  }
}

/** 模块级缓存：进入渲染才生成，按文件指纹复用。 */
const THUMB_CACHE = new Map<string, ThumbDescriptor>();

export function thumbFingerprint(item: RecentFile): string {
  const kind = thumbKindOf(item) ?? "none";
  return `${kind}|${item.path}|${item.openedAt}|${coverSrcOf(item) ?? ""}`;
}

/** 懒生成 + 缓存；同一指纹返回同一个描述对象。 */
export function thumbDescriptorOf(item: RecentFile): ThumbDescriptor | null {
  const kind = thumbKindOf(item);
  if (!kind) return null;
  const fingerprint = thumbFingerprint(item);
  const cached = THUMB_CACHE.get(fingerprint);
  if (cached) return cached;
  // 视频 / HTML 的 src 是文件绝对路径，渲染层再转 media:// / asset://
  const src =
    kind === "image" ||
    kind === "video-poster" ||
    kind === "html-page" ||
    kind === "pdf-page"
      ? item.path
      : kind === "md-cover"
        ? coverSrcOf(item)
        : null;
  const descriptor: ThumbDescriptor = { kind, src, fingerprint };
  THUMB_CACHE.set(fingerprint, descriptor);
  return descriptor;
}

/** 单测清缓存用，运行期不需要调用。 */
export function clearThumbCache(): void {
  THUMB_CACHE.clear();
}

/** 供单测确认缓存命中，不在 UI 中使用。 */
export function thumbCacheSize(): number {
  return THUMB_CACHE.size;
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { fileDragHandlers } from "../../hooks/fileDrag";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import { useEditorStore } from "../../stores/editorStore";
import { reloadAppConfig, saveAppConfig } from "../../hooks/useConfig";
import Icon from "../Icon";
import {
  colorOfType,
  fileTypeOf,
  iconOfType,
  type FileTypeKind,
} from "../../lib/fileType";
import {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
  HTML_IFRAME_CAP,
  RAIL_EDGE_PX,
  RAIL_MENU_MAX_HEIGHT,
  RAIL_RESIZE_HANDLE_PX,
  RAIL_SEARCH_TIMES,
  RAIL_SECTIONS,
  filterRailItems,
  filterSearchHits,
  fileTypeChips,
  nextRailState,
  splitByRanges,
  type MatchRange,
  type RailChip,
  type RailChipKind,
  type RailDensity,
  type RailLayout,
  type RailSearchTime,
  type RailSection,
} from "../../lib/railView";
import {
  RAIL_PINNED_WIDTH_MAX,
  RAIL_PINNED_WIDTH_MIN,
} from "../../lib/aiViewSpec";
import { isUnread } from "../../lib/aiViewSpec";
import { pdfThumbCacheGet, pdfThumbOf } from "../../lib/pdfThumb";
import {
  CARD_MAX,
  CARD_MIN,
  DENSITY_HEIGHT,
  metaLine,
  parentFolderNameOf,
  parentPathOf,
  readPercentOf,
  relativeDate,
  stripMarkdownOf,
  taskProgressOf,
  thumbDescriptorOf,
  thumbnailBox,
  type MetaKind,
  type ThumbDescriptor,
} from "../../lib/railCards";
import { assetSrc } from "../../lib/assetSrc";
import { mediaUrlForPath } from "../../lib/mediaUrl";
import { revealInFinder } from "../../lib/finder";
import {
  HOVER_DELAY_MS,
  PREVIEW_DEFAULT_H,
  PREVIEW_RAIL_NARROW_MIN_W,
  PREVIEW_RAIL_NARROW_W,
  anchorFromRail,
  clampPreviewSize,
  isThumbZoneOfBox,
  type Box,
} from "../../lib/previewAnchor";
import { log } from "../../utils/log";
import { isTauriEnv } from "../../utils/tauri";
import type { RecentFile, SearchHit } from "../../types";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 30;

/** HTML iframe 缩略图：720×540 画布缩到 72×54（10%），避免触发移动端布局。 */
const HTML_THUMB_BASE_W = 720;
const HTML_THUMB_BASE_H = 540;
const HTML_THUMB_SCALE = 0.1;

/** 并发 iframe 上限的全局计数；超出后 HTML 卡片回退到 glyph 占位。 */
let activeHtmlThumbs = 0;
function acquireHtmlThumb(): boolean {
  if (activeHtmlThumbs >= HTML_IFRAME_CAP) return false;
  activeHtmlThumbs += 1;
  return true;
}
function releaseHtmlThumb(): void {
  activeHtmlThumbs = Math.max(0, activeHtmlThumbs - 1);
}

const LAYOUT_LABELS: Record<RailLayout, string> = {
  stacked: "堆叠",
  tabs: "标签",
};

const DENSITY_LABELS: Record<RailDensity, string> = {
  compact: "紧凑",
  comfortable: "舒适",
  card: "卡片",
};

const EMPTY_TEXT: Record<RailSection, string> = {
  now: "暂无正在阅读",
  pinned: "还没有收藏条目",
  recent: "暂无最近文件",
  category: "该类型下暂无条目",
};

/** 本机最近文件只扫描一次（React StrictMode 下 effect 会双跑）。 */
let recentScanStarted = false;

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

interface RailRowProps {
  item: RecentFile;
  ranges: MatchRange[];
  excerptRanges?: MatchRange[];
  density: RailDensity;
  cardHeight: number;
  pinned: boolean;
  readPercent?: number;
  /** 条目高度倍率（收藏段放大）；默认 1。 */
  scale?: number;
  /** 是否给类型图标上色；false 时单色。 */
  blockColors?: boolean;
  onOpen: (path: string) => void;
  onSplit: (path: string, dir: "row" | "col") => void;
  onReveal: (path: string) => void;
  onTogglePin: (path: string) => void;
  onRowMove?: (e: ReactMouseEvent<HTMLElement>) => void;
  onRowLeave?: () => void;
}

/**
 * 卡片右侧 4:3 缩略图（72×54）。
 *
 * 图片 / MD 首图 = 真 <img>；视频 = <video> 首帧；HTML = sandbox iframe 缩略
 * （并发超限回退 glyph）；PDF / 音频 = 确定性离线图形。纯文本与无图 MD 不会
 * 调用到这里。
 */
function RailThumb({ descriptor }: { descriptor: ThumbDescriptor }) {
  const box = thumbnailBox();
  const size = { width: box.w, height: box.h };
  const kind = descriptor.kind;
  const src = descriptor.src ?? "";

  const [htmlSlot, setHtmlSlot] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [pdfThumb, setPdfThumb] = useState<string | null | undefined>(() =>
    descriptor.kind === "pdf-page" && descriptor.src
      ? pdfThumbCacheGet(descriptor.src)
      : null,
  );
  const htmlAcquiredRef = useRef(false);

  useEffect(() => {
    if (kind !== "html-page" || !isTauriEnv() || !src) return;
    if (acquireHtmlThumb()) {
      htmlAcquiredRef.current = true;
      setHtmlSlot(true);
    }
    return () => {
      if (htmlAcquiredRef.current) {
        htmlAcquiredRef.current = false;
        releaseHtmlThumb();
      }
    };
  }, [kind, src]);

  useEffect(() => {
    if (kind !== "video-poster" || !isTauriEnv() || !src) return;
    let cancelled = false;
    setMediaReady(false);
    void invoke("register_media_path", { path: src })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMediaReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, src]);

  useEffect(() => {
    if (kind !== "pdf-page" || !src) return;
    let cancelled = false;
    void pdfThumbOf(src).then((url) => {
      if (!cancelled) setPdfThumb(url);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, src]);

  if (kind === "image" || kind === "md-cover") {
    return (
      <div
        data-testid="rail-thumb"
        data-thumb-kind={kind}
        style={size}
        className="rail-thumb shrink-0"
      >
        <img
          src={assetSrc(descriptor.src ?? "")}
          alt=""
          width={box.w}
          height={box.h}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (kind === "video-poster") {
    const showVideo = isTauriEnv() && !!src;
    return (
      <div
        data-testid="rail-thumb"
        data-thumb-kind={kind}
        style={{
          ...size,
          background:
            "color-mix(in srgb, var(--type-video) 26%, var(--app-surface))",
        }}
        className="rail-thumb shrink-0"
      >
        <span className="rail-thumb-play">
          <Icon name="video" size={24} color="var(--app-surface)" />
        </span>
        {showVideo && mediaReady && (
          <video
            src={mediaUrlForPath(src)}
            preload="auto"
            muted
            playsInline
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              try {
                video.currentTime = Math.min(0.1, video.duration || 0.1);
              } catch {
                /* 元数据未就绪时忽略 */
              }
            }}
            className="relative h-full w-full object-cover"
          />
        )}
      </div>
    );
  }

  if (kind === "audio-wave") {
    return (
      <div
        data-testid="rail-thumb"
        data-thumb-kind={kind}
        style={{
          ...size,
          background:
            "color-mix(in srgb, var(--type-audio) 20%, var(--app-surface))",
          color: "var(--type-audio)",
        }}
        className="rail-thumb rail-thumb-wave shrink-0"
      >
        {[6, 12, 18, 10, 16, 8, 14].map((h, i) => (
          <span key={i} className="rail-thumb-bar" style={{ height: h }} />
        ))}
      </div>
    );
  }

  if (kind === "html-page") {
    return (
      <div
        data-testid="rail-thumb"
        data-thumb-kind={kind}
        style={{
          ...size,
          background:
            "color-mix(in srgb, var(--type-html) 10%, var(--app-surface))",
          borderColor: "var(--type-html)",
          color: "var(--type-html)",
        }}
        className="rail-thumb flex shrink-0 items-center justify-center border"
      >
        <Icon name="html" size={24} color="var(--type-html)" />
        {htmlSlot && src && (
          <iframe
            sandbox="allow-scripts"
            src={assetSrc(src)}
            title=""
            tabIndex={-1}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: HTML_THUMB_BASE_W,
              height: HTML_THUMB_BASE_H,
              border: "none",
              transform: `scale(${HTML_THUMB_SCALE})`,
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    );
  }

  if (kind === "pdf-page") {
    if (pdfThumb) {
      return (
        <div
          data-testid="rail-thumb"
          data-thumb-kind={kind}
          style={size}
          className="rail-thumb shrink-0 overflow-hidden"
        >
          <img
            data-testid="rail-thumb-pdf-img"
            src={pdfThumb}
            alt=""
            width={box.w}
            height={box.h}
            className="h-full w-full object-cover object-top"
          />
        </div>
      );
    }
    // 卡片缩略图**不嵌入** PDF 查看器（#286）：macOS WKWebView 用 PDFKit
    // 渲染 iframe，忽略 `#toolbar=0`；它的悬浮控制条是原生视图层，
    // CSS `pointer-events:none` 也拦不住。唯一可靠的做法是不给卡片加载
    // 查看器——保留类型色占位。悬浮预览窗是用户主动阅读面，继续用 iframe。
    return (
      <div
        data-testid="rail-thumb"
        data-thumb-kind={kind}
        style={{
          ...size,
          background: `color-mix(in srgb, var(--type-pdf) 16%, var(--app-surface))`,
          color: "var(--type-pdf)",
        }}
        className="rail-thumb rail-thumb-page relative shrink-0 overflow-hidden"
      >
        <span className="rail-thumb-line" />
        <span className="rail-thumb-line" />
        <span className="rail-thumb-line" />
      </div>
    );
  }

  return (
    <div
      data-testid="rail-thumb"
      data-thumb-kind={kind}
      style={{
        ...size,
        background: `color-mix(in srgb, var(--type-pdf) 16%, var(--app-surface))`,
        color: "var(--type-pdf)",
      }}
      className="rail-thumb rail-thumb-page shrink-0"
    >
      <span className="rail-thumb-line" />
      <span className="rail-thumb-line" />
      <span className="rail-thumb-line" />
    </div>
  );
}

function RailProgress({
  pct,
  text,
  kind,
}: {
  pct: number;
  text: string;
  kind: MetaKind;
}) {
  return (
    <span
      data-testid="rail-meta-progress"
      data-meta-kind={kind}
      className="flex shrink-0 items-center gap-1 text-[10px]"
    >
      <span className="inline-block h-0.5 w-4 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
        <span
          className="block h-full bg-[var(--app-accent)]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span>{text}</span>
    </span>
  );
}

function RailCardProgress({
  text,
  kind,
}: {
  text: string;
  kind: Exclude<MetaKind, "none">;
}) {
  if (kind === "read") {
    return (
      <span
        data-testid="rail-card-progress"
        data-meta-kind={kind}
        className="group/progress flex shrink-0 items-center text-[10px]"
      >
        <span className="group-hover/progress:hidden">{text}</span>
        <span className="hidden group-hover/progress:inline">已读</span>
      </span>
    );
  }
  return (
    <span
      data-testid="rail-card-progress"
      data-meta-kind={kind}
      className="shrink-0 text-[10px]"
    >
      {text}
    </span>
  );
}

function RailRow({
  item,
  ranges,
  excerptRanges,
  density,
  cardHeight,
  pinned,
  readPercent,
  scale = 1,
  blockColors = true,
  onOpen,
  onSplit,
  onReveal,
  onTogglePin,
  onRowMove,
  onRowLeave,
}: RailRowProps) {
  const kind: FileTypeKind = fileTypeOf(item.path);
  const iconColor = blockColors ? colorOfType(kind) : undefined;
  const segments = splitByRanges(item.title, ranges);
  const meta = metaLine(item, readPercent);
  const tasks = taskProgressOf(item.excerpt);
  const readPct =
    typeof readPercent === "number" && Number.isFinite(readPercent)
      ? Math.min(100, Math.max(0, Math.round(readPercent)))
      : null;
  const progressPct = tasks
    ? Math.round((tasks.done / tasks.total) * 100)
    : meta.kind === "read"
      ? readPct
      : null;
  const progressNode =
    progressPct !== null ? (
      <RailProgress
        pct={progressPct}
        text={tasks ? `${tasks.done}/${tasks.total}` : `已读 ${readPct ?? 0}%`}
        kind={tasks ? "task" : "read"}
      />
    ) : null;
  const cardProgressNode =
    progressPct !== null ? (
      <RailCardProgress
        kind={tasks ? "task" : "read"}
        text={tasks ? `${tasks.done}/${tasks.total}` : `${progressPct}%`}
      />
    ) : null;
  const pinButton = (
    <button
      type="button"
      data-testid="rail-item-pin"
      data-pinned={pinned ? "true" : "false"}
      aria-label={pinned ? "取消收藏" : "收藏"}
      title={pinned ? "取消收藏" : "收藏"}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin(item.path);
      }}
      className="shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300"
    >
      <Icon
        name={pinned ? "pinOff" : "pin"}
        size={18}
        color={pinned ? "var(--app-accent)" : undefined}
      />
    </button>
  );

  const title = (className: string) => (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark key={i} data-testid="rail-hit" className="rail-hit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );

  if (density === "compact") {
    return (
      <div
        data-testid="rail-item"
        data-rail-path={item.path}
        data-file-path={item.path}
        {...fileDragHandlers(item.path)}
        data-kind={kind}
        data-density="compact"
        style={{ height: Math.round(DENSITY_HEIGHT.compact * scale) }}
        onMouseMove={onRowMove}
        onMouseEnter={onRowMove}
        onMouseLeave={onRowLeave}
        className="group relative box-border flex items-center gap-1 px-2"
      >
        <button
          type="button"
          onClick={() => onOpen(item.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name={iconOfType(kind)} size={18} color={iconColor} />
          {title("truncate text-xs text-gray-700 dark:text-gray-200")}
        </button>
        {progressNode}
        <span
          data-testid="rail-item-time"
          className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500"
        >
          {relativeDate(item.openedAt)}
        </span>
        {pinButton}
      </div>
    );
  }

  if (density === "comfortable") {
    return (
      <div
        data-testid="rail-item"
        data-rail-path={item.path}
        data-file-path={item.path}
        {...fileDragHandlers(item.path)}
        data-kind={kind}
        data-density="comfortable"
        style={{ height: Math.round(DENSITY_HEIGHT.comfortable * scale) }}
        onMouseMove={onRowMove}
        onMouseEnter={onRowMove}
        onMouseLeave={onRowLeave}
        className="group relative box-border flex flex-col justify-center px-2 py-1"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(item.path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <Icon name={iconOfType(kind)} size={18} color={iconColor} />
            {title("truncate text-xs text-gray-700 dark:text-gray-200")}
          </button>
          {pinButton}
        </div>
        <div
          data-testid="rail-item-sub"
          className="mt-0.5 flex min-w-0 items-center gap-1 pl-[22px] text-[10px] text-gray-400 dark:text-gray-500"
        >
          <Icon name="folder" size={18} />
          <span className="truncate">{parentFolderNameOf(item.path)}</span>
          <span>·</span>
          {progressNode}
          <span className="shrink-0">{relativeDate(item.openedAt)}</span>
          {pinned && (
            <span
              data-testid="rail-item-pinned"
              className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-1 text-[9px] leading-tight text-[var(--app-accent)]"
            >
              收藏
            </span>
          )}
        </div>
      </div>
    );
  }

  const thumb = thumbDescriptorOf(item);
  const rawExcerpt = item.excerpt || "（暂无正文）";
  const displayExcerpt =
    kind === "markdown" ? stripMarkdownOf(rawExcerpt) : rawExcerpt;
  const excerptSegments = splitByRanges(
    displayExcerpt || rawExcerpt,
    excerptRanges ?? [],
  );

  const actions = (
    <div
      data-testid="rail-card-actions"
      className="absolute bottom-0.5 left-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
    >
      <button
        type="button"
        data-testid="rail-card-action"
        data-action="open"
        title="打开"
        aria-label="打开"
        onClick={() => onOpen(item.path)}
        className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <Icon name="eye" size={14} />
      </button>
      <button
        type="button"
        data-testid="rail-card-action"
        data-action="split-right"
        title="向右分屏"
        aria-label="向右分屏"
        onClick={() => onSplit(item.path, "row")}
        className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <Icon name="splitRight" size={14} />
      </button>
      <button
        type="button"
        data-testid="rail-card-action"
        data-action="split-down"
        title="向下分屏"
        aria-label="向下分屏"
        onClick={() => onSplit(item.path, "col")}
        className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <Icon name="splitDown" size={14} />
      </button>
      <button
        type="button"
        data-testid="rail-card-action"
        data-action="pin"
        data-pinned={pinned ? "true" : "false"}
        title={pinned ? "取消收藏" : "收藏"}
        aria-label={pinned ? "取消收藏" : "收藏"}
        onClick={() => onTogglePin(item.path)}
        className={`flex items-center gap-0.5 rounded p-0.5 ${
          pinned
            ? "text-[var(--app-accent)]"
            : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        }`}
      >
        <Icon name={pinned ? "heartFilled" : "heart"} size={14} />
      </button>
      <button
        type="button"
        data-testid="rail-card-action"
        data-action="path"
        title={item.path}
        aria-label={`打开所在文件夹 ${parentFolderNameOf(item.path)}`}
        onClick={() => onReveal(parentPathOf(item.path))}
        className="flex min-w-0 items-center gap-0.5 truncate rounded p-0.5 text-left text-[10px] text-gray-400 hover:bg-[var(--app-sunken)] hover:text-gray-700 dark:hover:text-gray-200"
      >
        <Icon name="folder" size={14} />
        <span className="truncate">{parentFolderNameOf(item.path)}</span>
      </button>
    </div>
  );

  return (
    <div
      data-testid="rail-item"
      data-rail-path={item.path}
      data-file-path={item.path}
      {...fileDragHandlers(item.path)}
      data-kind={kind}
      data-density="card"
      style={{ height: Math.round(cardHeight * scale) }}
      onMouseMove={onRowMove}
      onMouseEnter={onRowMove}
      onMouseLeave={onRowLeave}
      className="group relative my-1 box-border flex flex-col justify-between overflow-hidden rounded border border-gray-200 px-2 pb-4 pt-1.5 dark:border-gray-700"
    >
      <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden pr-2">
          <button
            type="button"
            onClick={() => onOpen(item.path)}
            className="flex min-w-0 items-start gap-1.5 text-left"
          >
            <Icon name={iconOfType(kind)} size={18} color={iconColor} />
            {title(
              "line-clamp-2 text-xs font-semibold leading-snug text-gray-800 dark:text-gray-100",
            )}
          </button>
          <p
            data-testid="rail-card-excerpt"
            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400"
          >
            {excerptSegments.map((seg, i) =>
              seg.hit ? (
                <mark key={i} data-testid="rail-hit" className="rail-hit">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
        </div>
        {thumb && (
          <div className="mt-3 flex shrink-0 items-center justify-center">
            <RailThumb descriptor={thumb} />
          </div>
        )}
      </div>

      <div
        data-testid="rail-card-topright"
        className="absolute right-1 top-1 z-10 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500"
      >
        {cardProgressNode}
        <span data-testid="rail-card-time" className="shrink-0">
          {meta.date}
        </span>
      </div>

      {actions}
    </div>
  );
}

function RailChips({
  chips,
  active,
  onPick,
}: {
  chips: RailChip[];
  active: RailChipKind;
  onPick: (kind: RailChipKind) => void;
}) {
  return (
    <div data-testid="rail-chips" className="flex flex-wrap gap-1 px-2 pb-1">
      {chips.map((chip) => (
        <button
          key={chip.kind}
          type="button"
          data-testid="rail-chip"
          data-chip={chip.kind}
          data-active={chip.kind === active ? "true" : "false"}
          onClick={() => onPick(chip.kind)}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            chip.kind === active
              ? "border-transparent bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          {chip.label}
          <span className="ml-1 text-gray-400 dark:text-gray-500">
            {chip.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function RailSectionHead({
  label,
  sticky,
}: {
  label: string;
  sticky: boolean;
}) {
  return (
    <h3
      className={`${sticky ? "sticky top-0 z-10 " : ""}bg-gray-50/95 px-3 py-1 text-[11px] font-medium text-gray-500 backdrop-blur-sm dark:bg-gray-900/95 dark:text-gray-400`}
    >
      {label}
    </h3>
  );
}

/**
 * 阅读空间竖排栏（layout-portal 6.1）。
 *
 * 三态：折叠（12px 绝对边缘条，正文满宽）/ 悬停（240px 绝对浮层，不挤压正文）/
 * 钉住（240px flex 常驻，正文 min-width:0 变窄）。hover 是瞬态，由指针进入/离开
 * 驱动（250ms 展开、300ms 收回），钉住态不受其影响。
 */
export default function ReadingRail({
  onOpenPath,
}: {
  onOpenPath: (path: string) => void | Promise<void>;
}) {
  const railState = useStore((s) => s.railState);
  const railLayout = useStore((s) => s.railLayout);
  const railDensity = useStore((s) => s.railDensity);
  const railCardHeight = useStore((s) => s.railCardHeight);
  const railQuery = useStore((s) => s.railQuery);
  const railSearchOpen = useStore((s) => s.railSearchOpen);
  const railSection = useStore((s) => s.railSection);
  const railChip = useStore((s) => s.railChip);
  const recentFiles = useStore((s) => s.recentFiles);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const scrollPositions = useStore((s) => s.scrollPositions);
  const previewEnabled = useStore((s) => s.previewSettings.enabled);
  const viewSpec = useStore((s) => s.viewSpec);
  const pinnedPaths = useStore((s) => s.pinnedPaths);
  const togglePinnedPath = useStore((s) => s.togglePinnedPath);
  const configLoaded = useEditorStore((s) => s.configLoaded);

  const setRailState = useStore((s) => s.setRailState);
  const toggleRailPin = useStore((s) => s.toggleRailPin);
  const setRailLayout = useStore((s) => s.setRailLayout);
  const setRailDensity = useStore((s) => s.setRailDensity);
  const setRailCardHeight = useStore((s) => s.setRailCardHeight);
  const setRailQuery = useStore((s) => s.setRailQuery);
  const openRailSearch = useStore((s) => s.openRailSearch);
  const closeRailSearch = useStore((s) => s.closeRailSearch);
  const setRailSection = useStore((s) => s.setRailSection);
  const setRailChip = useStore((s) => s.setRailChip);
  const saveRailViewSpec = useStore((s) => s.saveRailViewSpec);

  const [menuOpen, setMenuOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [locatedPath, setLocatedPath] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchChip, setSearchChip] = useState<RailChipKind>("all");
  const [searchTime, setSearchTime] = useState<RailSearchTime>("all");
  const [railWidth, setRailWidthState] = useState(viewSpec.railPinnedWidth);
  const [menuFlip, setMenuFlip] = useState(false);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpenMenu = (): void => {
    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
    menuHoverTimer.current = setTimeout(() => {
      setMenuOpen(true);
      loadSnapshots();
    }, 120);
  };
  const hoverCloseMenu = (): void => {
    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
    menuHoverTimer.current = setTimeout(() => setMenuOpen(false), 240);
  };
  /** 拖拽调宽期间抑制「移出即收起」，否则浮层会在拖动途中消失。 */
  const resizingRef = useRef(false);
  const railPanelRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const hoverZoneRef = useRef<{ path: string; zone: "left" | "right" } | null>(
    null,
  );

  const clearTimer = useCallback(
    (ref: { current: ReturnType<typeof setTimeout> | null }) => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    },
    [],
  );

  // 配置重载（快照恢复 / 启动）后同步外部写入的宽度：渲染期调整，避免 effect 回写
  const [prevSpecWidth, setPrevSpecWidth] = useState(viewSpec.railPinnedWidth);
  if (prevSpecWidth !== viewSpec.railPinnedWidth) {
    setPrevSpecWidth(viewSpec.railPinnedWidth);
    setRailWidthState(viewSpec.railPinnedWidth);
  }

  const onResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = railWidth;
      let last = startWidth;
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      resizingRef.current = true;
      clearTimer(closeTimer);
      const detach = () => {
        resizingRef.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      const onMove = (ev: PointerEvent) => {
        last = Math.min(
          RAIL_PINNED_WIDTH_MAX,
          Math.max(
            RAIL_PINNED_WIDTH_MIN,
            Math.round(startWidth + ev.clientX - startX),
          ),
        );
        setRailWidthState(last);
      };
      const onUp = () => {
        detach();
        if (handle.hasPointerCapture?.(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
        useStore.getState().applyViewSpec({ railPinnedWidth: last });
        void saveAppConfig();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clearTimer, railWidth],
  );

  // 状态变化时清掉悬停计时器：避免过期回调把栏/预览拉回旧态
  useEffect(() => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    clearTimer(previewTimer);
  }, [railState, clearTimer]);

  // 预览总开关关闭时取消待触发的悬停计时器，避免关闭后仍弹出
  useEffect(() => {
    if (!previewEnabled) clearTimer(previewTimer);
  }, [previewEnabled, clearTimer]);

  // 折叠即清空搜索：不留残余过滤
  useEffect(() => {
    if (railState === "collapsed") closeRailSearch();
  }, [railState, closeRailSearch]);

  useEffect(() => {
    if (railSearchOpen) inputRef.current?.focus();
  }, [railSearchOpen, railQuery]);

  useEffect(() => {
    const onLocate = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path === "string") setLocatedPath(path);
    };
    window.addEventListener("rail-locate", onLocate);
    return () => window.removeEventListener("rail-locate", onLocate);
  }, []);

  useEffect(() => {
    if (recentScanStarted || !configLoaded || !isTauriEnv()) return;
    recentScanStarted = true;
    let cancelled = false;
    invoke<RecentFile[]>("list_recent_documents")
      .then((files) => {
        if (cancelled || !Array.isArray(files)) return;
        useStore.getState().mergeRecentFiles(files);
      })
      .catch((e) => log.warn("Rail", "读取本机最近文件失败", e));
    return () => {
      cancelled = true;
    };
  }, [configLoaded]);

  // 本机检索：query 去抖 300ms 后调用 search_documents；序号丢弃过期响应。
  // searching 由 searchedQuery 派生，不在 effect 里同步 setState。
  useEffect(() => {
    const query = railQuery.trim();
    if (!query || !isTauriEnv() || query === searchedQuery) {
      searchSeq.current += 1;
      return;
    }
    const seq = ++searchSeq.current;
    clearTimer(searchTimer);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
        .then((hits) => {
          if (searchSeq.current !== seq) return;
          setSearchHits(Array.isArray(hits) ? hits : []);
          setSearchedQuery(query);
        })
        .catch(() => {
          if (searchSeq.current !== seq) return;
          setSearchHits([]);
          setSearchedQuery(query);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimer(searchTimer);
  }, [railQuery, searchedQuery, clearTimer]);

  const searching =
    railQuery.trim() !== "" && railQuery.trim() !== searchedQuery;

  useEffect(() => {
    if (!locatedPath) return;
    const panel = railPanelRef.current;
    if (!panel) return;
    const matches = Array.from(
      panel.querySelectorAll<HTMLElement>(
        `[data-rail-path="${CSS.escape(locatedPath)}"]`,
      ),
    );
    if (matches.length === 0) return;
    matches[0].scrollIntoView({ block: "nearest" });
    for (const el of matches) {
      el.setAttribute("data-located", "true");
      el.classList.add("rail-located");
    }
    clearTimer(locateTimer);
    locateTimer.current = setTimeout(() => {
      locateTimer.current = null;
      for (const el of matches) {
        el.removeAttribute("data-located");
        el.classList.remove("rail-located");
      }
    }, 1600);
    return () => {
      clearTimer(locateTimer);
      for (const el of matches) {
        el.removeAttribute("data-located");
        el.classList.remove("rail-located");
      }
    };
  }, [locatedPath, railState, clearTimer]);

  useEffect(
    () => () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
      clearTimer(noticeTimer);
      clearTimer(locateTimer);
    },
    [clearTimer],
  );

  // 栏宽小于菜单宽度时，right-0 会把菜单顶到视口左缘之外，改用 left-0 翻转
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const anchor = menuRef.current;
    const menuEl = anchor?.querySelector<HTMLElement>(
      '[data-testid="rail-menu"]',
    );
    if (!anchor || !menuEl) return;
    setMenuFlip(anchor.getBoundingClientRect().right - menuEl.offsetWidth < 0);
  }, [menuOpen, railWidth]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const showNotice = useCallback(
    (message: string) => {
      setNotice(message);
      clearTimer(noticeTimer);
      noticeTimer.current = setTimeout(() => setNotice(null), 2400);
    },
    [clearTimer],
  );

  const onEnter = useCallback(() => {
    clearTimer(closeTimer);
    if (useStore.getState().railState !== "collapsed") return;
    clearTimer(openTimer);
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      if (useStore.getState().railState === "collapsed") {
        setRailState(nextRailState("collapsed", { type: "hover-enter" }));
      }
    }, HOVER_OPEN_MS);
  }, [clearTimer, setRailState]);

  const onLeave = useCallback(() => {
    clearTimer(openTimer);
    // 拖动调宽时不收起：指针可能短暂离开浮层边界。
    if (resizingRef.current) return;
    if (useStore.getState().railState !== "hover") return;
    clearTimer(closeTimer);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      if (useStore.getState().railState === "hover") {
        setRailState(nextRailState("hover", { type: "hover-leave" }));
      }
    }, HOVER_CLOSE_MS);
  }, [clearTimer, setRailState]);

  // 布局 / 密度 / 筛选变化后列表回顶
  useEffect(() => {
    const el = listScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [railLayout, railDensity, railChip, searchChip, searchTime]);

  const readPercentFor = useCallback(
    (path: string): number | undefined => readPercentOf(scrollPositions[path]),
    [scrollPositions],
  );

  const openInSplit = useCallback(
    (path: string, dir: "row" | "col") => {
      useStore.getState().splitPane(dir);
      void Promise.resolve(onOpenPath(path));
    },
    [onOpenPath],
  );

  // 悬浮预览锚定：x 恒 = 栏右缘 + 12（item 满宽，右缘 = 栏右缘），y 跟随行顶
  const openRowPreview = useCallback((item: RecentFile, el: HTMLElement) => {
    const st = useStore.getState();
    if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
    const rect = el.getBoundingClientRect();
    const current = st.preview?.source === "rail" ? st.preview : null;
    const size = clampPreviewSize(
      current
        ? { w: current.w, h: current.h }
        : { w: PREVIEW_RAIL_NARROW_W, h: PREVIEW_DEFAULT_H },
      PREVIEW_RAIL_NARROW_MIN_W,
    );
    const anchor = anchorFromRail({
      railRightX: rect.right,
      rowTopY: rect.top,
      rowHeight: rect.height,
      size,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    st.openPreview({
      path: item.path,
      title: item.title,
      x: anchor.x,
      y: anchor.y,
      w: size.w,
      h: size.h,
      flippedX: anchor.flipped.x,
      flippedY: anchor.flipped.y,
      source: "rail",
      narrow: true,
    });
  }, []);

  const onRowEnter = useCallback(
    (item: RecentFile, el: HTMLElement) => {
      const st = useStore.getState();
      if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
      clearTimer(previewTimer);
      // 已开则立即重锚到新行（x 不变、y 跟随），首次打开才走 250ms 延时
      if (st.preview?.source === "rail") {
        openRowPreview(item, el);
        return;
      }
      previewTimer.current = setTimeout(() => {
        previewTimer.current = null;
        openRowPreview(item, el);
      }, HOVER_DELAY_MS);
    },
    [clearTimer, openRowPreview],
  );

  const onRowLeftHalf = useCallback(() => {
    clearTimer(previewTimer);
    const st = useStore.getState();
    const p = st.preview;
    if (!p || p.source !== "rail" || p.pinned) return;
    st.closePreview();
  }, [clearTimer]);

  const handleRowMove = useCallback(
    (item: RecentFile, el: HTMLElement, e: ReactMouseEvent<HTMLElement>) => {
      const st = useStore.getState();
      if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
      const zone = isThumbZoneOfBox({ x: e.clientX, y: e.clientY }, boxOf(el))
        ? ("right" as const)
        : ("left" as const);
      const prev = hoverZoneRef.current;
      if (prev && prev.path === item.path && prev.zone === zone) return;
      hoverZoneRef.current = { path: item.path, zone };
      if (zone === "right") onRowEnter(item, el);
      else onRowLeftHalf();
    },
    [onRowEnter, onRowLeftHalf],
  );

  const onRowLeave = useCallback(() => {
    hoverZoneRef.current = null;
    clearTimer(previewTimer);
  }, [clearTimer]);

  const loadSnapshots = useCallback(() => {
    if (!isTauriEnv()) return;
    invoke<string[]>("list_config_snapshots")
      .then(setSnapshots)
      .catch((e) => log.warn("Rail", "读取快照失败", e));
  }, []);

  const restoreSnapshot = useCallback(
    (name: string) => {
      if (!isTauriEnv()) return;
      invoke("restore_config_snapshot", { name })
        .then(() => {
          reloadAppConfig();
          showNotice("已恢复快照");
        })
        .catch((e) => log.error("Rail", "恢复快照失败", e));
    },
    [showNotice],
  );

  const chips = useMemo(() => fileTypeChips(recentFiles), [recentFiles]);

  const searchMatches = useMemo(
    () =>
      railQuery.trim() === searchedQuery
        ? filterSearchHits(searchHits, {
            chip: searchChip,
            time: searchTime,
            query: railQuery,
          })
        : [],
    [searchHits, searchedQuery, searchChip, searchTime, railQuery],
  );
  const searchChips = useMemo(
    () => fileTypeChips(railQuery.trim() === searchedQuery ? searchHits : []),
    [searchHits, searchedQuery, railQuery],
  );

  const panelWidth = railWidth;
  const railSections = viewSpec.pinnedAndRecentOnly
    ? RAIL_SECTIONS.filter((s) => s.key === "pinned" || s.key === "recent")
    : RAIL_SECTIONS;
  const activeSection = railSections.some((s) => s.key === railSection)
    ? railSection
    : (railSections[0]?.key ?? "recent");

  const itemsForSection = useCallback(
    (section: RailSection): RecentFile[] => {
      if (section === "now") {
        const tab = activeTabId ? tabs[activeTabId] : null;
        return tab?.path ? recentFiles.filter((f) => f.path === tab.path) : [];
      }
      if (section === "pinned") {
        return recentFiles.filter((f) => pinnedPaths.includes(f.path));
      }
      return recentFiles;
    },
    [activeTabId, tabs, recentFiles, pinnedPaths],
  );

  const renderList = (section: RailSection): ReactNode => {
    const chip: RailChipKind = section === "category" ? railChip : "all";
    const matches = filterRailItems(itemsForSection(section), {
      chip,
      query: railQuery,
    }).filter(
      (m) => !viewSpec.unreadOnly || isUnread(m.item.path, scrollPositions),
    );
    return (
      <>
        {section === "category" && (
          <RailChips chips={chips} active={railChip} onPick={setRailChip} />
        )}
        {matches.length === 0 ? (
          <div
            data-testid="rail-empty"
            data-section={section}
            className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500"
          >
            {EMPTY_TEXT[section]}
          </div>
        ) : (
          matches.map((m) => (
            <RailRow
              key={m.item.path}
              item={m.item}
              ranges={m.ranges}
              density={railDensity}
              cardHeight={railCardHeight}
              pinned={pinnedPaths.includes(m.item.path)}
              readPercent={readPercentFor(m.item.path)}
              scale={section === "pinned" ? viewSpec.pinnedSegmentScale : 1}
              blockColors={viewSpec.blockColors}
              onOpen={onOpenPath}
              onSplit={openInSplit}
              onReveal={revealInFinder}
              onTogglePin={togglePinnedPath}
              onRowMove={(e) => handleRowMove(m.item, e.currentTarget, e)}
              onRowLeave={onRowLeave}
            />
          ))
        )}
      </>
    );
  };

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (railQuery !== "") {
      setRailQuery("");
      inputRef.current?.focus();
    } else {
      closeRailSearch();
      setRailState(nextRailState(railState, { type: "collapse" }));
    }
  };

  const header = (
    <div className="flex items-center gap-1 border-b border-[var(--app-border)] px-2 py-1.5">
      <span className="mr-auto truncate text-xs font-medium text-[var(--app-text)]">
        阅读空间
      </span>
      {(["stacked", "tabs"] as RailLayout[]).map((layout) => (
        <button
          key={layout}
          type="button"
          data-testid={`rail-mode-${layout}`}
          data-active={railLayout === layout ? "true" : "false"}
          aria-pressed={railLayout === layout}
          onClick={() => setRailLayout(layout)}
          className={`rounded px-1.5 py-0.5 text-[11px] ${
            railLayout === layout
              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "text-[var(--app-text-3)] hover:bg-[var(--app-sunken)]"
          }`}
        >
          {LAYOUT_LABELS[layout]}
        </button>
      ))}
      <div
        className="relative"
        ref={menuRef}
        onPointerEnter={hoverOpenMenu}
        onPointerLeave={hoverCloseMenu}
      >
        <button
          type="button"
          data-testid="rail-settings"
          title="布局 / 密度 / 快照"
          aria-label="布局 / 密度 / 快照"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            const next = !menuOpen;
            setMenuOpen(next);
            if (next) loadSnapshots();
          }}
          className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
        >
          <Icon name="settings" size={18} />
        </button>
        {menuOpen && (
          <div
            data-testid="rail-menu"
            role="menu"
            style={{
              ...(menuFlip
                ? { left: 0, right: "auto" }
                : { right: 0, left: "auto" }),
              maxHeight: RAIL_MENU_MAX_HEIGHT,
              overflowY: "auto",
            }}
            className="absolute top-full z-50 mt-1 w-56 rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 text-xs shadow-lg"
          >
            <div className="px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
              布局
            </div>
            {(["stacked", "tabs"] as RailLayout[]).map((layout) => (
              <button
                key={layout}
                type="button"
                role="menuitemradio"
                aria-checked={railLayout === layout}
                data-testid={`rail-layout-${layout}`}
                onClick={() => setRailLayout(layout)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
              >
                {railLayout === layout ? (
                  <Icon name="check" size={18} />
                ) : (
                  <span className="w-[18px]" />
                )}
                {LAYOUT_LABELS[layout]}
              </button>
            ))}
            <div className="mt-1 px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
              密度
            </div>
            {(["compact", "comfortable", "card"] as RailDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                role="menuitemradio"
                aria-checked={railDensity === d}
                data-testid={`rail-density-${d}`}
                onClick={() => setRailDensity(d)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
              >
                {railDensity === d ? (
                  <Icon name="check" size={18} />
                ) : (
                  <span className="w-[18px]" />
                )}
                {DENSITY_LABELS[d]}
              </button>
            ))}
            <div className="px-3 py-1.5">
              <div className="flex items-center justify-between text-[11px] text-[var(--app-text-2)]">
                <span>卡片高度</span>
                <span data-testid="rail-card-height-value">
                  {railCardHeight}px
                </span>
              </div>
              <input
                type="range"
                min={CARD_MIN}
                max={CARD_MAX}
                step={1}
                value={railCardHeight}
                data-testid="rail-card-height"
                aria-label="卡片高度"
                onChange={(e) => setRailCardHeight(Number(e.target.value))}
                className="mt-1 w-full accent-[var(--app-accent)]"
              />
            </div>
            <div className="mt-1 border-t border-[var(--app-border)] px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
              快照
            </div>
            {snapshots.length === 0 ? (
              <div className="px-3 py-1.5 text-[11px] text-[var(--app-text-3)]">
                暂无快照
              </div>
            ) : (
              snapshots.slice(-5).map((name) => (
                <button
                  key={name}
                  type="button"
                  data-testid="rail-snapshot"
                  onClick={() => restoreSnapshot(name)}
                  className="block w-full truncate px-3 py-1.5 text-left text-[11px] hover:bg-[var(--app-sunken)]"
                  title={name}
                >
                  {name}
                </button>
              ))
            )}
            <div className="mt-1 border-t border-[var(--app-border)]">
              <button
                type="button"
                data-testid="rail-save-default"
                onClick={() => {
                  saveRailViewSpec();
                  showNotice("已设为默认");
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
              >
                设为默认
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        data-testid="rail-pin"
        data-pinned={railState === "pinned" ? "true" : "false"}
        aria-pressed={railState === "pinned"}
        title={railState === "pinned" ? "取消钉住" : "钉住"}
        aria-label={railState === "pinned" ? "取消钉住" : "钉住"}
        onClick={toggleRailPin}
        className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
      >
        <Icon
          name={railState === "pinned" ? "pinOff" : "pin"}
          size={18}
          color={railState === "pinned" ? "var(--app-accent)" : undefined}
        />
      </button>
      <button
        type="button"
        data-testid="rail-collapse"
        title="收起"
        aria-label="收起"
        onClick={() => setRailState("collapsed")}
        className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
      >
        <Icon name="chevronLeft" size={18} />
      </button>
    </div>
  );

  const search = (
    <div
      data-testid="rail-search"
      data-search-open={railSearchOpen ? "true" : "false"}
      className="sticky top-0 z-20 flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-900"
    >
      <Icon name="search" size={18} color="var(--app-text-3)" />
      <input
        ref={inputRef}
        data-testid="rail-search-input"
        value={railQuery}
        placeholder="搜索本机文件"
        onChange={(e) => setRailQuery(e.target.value)}
        onFocus={openRailSearch}
        onKeyDown={onSearchKeyDown}
        className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
      />
      {railQuery !== "" && (
        <button
          type="button"
          data-testid="rail-search-clear"
          aria-label="清除"
          title="清除"
          onClick={() => {
            setRailQuery("");
            inputRef.current?.focus();
          }}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );

  const searchBlock =
    railSearchOpen && railQuery.trim() !== "" ? (
      <div
        data-testid="rail-search-results"
        className="border-b border-gray-100 pb-1 dark:border-gray-800"
      >
        <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="mr-auto font-medium">本机检索</span>
          <span data-testid="rail-search-count">
            {searching ? "检索中…" : `${searchMatches.length} 条`}
          </span>
        </div>
        <RailChips
          chips={searchChips}
          active={searchChip}
          onPick={setSearchChip}
        />
        <div
          data-testid="rail-search-times"
          className="flex flex-wrap gap-1 px-2 pb-1"
        >
          {RAIL_SEARCH_TIMES.map((t) => (
            <button
              key={t.key}
              type="button"
              data-testid="rail-search-time"
              data-time={t.key}
              data-active={searchTime === t.key ? "true" : "false"}
              onClick={() => setSearchTime(t.key)}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                searchTime === t.key
                  ? "border-transparent bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                  : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {searchMatches.length === 0 ? (
          <div
            data-testid="rail-search-empty"
            className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500"
          >
            {searching ? "检索中…" : "无命中"}
          </div>
        ) : (
          searchMatches.map((m) => {
            const item: RecentFile = {
              path: m.hit.path,
              title: m.hit.title,
              openedAt: m.hit.openedAt,
              excerpt: m.hit.excerpt,
            };
            return (
              <RailRow
                key={m.hit.path}
                item={item}
                ranges={m.ranges}
                excerptRanges={m.excerptRanges}
                density={railDensity}
                cardHeight={railCardHeight}
                pinned={pinnedPaths.includes(m.hit.path)}
                readPercent={readPercentFor(m.hit.path)}
                blockColors={viewSpec.blockColors}
                onOpen={onOpenPath}
                onSplit={openInSplit}
                onReveal={revealInFinder}
                onTogglePin={togglePinnedPath}
                onRowMove={(e) => handleRowMove(item, e.currentTarget, e)}
                onRowLeave={onRowLeave}
              />
            );
          })
        )}
      </div>
    ) : null;

  const listBody =
    railLayout === "stacked" ? (
      <div data-testid="rail-layout-stacked">
        {railSections.map((section) => (
          <section
            key={section.key}
            data-testid="rail-section"
            data-section={section.key}
          >
            <RailSectionHead label={section.label} sticky />
            {renderList(section.key)}
          </section>
        ))}
      </div>
    ) : (
      <div data-testid="rail-layout-tabs">
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {railSections.map((section) => (
            <button
              key={section.key}
              type="button"
              data-testid="rail-tab"
              data-section={section.key}
              data-active={activeSection === section.key ? "true" : "false"}
              onClick={() => setRailSection(section.key)}
              className={`flex-1 px-1 py-1 text-[11px] ${
                activeSection === section.key
                  ? "border-b-2 border-[var(--app-accent)] text-[var(--app-accent)]"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
        <div data-testid="rail-list">{renderList(activeSection)}</div>
      </div>
    );

  const panel = (
    <div
      ref={railPanelRef}
      className="rail-panel flex h-full flex-col bg-gray-50 text-sm dark:bg-gray-900"
    >
      {header}
      {search}
      <div
        ref={listScrollRef}
        data-testid="rail-scroll"
        className="flex-1 overflow-y-auto"
      >
        {searchBlock}
        {listBody}
      </div>
    </div>
  );

  const collapsed = (
    <button
      type="button"
      data-testid="rail-edge"
      data-rail-state="collapsed"
      onClick={toggleRailPin}
      title="阅读空间"
      aria-label="展开阅读空间"
      className="rail-edge flex h-full w-full items-center justify-center overflow-hidden text-gray-400"
    >
      <Icon name="chevronRight" size={18} className="rail-edge-icon" />
    </button>
  );

  if (railState === "pinned") {
    return (
      <div
        data-testid="rail-panel"
        data-rail-state="pinned"
        data-rail-pinned-width={panelWidth}
        data-rail-scale={viewSpec.pinnedSegmentScale}
        data-rail-block-colors={viewSpec.blockColors ? "true" : "false"}
        style={{ width: panelWidth }}
        className="rail-root relative shrink-0 border-r border-gray-200 dark:border-gray-700"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {panel}
        <div
          data-testid="rail-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整阅读空间宽度"
          title="拖动调整宽度"
          onPointerDown={onResizeStart}
          className="absolute right-0 top-0 z-20 h-full cursor-col-resize hover:bg-[var(--app-accent-soft)]"
          style={{ width: RAIL_RESIZE_HANDLE_PX }}
        />
        {notice && <RailNotice text={notice} />}
      </div>
    );
  }

  const overlayWidth = railState === "hover" ? panelWidth : RAIL_EDGE_PX;
  return (
    <>
      <div
        data-testid={railState === "collapsed" ? undefined : "rail-panel"}
        data-rail-state={railState}
        data-rail-overlay="true"
        data-rail-pinned-width={panelWidth}
        data-rail-scale={viewSpec.pinnedSegmentScale}
        data-rail-block-colors={viewSpec.blockColors ? "true" : "false"}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: overlayWidth,
          zIndex: 35,
        }}
        className="rail-root rail-overlay overflow-hidden shadow-lg"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {railState === "hover" ? panel : collapsed}
        {railState === "hover" && (
          <div
            data-testid="rail-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整阅读空间宽度"
            title="拖动调整宽度"
            onPointerDown={onResizeStart}
            className="absolute right-0 top-0 z-40 h-full cursor-col-resize hover:bg-[var(--app-accent-soft)]"
            style={{ width: RAIL_RESIZE_HANDLE_PX }}
          />
        )}
      </div>
      {notice && <RailNotice text={notice} />}
    </>
  );
}

function RailNotice({ text }: { text: string }) {
  return (
    <div
      role="status"
      data-testid="rail-notice"
      className="fixed bottom-6 left-1/2 z-[2147483000] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-700/95"
    >
      {text}
    </div>
  );
}

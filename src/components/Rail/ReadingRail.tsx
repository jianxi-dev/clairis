import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import { reloadAppConfig } from "../../hooks/useConfig";
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
  RAIL_EDGE_PX,
  RAIL_KIND_LABELS,
  RAIL_SECTIONS,
  RAIL_WIDTH_PX,
  filterRailItems,
  fileTypeChips,
  nextRailState,
  splitByRanges,
  type MatchRange,
  type RailChip,
  type RailChipKind,
  type RailDensity,
  type RailLayout,
  type RailSection,
} from "../../lib/railView";
import {
  CARD_MAX,
  CARD_MIN,
  DENSITY_HEIGHT,
  metaLine,
  parentPathOf,
  relativeDate,
  taskProgressOf,
  thumbDescriptorOf,
  thumbnailBox,
  type ThumbDescriptor,
} from "../../lib/railCards";
import { buildAssetUrl } from "../../renderers/html";
import {
  HOVER_DELAY_MS,
  PREVIEW_DEFAULT_H,
  PREVIEW_DEFAULT_W,
  anchorFromRail,
  clampPreviewSize,
} from "../../lib/previewAnchor";
import { log } from "../../utils/log";
import { isTauriEnv } from "../../utils/tauri";
import type { RecentFile } from "../../types";

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
  pinned: "还没有置顶条目",
  recent: "暂无最近文件",
  category: "该类型下暂无条目",
};

interface RailRowProps {
  item: RecentFile;
  ranges: MatchRange[];
  density: RailDensity;
  cardHeight: number;
  pinned: boolean;
  readPercent?: number;
  onOpen: (path: string) => void;
  onSplit: (path: string, dir: "row" | "col") => void;
  onReveal: (path: string) => void;
  onTogglePin: (path: string) => void;
  onRowHover?: (el: HTMLElement) => void;
  onRowLeave?: () => void;
}

/** 本地图片路径 → asset:// URL；浏览器直跑（无 Tauri）时保持原路径。 */
function assetSrc(src: string): string {
  if (!src) return "";
  if (/^(data:|blob:|asset:|https?:)/i.test(src)) return src;
  return isTauriEnv() ? buildAssetUrl(src) : src;
}

/**
 * 卡片右侧 4:3 缩略图（72×54）。
 *
 * 六种类型全部确定性离线生成：HTML=橙页、PDF=红文档页、视频=紫海报+播放、
 * 音频=粉波形、图片/MD 首图=真 <img>。纯文本与无图 MD 不会调用到这里。
 */
function RailThumb({ descriptor }: { descriptor: ThumbDescriptor }) {
  const box = thumbnailBox();
  const size = { width: box.w, height: box.h };
  const kind = descriptor.kind;

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

  const token = kind === "html-page" ? "html" : "pdf";
  return (
    <div
      data-testid="rail-thumb"
      data-thumb-kind={kind}
      style={{
        ...size,
        background: `color-mix(in srgb, var(--type-${token}) 16%, var(--app-surface))`,
        color: `var(--type-${token})`,
      }}
      className="rail-thumb rail-thumb-page shrink-0"
    >
      <span className="rail-thumb-line" />
      <span className="rail-thumb-line" />
      <span className="rail-thumb-line" />
    </div>
  );
}

function RailRow({
  item,
  ranges,
  density,
  cardHeight,
  pinned,
  readPercent,
  onOpen,
  onSplit,
  onReveal,
  onTogglePin,
  onRowHover,
  onRowLeave,
}: RailRowProps) {
  const kind: FileTypeKind = fileTypeOf(item.path);
  const segments = splitByRanges(item.title, ranges);
  const pinButton = (
    <button
      type="button"
      data-testid="rail-item-pin"
      data-pinned={pinned ? "true" : "false"}
      aria-label={pinned ? "取消置顶" : "置顶"}
      title={pinned ? "取消置顶" : "置顶"}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin(item.path);
      }}
      className="shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300"
    >
      <Icon
        name="pin"
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
        data-kind={kind}
        data-density="compact"
        style={{ height: DENSITY_HEIGHT.compact }}
        onMouseEnter={
          onRowHover ? (e) => onRowHover(e.currentTarget) : undefined
        }
        onMouseLeave={onRowLeave}
        className="group relative box-border flex items-center gap-1 px-2"
      >
        <button
          type="button"
          onClick={() => onOpen(item.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name={iconOfType(kind)} size={18} color={colorOfType(kind)} />
          {title("truncate text-xs text-gray-700 dark:text-gray-200")}
        </button>
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
        data-kind={kind}
        data-density="comfortable"
        style={{ height: DENSITY_HEIGHT.comfortable }}
        onMouseEnter={
          onRowHover ? (e) => onRowHover(e.currentTarget) : undefined
        }
        onMouseLeave={onRowLeave}
        className="group relative box-border flex flex-col justify-center px-2 py-1"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(item.path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <Icon name={iconOfType(kind)} size={18} color={colorOfType(kind)} />
            {title("truncate text-xs text-gray-700 dark:text-gray-200")}
          </button>
          {pinButton}
        </div>
        <div
          data-testid="rail-item-sub"
          className="mt-0.5 flex min-w-0 items-center gap-1 pl-[22px] text-[10px] text-gray-400 dark:text-gray-500"
        >
          <span className="truncate">{parentPathOf(item.path)}</span>
          <span>·</span>
          <span className="shrink-0">{relativeDate(item.openedAt)}</span>
          {pinned && (
            <span
              data-testid="rail-item-pinned"
              className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-1 text-[9px] leading-tight text-[var(--app-accent)]"
            >
              置顶
            </span>
          )}
        </div>
      </div>
    );
  }

  const thumb = thumbDescriptorOf(item);
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

  return (
    <div
      data-testid="rail-item"
      data-rail-path={item.path}
      data-kind={kind}
      data-density="card"
      style={{ height: cardHeight }}
      onMouseEnter={onRowHover ? (e) => onRowHover(e.currentTarget) : undefined}
      onMouseLeave={onRowLeave}
      className="group relative my-1 box-border flex flex-col justify-between overflow-hidden rounded border border-gray-200 px-2 py-1.5 dark:border-gray-700"
    >
      <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => onOpen(item.path)}
            className="flex min-w-0 items-start gap-1.5 text-left"
          >
            <Icon name={iconOfType(kind)} size={18} color={colorOfType(kind)} />
            {title(
              "line-clamp-2 text-xs font-semibold leading-snug text-gray-800 dark:text-gray-100",
            )}
          </button>
          <p
            data-testid="rail-card-excerpt"
            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400"
          >
            {item.excerpt || "（暂无正文）"}
          </p>
        </div>
        {thumb && <RailThumb descriptor={thumb} />}
      </div>

      <div
        data-testid="rail-card-meta"
        data-meta-kind={meta.kind}
        className="flex min-w-0 items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500"
      >
        <span
          data-testid="rail-card-chip"
          data-kind={kind}
          style={{ color: colorOfType(kind), borderColor: colorOfType(kind) }}
          className="shrink-0 rounded-full border px-1.5 py-px leading-none"
        >
          {RAIL_KIND_LABELS[kind]}
        </span>
        <button
          type="button"
          data-testid="rail-item-pin"
          data-pinned={pinned ? "true" : "false"}
          aria-label={pinned ? "取消置顶" : "置顶"}
          title={pinned ? "取消置顶" : "置顶"}
          onClick={() => onTogglePin(item.path)}
          className={`shrink-0 rounded px-1 py-px leading-none ${
            pinned
              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          置顶
        </button>
        {progressPct !== null && (
          <span
            data-testid="rail-meta-progress"
            data-meta-kind={meta.kind}
            className="flex shrink-0 items-center gap-1"
          >
            <span className="inline-block h-0.5 w-4 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
              <span
                className="block h-full bg-[var(--app-accent)]"
                style={{ width: `${progressPct}%` }}
              />
            </span>
            <span>{meta.text}</span>
          </span>
        )}
        <span data-testid="rail-item-date" className="shrink-0">
          {meta.date}
        </span>
        <button
          type="button"
          data-testid="rail-card-path"
          title={item.path}
          onClick={() => onReveal(item.path)}
          className="min-w-0 truncate text-left hover:text-gray-700 dark:hover:text-gray-200"
        >
          {meta.path}
        </button>
      </div>

      <div
        data-testid="rail-card-actions"
        className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
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
          <Icon name="eye" size={18} />
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
          <Icon name="splitRight" size={18} />
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
          <Icon name="splitDown" size={18} />
        </button>
      </div>
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

  const [pinnedPaths, setPinnedPaths] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(
    (ref: { current: ReturnType<typeof setTimeout> | null }) => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    },
    [],
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

  useEffect(
    () => () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
      clearTimer(noticeTimer);
    },
    [clearTimer],
  );

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
    if (useStore.getState().railState !== "hover") return;
    clearTimer(closeTimer);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      if (useStore.getState().railState === "hover") {
        setRailState(nextRailState("hover", { type: "hover-leave" }));
      }
    }, HOVER_CLOSE_MS);
  }, [clearTimer, setRailState]);

  const togglePinPath = useCallback((path: string) => {
    setPinnedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }, []);

  const readPercentOf = useCallback(
    (path: string): number | undefined => {
      const pos = scrollPositions[path];
      if (!pos || pos.contentHeight <= 0) return undefined;
      return Math.min(
        100,
        Math.round((pos.scrollPos / pos.contentHeight) * 100),
      );
    },
    [scrollPositions],
  );

  const revealPath = useCallback((path: string) => {
    if (!isTauriEnv()) return;
    invoke("reveal_in_finder", { path }).catch((e) =>
      log.warn("Rail", "在 Finder 中显示失败", e),
    );
  }, []);

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
        : { w: PREVIEW_DEFAULT_W, h: PREVIEW_DEFAULT_H },
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

  const onRowLeave = useCallback(() => {
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
    });
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
              readPercent={readPercentOf(m.item.path)}
              onOpen={onOpenPath}
              onSplit={openInSplit}
              onReveal={revealPath}
              onTogglePin={togglePinPath}
              onRowHover={(el) => onRowEnter(m.item, el)}
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
    <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
      <span className="mr-auto truncate text-xs font-medium text-gray-700 dark:text-gray-200">
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
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          {LAYOUT_LABELS[layout]}
        </button>
      ))}
      <div className="relative" ref={menuRef}>
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
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <Icon name="settings" size={18} />
        </button>
        {menuOpen && (
          <div
            data-testid="rail-menu"
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-56 rounded border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="px-3 py-1 text-[10px] uppercase text-gray-400">
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {railLayout === layout ? (
                  <Icon name="check" size={18} />
                ) : (
                  <span className="w-[18px]" />
                )}
                {LAYOUT_LABELS[layout]}
              </button>
            ))}
            <div className="mt-1 px-3 py-1 text-[10px] uppercase text-gray-400">
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
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
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
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
            <div className="mt-1 border-t border-gray-100 px-3 py-1 text-[10px] uppercase text-gray-400 dark:border-gray-700">
              快照
            </div>
            {snapshots.length === 0 ? (
              <div className="px-3 py-1.5 text-[11px] text-gray-400">
                暂无快照
              </div>
            ) : (
              snapshots.slice(-5).map((name) => (
                <button
                  key={name}
                  type="button"
                  data-testid="rail-snapshot"
                  onClick={() => restoreSnapshot(name)}
                  className="block w-full truncate px-3 py-1.5 text-left text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700"
                  title={name}
                >
                  {name}
                </button>
              ))
            )}
            <div className="mt-1 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                data-testid="rail-save-default"
                onClick={() => {
                  saveRailViewSpec();
                  showNotice("已设为默认");
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
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
        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <Icon
          name="pin"
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
        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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
        placeholder="搜索栏内文件"
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

  const listBody =
    railLayout === "stacked" ? (
      <div data-testid="rail-layout-stacked">
        {RAIL_SECTIONS.map((section) => (
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
          {RAIL_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              data-testid="rail-tab"
              data-section={section.key}
              data-active={railSection === section.key ? "true" : "false"}
              onClick={() => setRailSection(section.key)}
              className={`flex-1 px-1 py-1 text-[11px] ${
                railSection === section.key
                  ? "border-b-2 border-[var(--app-accent)] text-[var(--app-accent)]"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
        <div data-testid="rail-list">{renderList(railSection)}</div>
      </div>
    );

  const panel = (
    <div className="rail-panel flex h-full flex-col bg-gray-50 text-sm dark:bg-gray-900">
      {header}
      {search}
      <div className="flex-1 overflow-y-auto">{listBody}</div>
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
      className="rail-edge flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden bg-gray-50 text-gray-400 dark:bg-gray-900"
    >
      <Icon name="chevronRight" size={18} className="rail-edge-icon" />
      <span
        data-testid="rail-count"
        className="text-[9px] leading-none text-gray-500 dark:text-gray-400"
      >
        {recentFiles.length}
      </span>
    </button>
  );

  if (railState === "pinned") {
    return (
      <div
        data-testid="rail-panel"
        data-rail-state="pinned"
        style={{ width: RAIL_WIDTH_PX }}
        className="rail-root shrink-0 border-r border-gray-200 dark:border-gray-700"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {panel}
        {notice && <RailNotice text={notice} />}
      </div>
    );
  }

  const overlayWidth = railState === "hover" ? RAIL_WIDTH_PX : RAIL_EDGE_PX;
  return (
    <>
      <div
        data-testid={railState === "collapsed" ? undefined : "rail-panel"}
        data-rail-state={railState}
        data-rail-overlay="true"
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

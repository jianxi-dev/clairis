import { useRef } from "react";
import Icon from "../Icon";
import {
  parentPathOf,
  relativeDate,
  taskProgressOf,
  thumbDescriptorOf,
  type ThumbDescriptor,
} from "../../lib/railCards";
import {
  colorOfType,
  fileTypeOf,
  iconOfType,
  type FileTypeKind,
} from "../../lib/fileType";
import { assetSrc } from "../../lib/assetSrc";
import { fileDragHandlers } from "../../hooks/fileDrag";
import type { RecentFile } from "../../types";
import type { GridTileSize } from "../../lib/gridView";

const THUMB_H: Record<GridTileSize, number> = {
  small: 80,
  medium: 96,
  large: 160,
};

const COLUMN_SPAN: Record<GridTileSize, string> = {
  small: "span 1",
  medium: "span 2",
  large: "span 2",
};

const ROW_SPAN: Record<GridTileSize, string> = {
  small: "span 1",
  medium: "span 1",
  large: "span 2",
};

function ThumbBody({
  descriptor,
  item,
  kind,
  blockColors,
}: {
  descriptor: ThumbDescriptor | null;
  item: RecentFile;
  kind: FileTypeKind;
  blockColors: boolean;
}) {
  if (descriptor) {
    if (descriptor.kind === "image" || descriptor.kind === "md-cover") {
      return (
        <img
          src={assetSrc(descriptor.src ?? "")}
          alt=""
          className="h-full w-full object-cover"
        />
      );
    }
    if (descriptor.kind === "video-poster") {
      return (
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{
            background:
              "color-mix(in srgb, var(--type-video) 26%, var(--app-surface))",
          }}
        >
          <div
            data-tile-play
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
              <Icon name="video" size={24} color="#fff" />
            </span>
          </div>
        </div>
      );
    }
    if (descriptor.kind === "audio-wave") {
      return (
        <div
          className="flex h-full w-full items-center justify-center gap-0.5"
          style={{
            background:
              "color-mix(in srgb, var(--type-audio) 20%, var(--app-surface))",
          }}
        >
          {[8, 16, 24, 14, 20, 10, 18].map((h, i) => (
            <span
              key={i}
              style={{ height: h, background: "var(--type-audio)", width: 2 }}
            />
          ))}
        </div>
      );
    }
    const token = descriptor.kind === "html-page" ? "html" : "pdf";
    return (
      <div
        className="flex h-full w-full flex-col justify-center gap-1 px-2"
        style={{
          background: `color-mix(in srgb, var(--type-${token}) 16%, var(--app-surface))`,
        }}
      >
        <span
          className="block h-0.5 w-2/3 rounded"
          style={{ background: `var(--type-${token})` }}
        />
        <span
          className="block h-0.5 w-1/2 rounded"
          style={{ background: `var(--type-${token})` }}
        />
        <span
          className="block h-0.5 w-3/4 rounded"
          style={{ background: `var(--type-${token})` }}
        />
      </div>
    );
  }
  if ((item.excerpt ?? "").trim() !== "") {
    return (
      <div className="h-full w-full overflow-hidden p-1.5 text-[8px] leading-[1.35] text-[var(--app-text-3)]">
        {item.excerpt}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Icon
        name={iconOfType(kind)}
        size={24}
        color={blockColors ? colorOfType(kind) : undefined}
      />
    </div>
  );
}

interface GridTileProps {
  item: RecentFile;
  size: GridTileSize;
  selected: boolean;
  pinned: boolean;
  blockColors?: boolean;
  readPercent?: number;
  number?: number;
  onCardClick: (item: RecentFile, el: HTMLElement) => void;
  onOpen: (path: string) => void;
  onSplit: (path: string, dir: "row" | "col") => void;
  onReveal: (path: string) => void;
  onHoverEnter?: (item: RecentFile, el: HTMLElement) => void;
  onHoverLeave?: () => void;
}

/**
 * 网格 tile（layout-portal 10.1）。三型（大 2×2 / 中 2×1 / 小 1×1）共用同一
 * 骨架：2px 类型色顶条 + 4:3 缩略图 + 标题 + meta +（中/大）摘要 +（大）进度；
 * hover 右上角出图标动作。缩略图/摘要都来自真实文件数据，无占位。
 */
export default function GridTile({
  item,
  size,
  selected,
  pinned,
  blockColors = true,
  readPercent,
  number,
  onCardClick,
  onOpen,
  onSplit,
  onReveal,
  onHoverEnter,
  onHoverLeave,
}: GridTileProps) {
  const rootRef = useRef<HTMLElement>(null);
  const kind = fileTypeOf(item.path);
  const descriptor = thumbDescriptorOf(item);
  const iconColor = blockColors ? colorOfType(kind) : undefined;
  const tasks = taskProgressOf(item.excerpt);
  const readPct =
    typeof readPercent === "number" && Number.isFinite(readPercent)
      ? Math.min(100, Math.max(0, Math.round(readPercent)))
      : null;
  const progressPct = tasks
    ? Math.round((tasks.done / tasks.total) * 100)
    : readPct;

  const excerptLines =
    size === "large" ? "line-clamp-6" : size === "medium" ? "line-clamp-3" : "";

  return (
    <article
      ref={rootRef}
      {...fileDragHandlers(item.path)}
      data-grid-item={item.path}
      data-tile-path={item.path}
      data-tile-size={size}
      data-tile-kind={kind}
      data-selected={selected ? "true" : "false"}
      data-pinned={pinned ? "true" : "false"}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a")) return;
        onCardClick(item, rootRef.current!);
      }}
      onMouseEnter={(e) => onHoverEnter?.(item, e.currentTarget)}
      onMouseLeave={() => onHoverLeave?.()}
      style={{
        gridColumn: COLUMN_SPAN[size],
        gridRow: ROW_SPAN[size],
        outline: selected ? "2px solid var(--app-accent)" : undefined,
        outlineOffset: selected ? "-2px" : undefined,
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] hover:-translate-y-0.5 hover:shadow-md"
    >
      {number !== undefined && (
        <span
          data-grid-number={number}
          className="absolute left-1 top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[11px] font-semibold leading-none text-white shadow-sm"
        >
          {number}
        </span>
      )}
      <div
        data-tile-topbar
        data-tile-type={kind}
        style={{ height: 2, backgroundColor: colorOfType(kind) }}
      />
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <div
          data-tile-thumb
          data-thumb-kind={descriptor?.kind ?? "text"}
          style={{ height: THUMB_H[size], aspectRatio: "4 / 3" }}
          className="relative shrink-0 overflow-hidden rounded border border-[var(--app-border)] bg-[var(--app-sunken)]"
        >
          <ThumbBody
            descriptor={descriptor}
            item={item}
            kind={kind}
            blockColors={blockColors}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-start gap-1.5">
            <Icon name={iconOfType(kind)} size={18} color={iconColor} />
            <span className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--app-text)]">
              {item.title}
            </span>
          </div>
          <div
            data-tile-meta
            className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-[var(--app-text-3)]"
          >
            <span className="shrink-0">{relativeDate(item.openedAt)}</span>
            <span>·</span>
            <button
              type="button"
              data-tile-folder
              title={item.path}
              onClick={(e) => {
                e.stopPropagation();
                onReveal(item.path);
              }}
              className="min-w-0 truncate text-left hover:text-[var(--app-text)]"
            >
              {parentPathOf(item.path)}
            </button>
          </div>
          {excerptLines !== "" && (
            <p
              data-tile-excerpt
              className={`mt-1 ${excerptLines} text-[11px] leading-snug text-[var(--app-text-3)]`}
            >
              {item.excerpt || "（暂无正文）"}
            </p>
          )}
          {size === "large" && progressPct !== null && (
            <div
              data-tile-progress
              className="mt-auto flex items-center gap-1 pt-1 text-[10px] text-[var(--app-text-3)]"
            >
              <span className="inline-block h-0.5 w-16 overflow-hidden rounded bg-[var(--app-border)]">
                <span
                  className="block h-full bg-[var(--app-accent)]"
                  style={{ width: `${progressPct}%` }}
                />
              </span>
              <span>
                {tasks
                  ? `${tasks.done}/${tasks.total}`
                  : `已读 ${readPct ?? 0}%`}
              </span>
            </div>
          )}
        </div>
      </div>

      {kind !== "pdf" && (
        <div
          data-tile-actions
          className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <button
            type="button"
            data-tile-action="open"
            title="打开"
            aria-label="打开"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(item.path);
            }}
            className="rounded bg-[var(--app-surface)] p-0.5 text-[var(--app-text-3)] hover:text-[var(--app-text)]"
          >
            <Icon name="eye" size={18} />
          </button>
          <button
            type="button"
            data-tile-action="split-right"
            title="向右分屏"
            aria-label="向右分屏"
            onClick={(e) => {
              e.stopPropagation();
              onSplit(item.path, "row");
            }}
            className="rounded bg-[var(--app-surface)] p-0.5 text-[var(--app-text-3)] hover:text-[var(--app-text)]"
          >
            <Icon name="splitRight" size={18} />
          </button>
          <button
            type="button"
            data-tile-action="split-down"
            title="向下分屏"
            aria-label="向下分屏"
            onClick={(e) => {
              e.stopPropagation();
              onSplit(item.path, "col");
            }}
            className="rounded bg-[var(--app-surface)] p-0.5 text-[var(--app-text-3)] hover:text-[var(--app-text)]"
          >
            <Icon name="splitDown" size={18} />
          </button>
        </div>
      )}
    </article>
  );
}

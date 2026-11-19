import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { colorOfType, fileTypeOf, iconOfType } from "../lib/fileType";
import { revealInFinder } from "../lib/finder";
import { canCopyFile, copyFileToClipboard } from "../lib/clipboard";
import { getFileModified } from "../lib/fileInfo";
import { useStore } from "../stores";
import type { Tab } from "../types";

/** 信息窗与页签名之间的间距（px）。 */
const POPOVER_GAP = 6;
/** 视口边缘留白（px）。 */
const VIEWPORT_MARGIN = 8;

interface PathLayer {
  name: string;
  full: string;
}

/**
 * 把绝对路径拆成「文件夹链」：文件名已在首行展示，这里只列其上层目录，
 * 每层可单击在文件管理器中定位。
 */
function folderLayers(path: string): PathLayer[] {
  const segments = path.split("/").filter((s) => s.length > 0);
  const dirs = segments.slice(0, -1);
  const absolute = path.startsWith("/");
  return dirs.map((name, i) => {
    const chain = dirs.slice(0, i + 1).join("/");
    return { name, full: absolute ? `/${chain}` : chain };
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function copyFailureText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const io = (e as { Io?: { context?: unknown } }).Io;
    if (io && typeof io.context === "string" && io.context.length > 0) {
      return io.context;
    }
  }
  return "复制失败";
}

/** Unix 秒 → 「MM-DD HH:mm」（本地时区）。 */
function formatSaved(seconds: number): string {
  const d = new Date(seconds * 1000);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  tab: Tab;
  /** 页签名锚点的视口矩形。 */
  anchor: { left: number; bottom: number; width: number };
  /** 指针进入信息窗：取消页签侧的关闭计时。 */
  onKeepOpen: () => void;
  onClose: () => void;
}

/**
 * 页签名下拉信息窗（editor-surface-batch19 B7 / R-14）。
 *
 * 三行：① 文件类型图标 + 文件名（最大字号）+ 复制路径 / 复制文件；
 * ② 文件夹图标 + 文件夹链（每层可单击在文件管理器定位）；③ 时钟图标 + 最近保存时间。
 * 外壳为 8px 圆角矩形、固定 256px 宽（窄窗按视口钳制），完整文件名换行显示。
 */
export default function TabInfoPopover({
  tab,
  anchor,
  onKeepOpen,
  onClose,
}: Props) {
  const [modified, setModified] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null)
        window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const flash = (text: string) => {
    setNotice(text);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1400);
  };

  useEffect(() => {
    let alive = true;
    getFileModified(tab.path ?? "").then((sec) => {
      if (alive && sec != null) setModified(sec);
    });
    return () => {
      alive = false;
    };
  }, [tab.path]);

  // 位置：默认在页签名下方；测量后夹进视口，下方放不下则翻到上方。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.left, window.innerWidth - rect.width - VIEWPORT_MARGIN),
    );
    const below = anchor.bottom + POPOVER_GAP;
    const y =
      below + rect.height + VIEWPORT_MARGIN <= window.innerHeight
        ? below
        : Math.max(VIEWPORT_MARGIN, anchor.bottom - rect.height - POPOVER_GAP);
    setPos({ x, y });
  }, [anchor, tab.path, tab.title, modified]);

  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    return () => window.removeEventListener("scroll", onClose, true);
  }, [onClose]);

  const kind = tab.path ? fileTypeOf(tab.path) : "text";
  const layers = tab.path ? folderLayers(tab.path) : [];
  const openedAt = useStore((s) =>
    tab.path
      ? s.recentFiles.find((f) => f.path === tab.path)?.openedAt
      : undefined,
  );
  const savedText =
    modified != null
      ? `最近保存: ${formatSaved(modified)}`
      : openedAt
        ? `最近保存: ${formatSaved(new Date(openedAt).getTime() / 1000)}`
        : "最近保存: 未知";

  return createPortal(
    <div
      ref={ref}
      data-testid="tab-info-popover"
      className="tab-info"
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : {
              left: anchor.left,
              top: anchor.bottom + POPOVER_GAP,
              visibility: "hidden",
            }
      }
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
      role="tooltip"
    >
      <div className="tab-info__row" data-testid="tab-info-name">
        <Icon
          name={iconOfType(kind)}
          size={18}
          color={colorOfType(kind)}
          className="tab-info__type"
        />
        <span className="tab-info__name">{tab.title}</span>
        {tab.path && (
          <span className="tab-info__copy">
            <button
              type="button"
              data-testid="tab-copy-path"
              title="复制路径"
              aria-label="复制路径"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard
                  ?.writeText(tab.path ?? "")
                  .then(() => flash("已复制路径"))
                  .catch(() => flash("复制失败"));
              }}
            >
              <Icon name="copyPath" size={14} />
            </button>
            {canCopyFile() && (
              <button
                type="button"
                data-testid="tab-copy-file"
                title="复制文件"
                aria-label="复制文件"
                onClick={(e) => {
                  e.stopPropagation();
                  void copyFileToClipboard(tab.path ?? "")
                    .then(() => flash("已复制文件"))
                    .catch((e) => flash(`复制文件失败：${copyFailureText(e)}`));
                }}
              >
                <Icon name="copy" size={14} />
              </button>
            )}
          </span>
        )}
      </div>
      <div className="tab-info__row" data-testid="tab-info-path">
        <Icon name="folder" size={14} className="tab-info__icon" />
        <span className="tab-info__path">
          {layers.length === 0 ? (
            <button
              type="button"
              className="tab-info__layer"
              data-path-layer="/"
              onClick={() => {
                revealInFinder("/");
                onClose();
              }}
            >
              /
            </button>
          ) : (
            layers.map((layer, i) => (
              <span className="tab-info__seg" key={layer.full}>
                {i > 0 && (
                  <span className="tab-info__sep" aria-hidden="true">
                    ›
                  </span>
                )}
                <button
                  type="button"
                  className="tab-info__layer"
                  data-path-layer={layer.full}
                  onClick={() => {
                    revealInFinder(layer.full);
                    onClose();
                  }}
                >
                  {layer.name}
                </button>
              </span>
            ))
          )}
        </span>
        {notice && (
          <span
            className="tab-info__notice"
            data-testid="tab-copy-notice"
            aria-live="polite"
          >
            {notice}
          </span>
        )}
      </div>
      <div className="tab-info__row" data-testid="tab-info-time">
        <Icon name="clock" size={14} className="tab-info__icon" />
        <span className="tab-info__time">{savedText}</span>
      </div>
    </div>,
    document.body,
  );
}

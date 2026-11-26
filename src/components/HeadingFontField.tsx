import { useEffect, useMemo, useRef, useState } from "react";
import type { SystemFont } from "../types";
import { parseHeadingFontInput, type HeadingLevel } from "../lib/headingFonts";
import Icon from "./Icon";

interface HeadingFontFieldProps {
  level: HeadingLevel;
  /** 存储值：原始字体族名；undefined = 未配置（显示占位）。 */
  value: string | undefined;
  /** 本机已安装字体；null / 空 = 未枚举。 */
  options: SystemFont[] | null;
  /** 枚举是否成功；false 时不渲染候选面板（降级手输）。 */
  enumerated: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** 提交已解析的存储值；undefined = 清空该级（回落默认）。 */
  onCommit: (family: string | undefined) => void;
  /** 手动输入被拒绝（不在本机已安装列表）时通知父级展示提示。 */
  onInvalid?: () => void;
  /** 文本变化通知（父级可用于清除提示）。 */
  onTextChange?: (text: string) => void;
}

const LEVEL_NUMBER: Record<HeadingLevel, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/** 显示值：family 命中本机列表则显示 local化名，否则显示原值。 */
function displayFor(
  value: string | undefined,
  options: SystemFont[] | null,
): string {
  if (!value) return "";
  const hit = (options ?? []).find((font) => font.family === value);
  return hit ? hit.localized : value;
}

/** 文本命中候选（family 或 localized，大小写不敏感）时解析为 family；无命中返回 null。 */
function resolveFamily(
  text: string,
  options: SystemFont[] | null,
): string | null {
  const needle = text.trim().toLowerCase();
  if (!needle) return null;
  const hit = (options ?? []).find(
    (font) =>
      font.family.toLowerCase() === needle ||
      font.localized.toLowerCase() === needle,
  );
  return hit ? hit.family : null;
}

/**
 * 标题逐级字体输入（#1188）：自绘受控候选列表替换原生 `<datalist>`。
 *
 * 显示与存储分离——输入框与候选显示本机 local化名，写盘仍为原始 family。
 * 聚焦开面板；↑/↓ 移动高亮；Enter 选中高亮项（无高亮则提交手输文本）；
 * Esc / 点击外部关闭。枚举失败时不渲染面板，手输仍可提交。
 */
export default function HeadingFontField({
  level,
  value,
  options,
  enumerated,
  disabled = false,
  placeholder,
  onCommit,
  onInvalid,
  onTextChange,
}: HeadingFontFieldProps) {
  const number = LEVEL_NUMBER[level];
  const display = useMemo(() => displayFor(value, options), [value, options]);
  const [text, setText] = useState(display);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 外部值变化（落盘 / 配置重载）时在渲染期同步显示，避免 effect 级联渲染。
  const [prevDisplay, setPrevDisplay] = useState(display);
  if (prevDisplay !== display) {
    setPrevDisplay(display);
    setText(display);
  }

  const families = options && options.length > 0 ? options : null;

  const filtered = useMemo(() => {
    if (!families) return [];
    const needle = (query ?? "").trim().toLowerCase();
    if (!needle) return families;
    return families.filter(
      (font) =>
        font.localized.toLowerCase().includes(needle) ||
        font.family.toLowerCase().includes(needle),
    );
  }, [families, query]);

  const close = () => {
    setOpen(false);
    setHighlight(-1);
    setQuery(null);
  };

  const select = (font: SystemFont) => {
    setText(font.localized);
    setHighlight(-1);
    setOpen(false);
    setQuery(null);
    onCommit(font.family);
  };

  const commitText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOpen(false);
      setQuery(null);
      onCommit(undefined);
      return;
    }
    const resolved = resolveFamily(trimmed, families);
    const parsed = parseHeadingFontInput(resolved ?? trimmed, families);
    if (parsed.kind === "invalid") {
      setText(display);
      setHighlight(-1);
      onInvalid?.();
      return;
    }
    setOpen(false);
    setQuery(null);
    onCommit(parsed.kind === "valid" ? parsed.value : undefined);
  };

  // 点击面板外部关闭。
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // 高亮项滚动进可视区。
  useEffect(() => {
    if (!open || highlight < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const showPanel = open && enumerated && filtered.length > 0;

  return (
    <div ref={wrapRef} className="relative block">
      <span className="mb-1 block text-xs text-[var(--app-text-3)]">
        H{number}
      </span>
      <div className="relative">
        <input
          type="text"
          data-testid={`heading-font-${level}`}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={`H${number} 字体`}
          aria-expanded={open}
          onChange={(event) => {
            setText(event.target.value);
            setQuery(event.target.value);
            setHighlight(-1);
            onTextChange?.(event.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(-1);
            setQuery("");
          }}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlight((prev) =>
                prev < 0 ? 0 : Math.min(prev + 1, filtered.length - 1),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((prev) =>
                prev < 0 ? filtered.length - 1 : Math.max(prev - 1, 0),
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (showPanel && highlight >= 0 && filtered[highlight]) {
                select(filtered[highlight]);
              } else {
                commitText();
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 pr-7 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] disabled:opacity-60"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[var(--app-text-3)]">
          <Icon name="chevronDown" size={14} />
        </span>
      </div>

      {showPanel && (
        <div
          data-testid="heading-font-options"
          role="listbox"
          aria-label={`H${number} 字体候选`}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-lg"
        >
          <ul ref={listRef}>
            {filtered.map((font, index) => (
              <li key={font.family}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  data-index={index}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    select(font);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    index === highlight
                      ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                      : "text-[var(--app-text)]"
                  }`}
                >
                  <span className="truncate">{font.localized}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

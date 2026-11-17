import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { EditorMode } from "../../types";
import {
  isManagedDateKey,
  coerceFrontmatterValue,
  dedupeLinks,
  dedupeTags,
  formatFrontmatterValue,
  parseFrontmatter,
  parseLinkListText,
  parseTagListText,
  renameFrontmatterField,
  setFrontmatterField,
  tagColor,
  validateFieldValue,
  cloneFieldsForPaste,
  moveFieldBlock,
  newDocFrontmatter,
  uniqueKey,
  writeFrontmatterOrdered,
  type FrontmatterField,
  type FrontmatterRowId,
  type FrontmatterType,
} from "../../lib/frontmatter";
import {
  applyTemplate,
  BUILTIN_PROP_TEMPLATES,
  type PropTemplateConfig,
} from "../../lib/propTemplates";
import { getActiveEditorView } from "../../editors/editorRef";
import { useEditorStore } from "../../stores/editorStore";
import { useDocPropertyPanelStore } from "../../stores/docPropertyPanel";
import { useStore } from "../../stores/index";
import Icon from "../Icon";
import type { IconName } from "../../ui/icons";
import SuggestMenu from "./SuggestMenu";
import { useMenuPos } from "./useMenuPos";

/**
 * 文档属性面板（doc-property-panel 功能一 · 首通只读）。
 *
 * 数据源 = 当前页签 `content` 实时解析（不存快照）；三模式由外层用 CSS display
 * 控制显隐，本组件保持挂载，折叠等内部状态因此不因切模式丢失。
 * 本票只读：不渲染任何编辑入口（值编辑 / 改名 / 类型菜单 / 行操作 / 增删）。
 */

const TYPE_LABEL: Record<FrontmatterType, string> = {
  text: "文本",
  number: "数字",
  date: "日期",
  datetime: "日期时间",
  boolean: "布尔",
  array: "列表",
  select: "下拉",
  multiselect: "复选",
  unknown: "未识别",
};

const EMPTY_OVERRIDES: Record<string, FrontmatterType> = {};

/** 手柄拖拽阈值：位移小于 5px 视为点击选中，超过才进入排序（P-4）。 */
const DRAG_THRESHOLD = 5;

/** 新字段占位键名：重名时按 `new-field-2`… 顺延（P-9 首次添加自动建块）。 */
const NEW_FIELD_KEY = "new-field";

interface OpsBarProps {
  count: number;
  canPaste: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  onClear: () => void;
}

function OpsBar({
  count,
  canPaste,
  onCopy,
  onCut,
  onPaste,
  onUp,
  onDown,
  onDelete,
  onClear,
}: OpsBarProps) {
  const btn = (
    testId: string,
    icon: IconName,
    label: string,
    onClick: () => void,
    disabled = false,
    danger = false,
  ) => (
    <button
      key={testId}
      type="button"
      className={`dpb-ops-btn${danger ? " dpb-ops-btn-danger" : ""}`}
      data-testid={testId}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={14} />
    </button>
  );
  return (
    <div className="dpb-ops" data-testid="dpb-ops">
      <span className="dpb-ops-count" data-testid="dpb-ops-count">
        已选 {count} 项
      </span>
      {btn("dpb-ops-copy", "copy", "复制所选字段", onCopy)}
      {btn("dpb-ops-cut", "cut", "剪切所选字段", onCut)}
      {btn("dpb-ops-paste", "paste", "粘贴到所选行下方", onPaste, !canPaste)}
      {btn("dpb-ops-up", "arrowUp", "上移", onUp)}
      {btn("dpb-ops-down", "arrowDown", "下移", onDown)}
      {btn(
        "dpb-ops-del",
        "trash",
        "删除所选字段（标题位保留）",
        onDelete,
        false,
        true,
      )}
      {btn("dpb-ops-clear", "close", "取消选中", onClear)}
    </div>
  );
}

/** 类型菜单八类直选（unknown 是「?」收编态，不可选）。 */
const PICKABLE_TYPES: readonly FrontmatterType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "select",
  "multiselect",
  "boolean",
  "array",
];

/** 字段类型图标：日期 = 日历、日期时间 = 时钟（描边 1.7，design-system §2），其余字符。 */
function TypeIcon({ type }: { type: FrontmatterType }) {
  if (type === "date") {
    return (
      <svg
        className="dpb-ico-svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (type === "datetime") {
    return (
      <svg
        className="dpb-ico-svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </svg>
    );
  }
  const text =
    type === "text"
      ? "Aa"
      : type === "number"
        ? "123"
        : type === "boolean"
          ? "◉"
          : type === "select"
            ? "▾"
            : type === "multiselect"
              ? "☑"
              : type === "unknown"
                ? "?"
                : "☰";
  return (
    <span className="dpb-ico" aria-hidden="true">
      {text}
    </span>
  );
}

interface TypeSelectorProps {
  field: FrontmatterField;
  editable: boolean;
  onPick: (field: FrontmatterField, next: FrontmatterType) => void;
  showLabel?: boolean;
}

/** 字段名前的纯图标类型选择器：编辑态按钮弹八类菜单，预览态静态图标。 */
function TypeSelector({ field, editable, onPick, showLabel }: TypeSelectorProps) {
  // 托管日期键强制只读：类型菜单不可打开、光标不变（P-6）。
  const enabled = editable && !isManagedDateKey(field.key);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { pos: menuPos, ref: menuRef } = useMenuPos(open ? anchor : null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuRef]);

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        setAnchor({
          x: Math.max(8, r.left),
          y: Math.min(window.innerHeight - 240, r.bottom + 4),
        });
      }
    }
    setOpen((v) => !v);
  };

  return (
    <span className="dpb-type-wrap" ref={wrapRef}>
      {enabled ? (
        <button
          ref={btnRef}
          type="button"
          className="dpb-type"
          data-testid="dpb-type"
          title={`${TYPE_LABEL[field.type]}（点击选择类型）`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          <TypeIcon type={field.type} />
        </button>
      ) : (
        <span className="dpb-type dpb-type-ro" title={TYPE_LABEL[field.type]}>
          <TypeIcon type={field.type} />
        </span>
      )}
      {showLabel && (
        <span className="dpb-type-label" aria-hidden="true">
          {TYPE_LABEL[field.type]}
        </span>
      )}
      {enabled &&
        open &&
        anchor &&
        createPortal(
          <span
            ref={menuRef}
            className="dpb-menu"
            data-testid="dpb-type-menu"
            role="menu"
            aria-label="选择字段类型"
            style={{ left: (menuPos ?? anchor).x, top: (menuPos ?? anchor).y }}
          >
            {PICKABLE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                className={`dpb-menu-row${t === field.type ? " dpb-menu-row-cur" : ""}`}
                data-testid="dpb-type-option"
                data-type={t}
                aria-current={t === field.type}
                onClick={() => {
                  setOpen(false);
                  onPick(field, t);
                }}
              >
                <span className="dpb-menu-ico">
                  <TypeIcon type={t} />
                </span>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </span>,
          document.body,
        )}
    </span>
  );
}

interface RenameLabelProps {
  field: FrontmatterField;
  editable: boolean;
  className: string;
  /** 返回 null 表示改名成功，否则为拦截原因。 */
  onSubmit: (fromKey: string, toKey: string) => string | null;
  /** 等于本行键名时自动进入改名聚焦（新字段创建后就地改名）。 */
  autoFocusKey?: string | null;
  onAutoFocusHandled?: (key: string) => void;
}

/** 字段名就地改名（P-6）：编辑态点击变输入，Enter / 失焦提交，托管键锁定。 */
function RenameLabel({
  field,
  editable,
  className,
  onSubmit,
  autoFocusKey = null,
  onAutoFocusHandled,
}: RenameLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const errorTimer = useRef<number | null>(null);

  const locked = isManagedDateKey(field.key);
  const renameable = editable && !locked;

  const showError = useCallback((reason: string) => {
    setError(reason);
    if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 1500);
  }, []);

  useEffect(
    () => () => {
      if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    if (!renameable) return;
    doneRef.current = false;
    setDraft(field.key);
    setError(null);
    setEditing(true);
  }, [renameable, field.key]);

  useEffect(() => {
    if (autoFocusKey !== field.key) return;
    start();
    onAutoFocusHandled?.(field.key);
  }, [autoFocusKey, field.key, start, onAutoFocusHandled]);

  const commit = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = draft.trim();
    setEditing(false);
    if (next === field.key) {
      setError(null);
      return;
    }
    if (next === "") {
      showError("字段名不能为空");
      return;
    }
    if (/[:#\r\n]/.test(next)) {
      showError("字段名不能包含 : 或 # 等字符");
      return;
    }
    const reason = onSubmit(field.key, next);
    if (reason) showError(reason);
  };

  return (
    <span className="dpb-label-cell">
      {editing ? (
        <input
          className={`dpb-input dpb-rename ${className}`}
          data-testid="dpb-rename-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              doneRef.current = true;
              setEditing(false);
              setError(null);
            }
          }}
        />
      ) : (
        <span
          className={`${className}${renameable ? " dpb-label-clickable" : ""}`}
          data-testid="dpb-label"
          data-renameable={renameable ? "true" : "false"}
          title={renameable ? "点击改名" : undefined}
          role={renameable ? "button" : undefined}
          tabIndex={renameable ? 0 : undefined}
          onClick={renameable ? start : undefined}
          onKeyDown={
            renameable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    start();
                  }
                }
              : undefined
          }
        >
          {field.key}
        </span>
      )}
      {error && (
        <span className="dpb-error" data-testid="dpb-error" role="status">
          {error}
        </span>
      )}
    </span>
  );
}

function ValueView({
  field,
  editable = false,
  onStartEdit,
}: {
  field: FrontmatterField;
  editable?: boolean;
  onStartEdit?: () => void;
}) {
  if (field.type === "boolean") {
    const on = Boolean(field.value);
    return (
      <span
        className={`dpb-bool ${on ? "dpb-bool-on" : ""}`}
        title={on ? "已开启" : "已关闭"}
      >
        {on ? "◉" : "○"}
      </span>
    );
  }
  const long = field.display.length > 24;
  return (
    <span
      className={`dpb-v dpb-clamp2${editable ? " dpb-v-clickable" : ""}`}
      data-testid="dpb-value"
      title={editable ? "点击编辑值" : long ? field.display : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onClick={editable ? onStartEdit : undefined}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStartEdit?.();
              }
            }
          : undefined
      }
    >
      {field.display}
    </span>
  );
}

/** 进入编辑时的初始文本：数字用原值（不带千分位），日期时间用 `T` 分隔。 */
function rawForEdit(field: FrontmatterField): string {
  const v = field.value;
  if (v === null || v === undefined) return "";
  switch (field.type) {
    case "datetime":
      return String(v).replace(" ", "T");
    case "array":
      return Array.isArray(v) ? v.map((x) => String(x)).join("、") : String(v);
    default:
      return String(v);
  }
}

/** 单行文本超过此长度即进入多行文本域（P-3，阈值 40）。 */
const MULTILINE_THRESHOLD = 40;

interface ValueEditorProps {
  field: FrontmatterField;
  editable: boolean;
  onCommit: (key: string, value: unknown) => void;
}

function ValueEditor({ field, editable, onCommit }: ValueEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [multiline, setMultiline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);

  const startEdit = () => {
    if (!editable) return;
    const raw = rawForEdit(field);
    setDraft(raw);
    setMultiline(
      (field.type === "text" || field.type === "unknown") &&
        raw.length > MULTILINE_THRESHOLD,
    );
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(rawForEdit(field));
    setError(null);
  };

  const showError = useCallback((reason: string) => {
    setError(reason);
    if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 1500);
  }, []);

  useEffect(
    () => () => {
      if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    },
    [],
  );

  const commit = () => {
    const result = validateFieldValue(field.type, draft);
    setEditing(false);
    if (!result.ok) {
      setDraft(rawForEdit(field));
      showError(result.reason);
      return;
    }
    setError(null);
    onCommit(field.key, result.value);
  };

  if (field.type === "boolean") {
    if (!editable) return <ValueView field={field} />;
    const on = Boolean(field.value);
    return (
      <button
        type="button"
        className={`dpb-switch${on ? " dpb-switch-on" : ""}`}
        data-testid="dpb-value"
        role="switch"
        aria-checked={on}
        aria-label={on ? "布尔值 已开启" : "布尔值 已关闭"}
        title={on ? "已开启" : "已关闭"}
        onClick={() => onCommit(field.key, !on)}
      >
        {on ? "◉" : "○"}
      </button>
    );
  }

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
    };
    if (multiline) {
      return (
        <textarea
          className="dpb-input dpb-textarea"
          data-testid="dpb-input"
          rows={3}
          autoFocus
          {...shared}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
      );
    }
    const inputType =
      field.type === "date"
        ? "date"
        : field.type === "datetime"
          ? "datetime-local"
          : "text";
    return (
      <input
        className="dpb-input"
        data-testid="dpb-input"
        type={inputType}
        inputMode={field.type === "number" ? "numeric" : undefined}
        autoFocus
        {...shared}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            cancel();
          }
        }}
      />
    );
  }

  return (
    <>
      <ValueView field={field} editable={editable} onStartEdit={startEdit} />
      {error && (
        <span className="dpb-error" data-testid="dpb-error" role="status">
          {error}
        </span>
      )}
    </>
  );
}

function TagIcon() {
  return (
    <svg
      className="dpb-tag-ico"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function TagsValue({ field }: { field: FrontmatterField }) {
  if (!Array.isArray(field.value)) return <ValueView field={field} />;
  return (
    <span className="dpb-tags-group">
      {field.value.map((tag, i) => {
        const name = String(tag);
        return (
          <span
            className="dpb-tag"
            key={`${name}-${i}`}
            data-color={tagColor(name)}
          >
            <TagIcon />
            {name}
          </span>
        );
      })}
    </span>
  );
}

function fileNameOf(path: string | null, fallback: string): string {
  if (path) {
    const parts = path.split("/");
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return fallback;
}

function menuAnchorOf(el: HTMLElement | null): { x: number; y: number } | null {
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  return {
    x: Math.max(8, r.left),
    y: Math.min(window.innerHeight - 200, r.bottom + 4),
  };
}

interface EditorProps {
  field: FrontmatterField;
  onCommit: (key: string, value: unknown) => void;
}

/** 列表 / 复选值编辑：`[[` 弹文档菜单、chip 可移除、粘贴去重（P-3）。 */
function LinkListEditor({ field, onCommit }: EditorProps) {
  const tabs = useStore((s) => s.tabs);
  const items = Array.isArray(field.value) ? field.value.map(String) : [];
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const docNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tab of Object.values(tabs)) {
      const name = fileNameOf(tab.path, tab.title);
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
    return out.sort((a, b) => a.localeCompare(b, "zh"));
  }, [tabs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? docNames.filter((d) => d.toLowerCase().includes(q))
      : docNames;
    return list.slice(0, 9);
  }, [docNames, query]);

  const commit = (next: string[]) => {
    const merged = dedupeLinks(next);
    if (
      merged.length === items.length &&
      merged.every((v, i) => v === items[i])
    ) {
      return;
    }
    onCommit(field.key, merged);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    const idx = value.lastIndexOf("[[");
    if (idx >= 0) {
      setQuery(value.slice(idx + 2));
      setSel(0);
      setAnchor(menuAnchorOf(inputRef.current));
      setMenuOpen(true);
    } else if (menuOpen) {
      setMenuOpen(false);
    }
  };

  const pick = (index: number) => {
    const name = filtered[index];
    if (!name) return;
    commit([...items, `[[${name}]]`]);
    setInput("");
    setQuery("");
    setMenuOpen(false);
  };

  const move = (delta: 1 | -1) => {
    setSel((s) => {
      const n = filtered.length;
      if (n === 0) return 0;
      return Math.min(n - 1, Math.max(0, s + delta));
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setInput("");
    setQuery("");
  };

  const handleBlur = () => {
    const raw = input.trim();
    if (raw && !raw.includes("[[")) {
      commit([...items, ...parseLinkListText(raw)]);
    }
    setInput("");
    setMenuOpen(false);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("[[") && !/[、，,\r\n]/.test(text))) return;
    e.preventDefault();
    commit([...items, ...parseLinkListText(text)]);
    setInput("");
    setMenuOpen(false);
  };

  return (
    <span className="dpb-linklist" ref={wrapRef}>
      {items.map((item, i) => (
        <span className="dpb-link-chip" key={`${item}-${i}`}>
          <span className="dpb-link-chip-text">{item}</span>
          <button
            type="button"
            className="dpb-chip-x"
            data-testid="dpb-link-chip-x"
            aria-label={`移除 ${item}`}
            onClick={() => commit(items.filter((_, idx) => idx !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="dpb-input dpb-link-input"
        data-testid="dpb-link-input"
        value={input}
        placeholder="[[ 链接文档"
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
      />
      {menuOpen && (
        <SuggestMenu
          rows={filtered.map((d) => ({ id: d, label: d }))}
          selected={sel}
          onPick={pick}
          onMove={move}
          onEmptyEnter={closeMenu}
          onClose={closeMenu}
          anchor={anchor}
          context="属性面板 [[ 文档菜单打开"
          hostRef={wrapRef}
          testId="dpb-doc-menu"
          rowTestId="dpb-doc-menu-row"
          emptyText="没有匹配文档"
        />
      )}
    </span>
  );
}

/** 标签编辑：建议菜单、就地改名、删除、粘贴去重（P-5）。 */
function TagEditor({ field, onCommit }: EditorProps) {
  const tabs = useStore((s) => s.tabs);
  const tags = Array.isArray(field.value) ? field.value.map(String) : [];
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const knownTags = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tab of Object.values(tabs)) {
      const parsed = parseFrontmatter(tab.content);
      const tagsField = parsed.fields.find(
        (f) => f.key === "tags" && Array.isArray(f.value),
      );
      if (!tagsField) continue;
      for (const value of tagsField.value as unknown[]) {
        const name = String(value);
        if (name && !seen.has(name)) {
          seen.add(name);
          out.push(name);
        }
      }
    }
    return out;
  }, [tabs]);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    const list = q
      ? knownTags.filter((t) => t.toLowerCase().includes(q))
      : knownTags;
    return list.slice(0, 9);
  }, [knownTags, input]);

  const commit = (next: string[]) => {
    const merged = dedupeTags(next);
    if (
      merged.length === tags.length &&
      merged.every((v, i) => v === tags[i])
    ) {
      return;
    }
    onCommit(field.key, merged);
  };

  const addTag = (name: string) => {
    const value = name.trim();
    if (!value) return;
    commit([...tags, value]);
    setInput("");
    setMenuOpen(false);
  };

  const removeTag = (name: string) => {
    commit(tags.filter((t) => t !== name));
  };

  const commitRename = () => {
    if (renaming === null) return;
    const next = draft.trim();
    const old = renaming;
    setRenaming(null);
    if (!next || next === old) return;
    commit(tags.map((t) => (t === old ? next : t)));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setSel(0);
    if (value) {
      setAnchor(menuAnchorOf(inputRef.current));
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  };

  const pick = (index: number) => {
    const name = filtered[index];
    if (name) addTag(name);
  };

  const move = (delta: 1 | -1) => {
    setSel((s) => {
      const n = filtered.length;
      if (n === 0) return 0;
      return Math.min(n - 1, Math.max(0, s + delta));
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setInput("");
  };

  const handleBlur = () => {
    if (input.trim()) addTag(input);
    else {
      setInput("");
      setMenuOpen(false);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !/[、，,\r\n]/.test(text)) return;
    e.preventDefault();
    commit([...tags, ...parseTagListText(text)]);
    setInput("");
    setMenuOpen(false);
  };

  return (
    <span className="dpb-tags-editor" ref={wrapRef}>
      <span className="dpb-tags-group">
        {tags.map((tag) =>
          renaming === tag ? (
            <input
              key={tag}
              className="dpb-input dpb-tag-rename"
              data-testid="dpb-tag-rename"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <span className="dpb-tag" key={tag} data-color={tagColor(tag)}>
              <TagIcon />
              <button
                type="button"
                className="dpb-tag-name"
                data-testid="dpb-tag-name"
                title="点击改名"
                onClick={() => {
                  setRenaming(tag);
                  setDraft(tag);
                }}
              >
                {tag}
              </button>
              <button
                type="button"
                className="dpb-tag-x"
                data-testid="dpb-tag-x"
                aria-label={`删除标签 ${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ),
        )}
        <input
          ref={inputRef}
          className="dpb-input dpb-tag-input"
          data-testid="dpb-tag-input"
          value={input}
          placeholder="+ 标签"
          onChange={handleChange}
          onBlur={handleBlur}
          onPaste={handlePaste}
        />
      </span>
      {menuOpen && (
        <SuggestMenu
          rows={filtered.map((t) => ({ id: t, label: t, icon: <TagIcon /> }))}
          selected={sel}
          onPick={pick}
          onMove={move}
          onEmptyEnter={() => addTag(input)}
          onClose={closeMenu}
          anchor={anchor}
          context="属性面板标签建议菜单打开"
          hostRef={wrapRef}
          testId="dpb-tag-menu"
          rowTestId="dpb-tag-menu-row"
          emptyText="没有匹配的已有标签，Enter 用输入值新建"
        />
      )}
    </span>
  );
}

/** 值单元格：列表 / 复选走 chip 编辑器，其余走通用值编辑器。 */
function FieldValue({
  field,
  editable,
  onCommit,
}: EditorProps & { editable: boolean }) {
  // 托管日期键在组件内部强制只读：调用点漏传 editable 也不漂移（P-6）。
  const effectiveEditable = editable && !isManagedDateKey(field.key);
  if (
    effectiveEditable &&
    (field.type === "array" || field.type === "multiselect")
  ) {
    return <LinkListEditor field={field} onCommit={onCommit} />;
  }
  return (
    <ValueEditor
      field={field}
      editable={effectiveEditable}
      onCommit={onCommit}
    />
  );
}

/** 标签单元格：预览态只读胶囊，编辑态可增删改名。 */
function TagsCell({
  field,
  editable,
  onCommit,
}: EditorProps & { editable: boolean }) {
  if (!editable) return <TagsValue field={field} />;
  return <TagEditor field={field} onCommit={onCommit} />;
}

interface TemplateMenuButtonProps {
  templates: readonly PropTemplateConfig[];
  onApply: (template: PropTemplateConfig) => void;
}

function TemplateMenuButton({ templates, onApply }: TemplateMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { pos: menuPos, ref: menuRef } = useMenuPos(open ? anchor : null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuRef]);

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        setAnchor({
          x: Math.max(8, r.left),
          y: Math.min(window.innerHeight - 220, r.bottom + 4),
        });
      }
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="dpb-tpl-btn"
        data-testid="dpb-template"
        title="套用属性模板（只补缺失键）"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        ▤ 模板
      </button>
      {open &&
        anchor &&
        createPortal(
          <span
            ref={menuRef}
            className="dpb-menu"
            data-testid="dpb-template-menu"
            role="menu"
            aria-label="属性模板"
            style={{ left: (menuPos ?? anchor).x, top: (menuPos ?? anchor).y }}
          >
            {templates.length === 0 ? (
              <span className="dpb-menu-row dpb-menu-empty">没有可用模板</span>
            ) : (
              templates.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  role="menuitem"
                  className="dpb-menu-row"
                  data-testid="dpb-template-option"
                  data-name={t.name}
                  onClick={() => {
                    setOpen(false);
                    onApply(t);
                  }}
                >
                  <span className="dpb-menu-ico">▤</span>
                  <span className="dpb-menu-label">{t.name}</span>
                </button>
              ))
            )}
          </span>,
          document.body,
        )}
    </>
  );
}

interface TitleValueProps {
  field: FrontmatterField | null;
  editable: boolean;
  onCommit: (key: string, value: unknown) => void;
}

function TitleValue({ field, editable, onCommit }: TitleValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const text = field?.display || "未命名";

  const start = () => {
    setDraft(field?.value == null ? "" : String(field.value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft;
    const prev = field?.value == null ? "" : String(field.value);
    if (next === prev) return;
    onCommit("title", next);
  };

  if (!editable) {
    return (
      <span className="dpb-a-title" title={field?.display || undefined}>
        {text}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        className="dpb-input dpb-title-input"
        data-testid="dpb-title-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className="dpb-a-title dpb-title-clickable"
      data-testid="dpb-title"
      title="点击编辑标题"
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          start();
        }
      }}
    >
      {text}
    </span>
  );
}

interface DocPropertyBarProps {
  content: string;
  mode: EditorMode;
  /** 新建（未落盘）文档：默认显隐走全局 newDocVisible。 */
  isNewDoc?: boolean;
  /** 文档标识：切换文档时隔离用户判定的类型（typeOverrides 会话态）。 */
  docKey?: string;
}

export default function DocPropertyBar({
  content,
  mode,
  isNewDoc = false,
  docKey = "",
}: DocPropertyBarProps) {
  const hidden = useDocPropertyPanelStore((s) => s.hidden);
  const variant = useDocPropertyPanelStore((s) => s.variant);
  const collapsed = useDocPropertyPanelStore((s) => s.collapsed);
  const setCollapsed = useDocPropertyPanelStore((s) => s.setCollapsed);
  const setHidden = useDocPropertyPanelStore((s) => s.setHidden);
  const applyModeDefault = useDocPropertyPanelStore((s) => s.applyModeDefault);
  const propertyBar = useEditorStore((s) => s.config.propertyBar);
  const propTemplates =
    useEditorStore((s) => s.config.propTemplates) ?? BUILTIN_PROP_TEMPLATES;
  const propAliasMap = useEditorStore((s) => s.config.propAliasMap);
  const previewDefault = propertyBar?.displayDefault?.preview ?? "show";
  const editDefault = propertyBar?.displayDefault?.edit ?? "show";

  const [selMap, setSelMap] = useState<Record<string, FrontmatterRowId[]>>({});
  const [clipboard, setClipboard] = useState<FrontmatterField[] | null>(null);
  const [drop, setDrop] = useState<{ index: number; top: number } | null>(null);
  const [pendingRenameKey, setPendingRenameKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => new Set(selMap[docKey] ?? []),
    [selMap, docKey],
  );
  const selectedRef = useRef<Set<FrontmatterRowId>>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const applySelection = useCallback(
    (ids: FrontmatterRowId[]) => {
      const next = new Set(ids);
      selectedRef.current = next;
      setSelMap((prev) => ({ ...prev, [docKey]: [...next] }));
    },
    [docKey],
  );

  const lastDocKeyRef = useRef(docKey);
  useEffect(() => {
    if (lastDocKeyRef.current === docKey) return;
    lastDocKeyRef.current = docKey;
    selectedRef.current = new Set();
    setSelMap((prev) => ({ ...prev, [docKey]: [] }));
    setClipboard(null);
  }, [docKey]);

  // 进入预览 / 编辑模式时应用配置默认档；从源码态切回保留用户状态（P-1）。
  const lastModeRef = useRef<EditorMode | null>(null);
  const lastDefaultsRef = useRef(`${previewDefault}/${editDefault}`);
  useEffect(() => {
    if (mode !== "preview" && mode !== "edit") return;
    const defaultsKey = `${previewDefault}/${editDefault}`;
    const defaultsChanged = lastDefaultsRef.current !== defaultsKey;
    lastDefaultsRef.current = defaultsKey;
    const prev = lastModeRef.current;
    lastModeRef.current = mode;
    if (prev !== null && prev !== "preview" && prev !== "edit") return;
    if (prev === mode && !defaultsChanged) return;
    applyModeDefault(mode, propertyBar);
  }, [mode, previewDefault, editDefault, propertyBar, applyModeDefault]);

  // 新建文档：默认显隐全局生效（newDocVisible）。
  useEffect(() => {
    if (!isNewDoc) return;
    setHidden(!(propertyBar?.newDocVisible ?? true));
  }, [isNewDoc, propertyBar?.newDocVisible, setHidden]);

  const handleCommitField = useCallback(
    (key: string, value: unknown) => {
      const view = getActiveEditorView();
      if (!view) return;
      const result = setFrontmatterField(content, key, value);
      if (result.text === content) return;
      view.dispatch({
        changes: { from: result.from, to: result.to, insert: result.block },
      });
      if (key === "title" && docKey) {
        useStore.getState().setTabTitle(docKey, String(value ?? ""));
      }
    },
    [content, docKey],
  );

  const [tplStatus, setTplStatus] = useState<string | null>(null);
  const tplStatusTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (tplStatusTimer.current !== null)
        window.clearTimeout(tplStatusTimer.current);
    },
    [],
  );
  const showTplStatus = useCallback((text: string) => {
    setTplStatus(text);
    if (tplStatusTimer.current !== null)
      window.clearTimeout(tplStatusTimer.current);
    tplStatusTimer.current = window.setTimeout(() => setTplStatus(null), 3000);
  }, []);

  const handleApplyTemplate = useCallback(
    (template: PropTemplateConfig) => {
      const parsedNow = parseFrontmatter(content, propAliasMap);
      const base = parsedNow.present ? parsedNow.fields : [];
      const { fields: next, added, skipped } = applyTemplate(base, template);
      if (added === 0) {
        showTplStatus(
          `模板「${template.name}」没有新增字段（${skipped} 个键已存在）`,
        );
        return;
      }
      const result = writeFrontmatterOrdered(content, next);
      if (result.text !== content) {
        getActiveEditorView()?.dispatch({
          changes: { from: result.from, to: result.to, insert: result.block },
        });
      }
      showTplStatus(
        `套用模板「${template.name}」→ 新增 ${added} 个字段${skipped ? `，跳过 ${skipped} 个已有键` : ""}`,
      );
    },
    [content, propAliasMap, showTplStatus],
  );

  const [overrideMap, setOverrideMap] = useState<
    Record<string, Record<string, FrontmatterType>>
  >({});
  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});
  const typeErrorTimer = useRef<number | null>(null);
  const typeOverrides = overrideMap[docKey] ?? EMPTY_OVERRIDES;

  useEffect(
    () => () => {
      if (typeErrorTimer.current !== null)
        window.clearTimeout(typeErrorTimer.current);
    },
    [],
  );

  const showTypeError = useCallback((key: string, reason: string) => {
    setTypeErrors((prev) => ({ ...prev, [key]: reason }));
    if (typeErrorTimer.current !== null)
      window.clearTimeout(typeErrorTimer.current);
    typeErrorTimer.current = window.setTimeout(() => {
      setTypeErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1500);
  }, []);

  const handlePickType = useCallback(
    (field: FrontmatterField, next: FrontmatterType) => {
      if (next === field.type) return;
      setOverrideMap((prev) => {
        const cur = prev[docKey] ?? {};
        return { ...prev, [docKey]: { ...cur, [field.key]: next } };
      });
      const result = coerceFrontmatterValue(next, field.value);
      if (!result.ok) {
        showTypeError(field.key, result.reason);
        return;
      }
      if (JSON.stringify(result.value) !== JSON.stringify(field.value)) {
        handleCommitField(field.key, result.value);
      }
    },
    [docKey, handleCommitField, showTypeError],
  );

  const handleRename = useCallback(
    (fromKey: string, toKey: string): string | null => {
      const result = renameFrontmatterField(content, fromKey, toKey);
      if (!result.ok) return result.reason;
      if (result.text !== content) {
        const view = getActiveEditorView();
        view?.dispatch({
          changes: { from: result.from, to: result.to, insert: result.block },
        });
      }
      setOverrideMap((prev) => {
        const cur = prev[docKey];
        if (!cur || !(fromKey in cur)) return prev;
        const next = { ...cur };
        next[toKey] = next[fromKey];
        delete next[fromKey];
        return { ...prev, [docKey]: next };
      });
      return null;
    },
    [content, docKey],
  );

  const parsed = useMemo(
    () => parseFrontmatter(content, propAliasMap),
    [content, propAliasMap],
  );
  const fields = useMemo(() => {
    if (Object.keys(typeOverrides).length === 0) return parsed.fields;
    return parsed.fields.map((f) => {
      const t = typeOverrides[f.key];
      return t && t !== f.type
        ? { ...f, type: t, display: formatFrontmatterValue(f.value, t) }
        : f;
    });
  }, [parsed, typeOverrides]);
  const titleField = fields.find((f) => f.key === "title") ?? null;
  const titleView = titleField
    ? { ...titleField, display: titleField.display || "未命名" }
    : null;
  const tagsField =
    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
  const rest = fields.filter((f) => f !== titleField && f !== tagsField);
  const editable = mode === "edit";

  const titleIdx = titleField ? fields.indexOf(titleField) : -1;
  const tagsIdx = tagsField ? fields.indexOf(tagsField) : -1;
  const selectMode = editable && selected.size > 0;

  const numericSelected = useCallback((): number[] => {
    return [...selectedRef.current]
      .filter((x): x is number => typeof x === "number")
      .sort((a, b) => a - b);
  }, []);

  const commitFields = useCallback(
    (next: FrontmatterField[], nextSel: FrontmatterRowId[]) => {
      const result = writeFrontmatterOrdered(content, next);
      if (result.text !== content) {
        const view = getActiveEditorView();
        view?.dispatch({
          changes: { from: result.from, to: result.to, insert: result.block },
        });
      }
      applySelection(nextSel);
    },
    [content, applySelection],
  );

  const handleAutoFocusHandled = useCallback((key: string) => {
    setPendingRenameKey((cur) => (cur === key ? null : cur));
  }, []);

  /** 添加字段（P-9）：空态先按 P-7 建 frontmatter 块，再追加一个空文本行。 */
  const handleAddField = useCallback(() => {
    if (!parsed.present) {
      const seedText = newDocFrontmatter();
      const seedFields = parseFrontmatter(seedText, propAliasMap).fields;
      const key = uniqueKey(
        NEW_FIELD_KEY,
        seedFields.map((f) => f.key),
      );
      const seeded = writeFrontmatterOrdered(seedText, [
        ...seedFields,
        { key, type: "text", value: "", display: "" },
      ]);
      getActiveEditorView()?.dispatch({
        changes: { from: 0, to: 0, insert: seeded.text },
      });
      setPendingRenameKey(key);
      return;
    }
    const key = uniqueKey(
      NEW_FIELD_KEY,
      fields.map((f) => f.key),
    );
    commitFields(
      [...fields, { key, type: "text", value: "", display: "" }],
      [],
    );
    setPendingRenameKey(key);
  }, [parsed.present, fields, commitFields, propAliasMap]);

  const toggleRow = useCallback(
    (id: FrontmatterRowId) => {
      const next = new Set(selectedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      applySelection([...next]);
    },
    [applySelection],
  );

  const handleSelectAll = useCallback(() => {
    applySelection(
      fields.map((_, i) => i).filter((i) => i !== titleIdx && i !== tagsIdx),
    );
  }, [fields, titleIdx, tagsIdx, applySelection]);

  const handleClear = useCallback(() => applySelection([]), [applySelection]);

  const handleCopy = useCallback(
    (cut: boolean) => {
      const nums = numericSelected();
      const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
      const idxs = wantsTags ? [...nums, tagsIdx] : nums;
      if (idxs.length === 0) return;
      setClipboard(cloneFieldsForPaste(fields, idxs));
      if (!cut) return;
      const dropSet = new Set(nums);
      const next = fields.filter((_, i) => !dropSet.has(i));
      if (wantsTags) {
        const ti = next.findIndex((f) => f.key === "tags");
        if (ti >= 0) next[ti] = { ...next[ti], value: [], display: "" };
      }
      commitFields(next, []);
    },
    [fields, tagsIdx, numericSelected, commitFields],
  );

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    const nums = numericSelected();
    const anchor = nums.length > 0 ? Math.max(...nums) : fields.length - 1;
    const insertAt = Math.max(0, Math.min(fields.length, anchor + 1));
    const taken = new Set(fields.map((f) => f.key));
    const clones = clipboard.map((f) => {
      const key = uniqueKey(f.key, taken);
      taken.add(key);
      return key === f.key ? f : { ...f, key };
    });
    commitFields(
      [...fields.slice(0, insertAt), ...clones, ...fields.slice(insertAt)],
      clones.map((_, k) => insertAt + k),
    );
  }, [clipboard, fields, numericSelected, commitFields]);

  const handleDelete = useCallback(() => {
    const nums = numericSelected().filter((i) => i !== titleIdx);
    const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
    if (nums.length === 0 && !wantsTags) return;
    const dropSet = new Set(nums);
    const next = fields.filter((_, i) => !dropSet.has(i));
    if (wantsTags) {
      const ti = next.findIndex((f) => f.key === "tags");
      if (ti >= 0) next[ti] = { ...next[ti], value: [], display: "" };
    }
    commitFields(next, []);
  }, [fields, titleIdx, tagsIdx, numericSelected, commitFields]);

  /** B 态行内单行删除：把该行设为唯一选中后复用批量删除，保持单事务可撤销（P-4）。 */
  const handleDeleteRow = useCallback(
    (id: FrontmatterRowId) => {
      applySelection([id]);
      handleDelete();
    },
    [applySelection, handleDelete],
  );

  const handleMove = useCallback(
    (delta: 1 | -1) => {
      const nums = numericSelected();
      if (nums.length === 0) return;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (delta < 0 && min === 0) return;
      if (delta > 0 && max === fields.length - 1) return;
      const target = delta > 0 ? max + 2 : min - 1;
      const next = moveFieldBlock(fields, nums, target);
      const moved = nums.map((i) => fields[i]);
      const newSel = moved.map((f) => next.indexOf(f)).filter((i) => i >= 0);
      commitFields(next, newSel);
    },
    [fields, numericSelected, commitFields],
  );

  const rowIdFromEl = (el: Element): FrontmatterRowId | null => {
    const raw = el.getAttribute("data-row-id");
    if (raw == null) return null;
    return raw === "tags" ? "tags" : Number(raw);
  };

  const dropRows = (): HTMLElement[] => {
    const root = panelRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>("[data-row-id]"),
    ).filter((el) => el.getAttribute("data-row-id") !== "tags");
  };

  const computeDropIndex = (clientY: number): number => {
    const rows = dropRows();
    if (rows.length === 0) return fields.length;
    for (const el of rows) {
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        return Number(el.getAttribute("data-row-id"));
      }
    }
    return fields.length;
  };

  const dropTopFor = (index: number): number => {
    const root = panelRef.current;
    const rows = dropRows();
    if (!root || rows.length === 0) return 0;
    const panelRect = root.getBoundingClientRect();
    const el =
      index >= fields.length
        ? rows[rows.length - 1]
        : rows.find((e) => e.getAttribute("data-row-id") === String(index));
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return index >= fields.length
      ? r.bottom - panelRect.top
      : r.top - panelRect.top;
  };

  const onHandlePointerDown = (
    e: React.PointerEvent<HTMLSpanElement>,
    id: FrontmatterRowId,
  ) => {
    if (!editable) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const movable = typeof id === "number";
    let started = false;
    let over: number | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (
          Math.abs(ev.clientY - startY) + Math.abs(ev.clientX - startX) <
          DRAG_THRESHOLD
        ) {
          return;
        }
        if (!movable) return;
        started = true;
        if (!selectedRef.current.has(id)) applySelection([id]);
      }
      over = computeDropIndex(ev.clientY);
      setDrop({ index: over, top: dropTopFor(over) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrop(null);
      if (!started) {
        toggleRow(id);
        return;
      }
      if (over == null) return;
      const nums = [...selectedRef.current]
        .filter((x): x is number => typeof x === "number")
        .sort((a, b) => a - b);
      const moveIdxs = nums.includes(id as number) ? nums : [id as number];
      const next = moveFieldBlock(fields, moveIdxs, over);
      const moved = moveIdxs.map((i) => fields[i]);
      const newSel = moved.map((f) => next.indexOf(f)).filter((i) => i >= 0);
      commitFields(next, newSel);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onPanelClickCapture = (e: React.MouseEvent) => {
    if (!editable || selectedRef.current.size === 0) return;
    const t = e.target as HTMLElement | null;
    if (!t || typeof t.closest !== "function") return;
    if (t.closest('[data-testid="dpb-row-handle"]')) return;
    const rowEl = t.closest("[data-row-id]");
    if (!rowEl) return;
    e.preventDefault();
    e.stopPropagation();
    const id = rowIdFromEl(rowEl);
    if (id != null) toggleRow(id);
  };

  useEffect(() => {
    if (!editable || selected.size === 0) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("[data-row-id]")) return;
      if (t.closest('[data-testid="dpb-ops"]')) return;
      if (t.closest('[data-testid="dpb-tools"]')) return;
      if (selectedRef.current.size > 0) applySelection([]);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [editable, selected.size, applySelection]);

  if (hidden) {
    return (
      <div
        className="dpb-hidden-note"
        data-testid="dpb-hidden-note"
        role="status"
      >
        已隐藏，按 <span className="dpb-kbd">⌘⇧Y</span> 恢复
      </div>
    );
  }

  if (!parsed.present) {
    return (
      <div className="dpb-empty" data-testid="dpb-empty">
        暂无 frontmatter 属性 · 首次添加字段时自动创建
        {editable && (
          <button
            type="button"
            className="dpb-tpl-btn dpb-empty-add"
            data-testid="dpb-add-field"
            title="添加字段"
            onClick={handleAddField}
          >
            + 添加字段
          </button>
        )}
      </div>
    );
  }

  const collapseButton = editable ? (
    <button
      type="button"
      className="dpb-collapse"
      data-testid="dpb-collapse"
      aria-expanded={!collapsed}
      onClick={() => setCollapsed(!collapsed)}
    >
      {collapsed ? "⌄ 展开" : "⌃ 折叠"}
    </button>
  ) : null;

  const selectAllButton = editable ? (
    <button
      type="button"
      className="dpb-select-all"
      data-testid="dpb-select-all"
      title="全选字段（不含标题与标签）"
      onClick={handleSelectAll}
    >
      ☑ 全选
    </button>
  ) : null;

  const opsBar =
    editable && selected.size > 0 && !collapsed ? (
      <OpsBar
        count={selected.size}
        canPaste={clipboard !== null && clipboard.length > 0}
        onCopy={() => handleCopy(false)}
        onCut={() => handleCopy(true)}
        onPaste={handlePaste}
        onUp={() => handleMove(-1)}
        onDown={() => handleMove(1)}
        onDelete={handleDelete}
        onClear={handleClear}
      />
    ) : null;

  const dropLine = drop ? (
    <span
      className="dpb-drop-line"
      data-testid="dpb-drop-line"
      style={{ top: drop.top }}
    />
  ) : null;

  if (variant === "B") {
    return (
      <div
        ref={panelRef}
        className={`dpb-panel dpb-b${selectMode ? " select-mode" : ""}${drop ? " dpb-dragging" : ""}`}
        data-testid="dpb-b"
        onClickCapture={onPanelClickCapture}
      >
        <div className="dpb-b-head">
          <span className="dpb-b-title">文档属性</span>
          <span className="dpb-b-sub">
            {collapsed ? `已折叠 · ${fields.length} 个字段` : ""}
          </span>
          <span className="dpb-b-tools" data-testid="dpb-tools">
            {editable && (
              <TemplateMenuButton
                templates={propTemplates}
                onApply={handleApplyTemplate}
              />
            )}
            {selectAllButton}
            {collapseButton}
            {tplStatus && (
              <span
                className="dpb-tpl-status"
                data-testid="dpb-tpl-status"
                role="status"
              >
                {tplStatus}
              </span>
            )}
          </span>
        </div>
        {!collapsed && (
          <div className="dpb-b-body">
            {opsBar}
            {dropLine}
            {fields.map((field, i) => {
              const rowId: FrontmatterRowId = field === tagsField ? "tags" : i;
              return (
                <div
                  className={`dpb-b-row${i === fields.length - 1 ? " dpb-b-row-last" : ""}${selected.has(rowId) ? " dpb-row-selected" : ""}`}
                  key={field.key}
                  data-testid="dpb-row"
                  data-key={field.key}
                  data-row-id={rowId}
                  data-locked={isManagedDateKey(field.key) ? "true" : undefined}
                >
                  <span
                    className="dpb-b-handle"
                    data-testid="dpb-row-handle"
                    title="点击选中（可多选）· 拖动排序"
                    onPointerDown={(e) => onHandlePointerDown(e, rowId)}
                  >
                    {editable ? "⠿" : ""}
                  </span>
                  <span className="dpb-b-type" title={TYPE_LABEL[field.type]}>
                    <TypeSelector
                      field={field}
                      editable={editable}
                      onPick={handlePickType}
                      showLabel
                    />
                  </span>
                  <RenameLabel
                    field={field}
                    editable={editable}
                    className="dpb-b-label"
                    onSubmit={handleRename}
                    autoFocusKey={pendingRenameKey}
                    onAutoFocusHandled={handleAutoFocusHandled}
                  />
                  <span className="dpb-b-value">
                    {field === tagsField ? (
                      <TagsCell
                        field={field}
                        editable={editable}
                        onCommit={handleCommitField}
                      />
                    ) : (
                      <FieldValue
                        field={
                          field === titleField && titleView ? titleView : field
                        }
                        editable={editable}
                        onCommit={handleCommitField}
                      />
                    )}
                    {typeErrors[field.key] && (
                      <span
                        className="dpb-error"
                        data-testid="dpb-error"
                        role="status"
                      >
                        {typeErrors[field.key]}
                      </span>
                    )}
                  </span>
                  <span className="dpb-b-x">
                    {isManagedDateKey(field.key) ? (
                      <Icon name="lock" size={14} className="dpb-lock" />
                    ) : field !== titleField &&
                      field !== tagsField &&
                      editable &&
                      !selectMode ? (
                      <button
                        type="button"
                        className="dpb-row-x"
                        data-testid="dpb-row-del"
                        title="删除该字段"
                        aria-label={`删除字段 ${field.key}`}
                        onClick={() => handleDeleteRow(rowId)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
            <div className="dpb-b-foot">
              <span data-testid="dpb-count">{fields.length} 个字段</span>
              {editable && (
                <button
                  type="button"
                  className="dpb-tpl-btn"
                  data-testid="dpb-add-field"
                  title="添加字段"
                  onClick={handleAddField}
                >
                  + 添加字段
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`dpb-panel dpb-a${selectMode ? " select-mode" : ""}${drop ? " dpb-dragging" : ""}`}
      data-testid="dpb-a"
      onClickCapture={onPanelClickCapture}
    >
      <div className="dpb-a-line">
        {titleField ? (
          <span
            className={`dpb-a-title-cell${selected.has(titleIdx) ? " dpb-row-selected" : ""}`}
            data-row-id={titleIdx}
          >
            {editable && (
              <span
                className="dpb-row-handle dpb-row-handle-title"
                data-testid="dpb-row-handle"
                title="点击选中标题位"
                onPointerDown={(e) => onHandlePointerDown(e, titleIdx)}
              >
                ⠿
              </span>
            )}
            <TitleValue
              field={titleView}
              editable={editable}
              onCommit={handleCommitField}
            />
          </span>
        ) : (
          <span className="dpb-a-title">（无标题）</span>
        )}
        <span className="dpb-a-spacer" />
        <span className="dpb-a-tools" data-testid="dpb-tools">
          {editable && (
            <button
              type="button"
              className="dpb-tpl-btn"
              data-testid="dpb-add-field"
              title="添加字段"
              onClick={handleAddField}
            >
              + 添加字段
            </button>
          )}
          {editable && (
            <TemplateMenuButton
              templates={propTemplates}
              onApply={handleApplyTemplate}
            />
          )}
          {selectAllButton}
          {collapseButton}
          {tplStatus && (
            <span
              className="dpb-tpl-status"
              data-testid="dpb-tpl-status"
              role="status"
            >
              {tplStatus}
            </span>
          )}
        </span>
      </div>
      {collapsed ? (
        <div className="dpb-a-summary">已折叠 · {fields.length} 个字段</div>
      ) : (
        <>
          {opsBar}
          {dropLine}
          <div className="dpb-a-meta">
            {rest.map((field) => {
              const rowId = fields.indexOf(field);
              return (
                <span
                  className={`dpb-chip${selected.has(rowId) ? " dpb-row-selected" : ""}`}
                  key={field.key}
                  data-testid="dpb-row"
                  data-key={field.key}
                  data-row-id={rowId}
                  data-locked={isManagedDateKey(field.key) ? "true" : undefined}
                >
                  {editable && (
                    <span
                      className="dpb-row-handle"
                      data-testid="dpb-row-handle"
                      title="点击选中（可多选）· 拖动排序"
                      onPointerDown={(e) => onHandlePointerDown(e, rowId)}
                    >
                      ⠿
                    </span>
                  )}
                  {editable && (
                    <TypeSelector
                      field={field}
                      editable={editable}
                      onPick={handlePickType}
                      showLabel
                    />
                  )}
                  <RenameLabel
                    field={field}
                    editable={editable}
                    className="dpb-k"
                    onSubmit={handleRename}
                    autoFocusKey={pendingRenameKey}
                    onAutoFocusHandled={handleAutoFocusHandled}
                  />
                  <FieldValue
                    field={field}
                    editable={editable && !isManagedDateKey(field.key)}
                    onCommit={handleCommitField}
                  />
                  {typeErrors[field.key] && (
                    <span
                      className="dpb-error"
                      data-testid="dpb-error"
                      role="status"
                    >
                      {typeErrors[field.key]}
                    </span>
                  )}
                  {isManagedDateKey(field.key) ? (
                    <Icon name="lock" size={14} className="dpb-lock" />
                  ) : editable && !selectMode ? (
                    <button
                      type="button"
                      className="dpb-row-x"
                      data-testid="dpb-row-del"
                      title="删除该字段"
                      aria-label={`删除字段 ${field.key}`}
                      onClick={() => handleDeleteRow(rowId)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  ) : null}
                </span>
              );
            })}
            {tagsField && (
              <span
                className={`dpb-chip${selected.has("tags") ? " dpb-row-selected" : ""}`}
                data-testid="dpb-row"
                data-key="tags"
                data-row-id="tags"
              >
                {editable && (
                  <span
                    className="dpb-row-handle"
                    data-testid="dpb-row-handle"
                    title="点击选中标签行"
                    onPointerDown={(e) => onHandlePointerDown(e, "tags")}
                  >
                    ⠿
                  </span>
                )}
                {editable && <TypeIcon type="array" />}
                <RenameLabel
                  field={tagsField}
                  editable={editable}
                  className="dpb-k"
                  onSubmit={handleRename}
                />
                <TagsCell
                  field={tagsField}
                  editable={editable}
                  onCommit={handleCommitField}
                />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

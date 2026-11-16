import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import type { EditorMode } from "../../types";
import {
  isManagedDateKey,
  coerceFrontmatterValue,
  formatFrontmatterValue,
  parseFrontmatter,
  renameFrontmatterField,
  setFrontmatterField,
  tagColor,
  validateFieldValue,
  type FrontmatterField,
  type FrontmatterType,
} from "../../lib/frontmatter";
import { getActiveEditorView } from "../../editors/editorRef";
import { useEditorStore } from "../../stores/editorStore";
import { useDocPropertyPanelStore } from "../../stores/docPropertyPanel";

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
}

/** 字段名前的纯图标类型选择器：编辑态按钮弹八类菜单，预览态静态图标。 */
function TypeSelector({ field, editable, onPick }: TypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);

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
  }, [open]);

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
      {editable ? (
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
      {editable &&
        open &&
        anchor &&
        createPortal(
          <span
            ref={menuRef}
            className="dpb-menu"
            data-testid="dpb-type-menu"
            role="menu"
            aria-label="选择字段类型"
            style={{ left: anchor.x, top: anchor.y }}
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
}

/** 字段名就地改名（P-6）：编辑态点击变输入，Enter / 失焦提交，托管键锁定。 */
function RenameLabel({
  field,
  editable,
  className,
  onSubmit,
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

  const start = () => {
    if (!renameable) return;
    doneRef.current = false;
    setDraft(field.key);
    setError(null);
    setEditing(true);
  };

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
      <span className={`dpb-bool ${on ? "dpb-bool-on" : ""}`}>
        {on ? "◉ 开" : "○ 关"}
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
      {field.display || "—"}
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
        title="点击切换"
        onClick={() => onCommit(field.key, !on)}
      >
        {on ? "◉ 开" : "○ 关"}
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

function LockIcon() {
  return (
    <svg
      className="dpb-lock"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
  const previewDefault = propertyBar?.displayDefault?.preview ?? "show";
  const editDefault = propertyBar?.displayDefault?.edit ?? "show";

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
    },
    [content],
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

  const parsed = useMemo(() => parseFrontmatter(content), [content]);
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
  const tagsField =
    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
  const rest = fields.filter((f) => f !== titleField && f !== tagsField);
  const editable = mode === "edit";

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

  if (variant === "B") {
    return (
      <div className="dpb-panel dpb-b" data-testid="dpb-b">
        <div className="dpb-b-head">
          <span className="dpb-b-title">文档属性</span>
          <span className="dpb-b-sub">
            {collapsed ? `已折叠 · ${fields.length} 个字段` : ""}
          </span>
          <span className="dpb-b-tools">{collapseButton}</span>
        </div>
        {!collapsed && (
          <div className="dpb-b-body">
            {fields.map((field, i) => (
              <div
                className={`dpb-b-row${i === fields.length - 1 ? " dpb-b-row-last" : ""}`}
                key={field.key}
                data-testid="dpb-row"
                data-key={field.key}
                data-locked={isManagedDateKey(field.key) ? "true" : undefined}
              >
                <span className="dpb-b-handle">{editable ? "⠿" : ""}</span>
                <span className="dpb-b-type" title={TYPE_LABEL[field.type]}>
                  <TypeSelector
                    field={field}
                    editable={editable}
                    onPick={handlePickType}
                  />
                </span>
                <RenameLabel
                  field={field}
                  editable={editable}
                  className="dpb-b-label"
                  onSubmit={handleRename}
                />
                <span className="dpb-b-value">
                  {field === tagsField ? (
                    <TagsValue field={field} />
                  ) : (
                    <ValueEditor
                      field={field}
                      editable={editable && !isManagedDateKey(field.key)}
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
                  {isManagedDateKey(field.key) ? <LockIcon /> : null}
                </span>
              </div>
            ))}
            <div className="dpb-b-foot">
              <span data-testid="dpb-count">{fields.length} 个字段</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dpb-panel dpb-a" data-testid="dpb-a">
      <div className="dpb-a-line">
        <span className="dpb-a-title" title={titleField?.display || undefined}>
          {titleField?.display || "（无标题）"}
        </span>
        <span className="dpb-a-spacer" />
        {collapseButton}
      </div>
      {collapsed ? (
        <div className="dpb-a-summary">已折叠 · {fields.length} 个字段</div>
      ) : (
        <div className="dpb-a-meta">
          {rest.map((field) => (
            <span
              className="dpb-chip"
              key={field.key}
              data-testid="dpb-row"
              data-key={field.key}
              data-locked={isManagedDateKey(field.key) ? "true" : undefined}
            >
              {editable && (
                <span className="dpb-row-handle" aria-hidden="true">
                  ⠿
                </span>
              )}
              {editable && (
                <TypeSelector
                  field={field}
                  editable={editable}
                  onPick={handlePickType}
                />
              )}
              <RenameLabel
                field={field}
                editable={editable}
                className="dpb-k"
                onSubmit={handleRename}
              />
              <ValueEditor
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
              {isManagedDateKey(field.key) && <LockIcon />}
            </span>
          ))}
          {tagsField && (
            <span className="dpb-chip" data-testid="dpb-row" data-key="tags">
              {editable && (
                <span className="dpb-row-handle" aria-hidden="true">
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
              <TagsValue field={tagsField} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

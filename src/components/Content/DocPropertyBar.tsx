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
  managedDateDisplay,
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
import { readDocFieldTypes, writeDocFieldTypes } from "../../lib/docFieldTypes";
import { getPanelEditorView } from "../../editors/editorRef";
import { log } from "../../utils/log";
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
function TypeSelector({
  field,
  editable,
  onPick,
  showLabel,
}: TypeSelectorProps) {
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
  /** 有值即把本名称单元格登记为可选中节点（#1128）。 */
  selectId?: FrontmatterRowId | null;
  selected?: boolean;
}

/** 字段名就地改名（P-6）：编辑态单击变输入，Enter / 失焦提交，托管键锁定。 */
function RenameLabel({
  field,
  editable,
  className,
  onSubmit,
  autoFocusKey = null,
  onAutoFocusHandled,
  selectId = null,
  selected = false,
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
    <span
      className="dpb-label-cell"
      data-select-node={selectId != null ? String(selectId) : undefined}
    >
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
          className={`${className}${renameable ? " dpb-label-clickable" : ""}${selected ? " dpb-node-selected" : ""}`}
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

function splitDatetime(raw: string): { date: string; time: string } {
  const full = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(raw);
  if (full) return { date: full[1], time: full[2] };
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return { date: dateOnly ? dateOnly[1] : "", time: "" };
}

/** 单行文本超过此长度即进入多行文本域（P-3，阈值 40）。 */
const MULTILINE_THRESHOLD = 40;

const CAL_WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymdOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

interface CalCell {
  date: string;
  day: number;
}

/** 周一为首列的月历格子；月份外的空位为 null。 */
function calCells(year: number, month: number): (CalCell | null)[] {
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (CalCell | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) {
    cells.push({ date: ymdOf(year, month, d), day: d });
  }
  return cells;
}

function clampStep(value: number, max: number): number {
  const span = max + 1;
  return ((value % span) + span) % span;
}

interface TimeStepperProps {
  label: string;
  testId: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}

/** 时分步进：上下按钮 + 可直接输入的数值框；按钮不作为 Tab 停靠点。 */
function TimeStepper({
  label,
  testId,
  value,
  max,
  onChange,
}: TimeStepperProps) {
  const parse = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    onChange(digits === "" ? 0 : Math.min(max, Number.parseInt(digits, 10)));
  };
  return (
    <span className="dpb-dt-step">
      <button
        type="button"
        className="dpb-dt-step-btn"
        data-testid={`${testId}-up`}
        aria-label={`${label}加一`}
        tabIndex={-1}
        onClick={() => onChange(clampStep(value + 1, max))}
      >
        ▲
      </button>
      <input
        className="dpb-input dpb-dt-step-input"
        data-testid={testId}
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={pad2(value)}
        onChange={(e) => parse(e.target.value)}
      />
      <button
        type="button"
        className="dpb-dt-step-btn"
        data-testid={`${testId}-down`}
        aria-label={`${label}减一`}
        tabIndex={-1}
        onClick={() => onChange(clampStep(value - 1, max))}
      >
        ▼
      </button>
    </span>
  );
}

interface DatetimeEditorProps {
  field: FrontmatterField;
  editable: boolean;
  onCommit: (key: string, value: unknown) => void;
}

/**
 * 日期时间值编辑器：单一 popover 面板（月历网格 + 时分步进）。
 * 面板内操作只改内部状态，Enter / 失焦 / 点击外部才提交（沿用 onBlur 链路）。
 */
function DatetimeEditor({ field, editable, onCommit }: DatetimeEditorProps) {
  const [editing, setEditing] = useState(false);
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("00:00");
  const [cal, setCal] = useState({ year: 0, month: 0 });
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false);
  const pointerInsideRef = useRef(false);
  const errorTimer = useRef<number | null>(null);
  const latest = useRef({ datePart: "", timePart: "00:00", touched: false });
  latest.current = { datePart, timePart, touched };
  const { pos, ref: panelRef } = useMenuPos(editing && anchor ? anchor : null);

  useEffect(
    () => () => {
      if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    },
    [],
  );

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      const el = slotRef.current?.querySelector(
        '[data-testid="dpb-value"]',
      ) as HTMLElement | null;
      el?.focus();
    });
  };

  const finish = useCallback(
    (mode: "commit" | "cancel") => {
      if (doneRef.current) return;
      doneRef.current = true;
      const { datePart: d, timePart: t, touched: tc } = latest.current;
      setEditing(false);
      if (mode === "cancel" || !tc) {
        setError(null);
        restoreFocus();
        return;
      }
      const hour = Number(t.slice(0, 2)) || 0;
      const minute = Number(t.slice(3, 5)) || 0;
      const next = d ? `${d}T${pad2(hour)}:${pad2(minute)}` : "";
      const result = validateFieldValue("datetime", next);
      if (!result.ok) {
        setError(result.reason);
        restoreFocus();
        return;
      }
      setError(null);
      onCommit(field.key, result.value);
      restoreFocus();
    },
    [field.key, onCommit],
  );

  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && wrapRef.current?.contains(t)) return;
      finishRef.current(latest.current.touched ? "commit" : "cancel");
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editing]);

  const start = () => {
    if (!editable) return;
    const raw = rawForEdit(field);
    let date = "";
    let time = "00:00";
    if (raw) {
      const parsed = splitDatetime(raw);
      date = parsed.date || localYmd(new Date());
      time = parsed.time ? parsed.time.slice(0, 5) : "00:00";
    } else {
      const now = new Date();
      date = localYmd(now);
      time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    }
    const [y, m] = date.split("-").map(Number);
    setDatePart(date);
    setTimePart(time);
    setCal({ year: y, month: m - 1 });
    setTouched(false);
    setError(null);
    doneRef.current = false;
    const r = slotRef.current?.getBoundingClientRect();
    setAnchor(
      r
        ? {
            x: Math.max(8, r.left),
            y: Math.min(window.innerHeight - 260, r.bottom + 4),
          }
        : null,
    );
    setEditing(true);
  };

  const hour = Number(timePart.slice(0, 2)) || 0;
  const minute = Number(timePart.slice(3, 5)) || 0;
  const cells = editing ? calCells(cal.year, cal.month) : [];
  const focusDate =
    datePart && datePart.startsWith(`${cal.year}-${pad2(cal.month + 1)}`)
      ? datePart
      : ymdOf(cal.year, cal.month, 1);

  const pickDay = (date: string) => {
    setDatePart(date);
    setTouched(true);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(cal.year, cal.month + delta, 1));
    setCal({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  const moveDay = (deltaDays: number) => {
    const [y, m, d] = focusDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + deltaDays));
    const date = ymdOf(
      next.getUTCFullYear(),
      next.getUTCMonth(),
      next.getUTCDate(),
    );
    setCal({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setDatePart(date);
    setTouched(true);
    requestAnimationFrame(() => {
      wrapRef.current
        ?.querySelector<HTMLElement>(
          `[data-testid="dpb-cal-day"][data-date="${date}"]`,
        )
        ?.focus();
    });
  };

  const changeHour = (h: number) => {
    setTimePart(`${pad2(h)}:${pad2(minute)}`);
    setTouched(true);
  };

  const changeMinute = (m: number) => {
    setTimePart(`${pad2(hour)}:${pad2(m)}`);
    setTouched(true);
  };

  if (!editing) {
    return (
      <span className="dpb-value-slot" ref={slotRef}>
        <ValueView field={field} editable={editable} onStartEdit={start} />
        {error && (
          <span className="dpb-error" data-testid="dpb-error" role="status">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="dpb-value-slot" ref={slotRef}>
      <span
        ref={wrapRef}
        className="dpb-dt-editor"
        data-testid="dpb-datetime-editor"
        onPointerDown={() => {
          pointerInsideRef.current = true;
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && wrapRef.current?.contains(next)) return;
          if (pointerInsideRef.current) {
            pointerInsideRef.current = false;
            return;
          }
          finishRef.current(latest.current.touched ? "commit" : "cancel");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finishRef.current(latest.current.touched ? "commit" : "cancel");
          } else if (e.key === "Escape") {
            e.preventDefault();
            finishRef.current("cancel");
          }
        }}
      >
        <span className="dpb-dt-trigger" data-testid="dpb-datetime-trigger">
          {datePart ? `${datePart} ${timePart}` : "选择日期时间"}
        </span>
        <span
          ref={panelRef}
          className="dpb-menu dpb-dt-panel"
          data-testid="dpb-datetime-panel"
          role="dialog"
          aria-label="日期时间选择"
          style={{
            left: (pos ?? anchor ?? { x: 0, y: 0 }).x,
            top: (pos ?? anchor ?? { x: 0, y: 0 }).y,
          }}
        >
          <span className="dpb-dt-head">
            <button
              type="button"
              className="dpb-dt-nav"
              data-testid="dpb-cal-prev"
              aria-label="上一月"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <span className="dpb-dt-title" data-testid="dpb-cal-title">
              {cal.year}年{cal.month + 1}月
            </span>
            <button
              type="button"
              className="dpb-dt-nav"
              data-testid="dpb-cal-next"
              aria-label="下一月"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </span>
          <span
            className="dpb-dt-grid"
            data-testid="dpb-cal-grid"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                moveDay(-1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                moveDay(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moveDay(-7);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                moveDay(7);
              }
            }}
          >
            {CAL_WEEKDAYS.map((w) => (
              <span key={w} className="dpb-dt-wd">
                {w}
              </span>
            ))}
            {cells.map((cell, i) =>
              cell === null ? (
                <span key={`blank-${i}`} className="dpb-dt-cell dpb-dt-blank" />
              ) : (
                <button
                  key={cell.date}
                  type="button"
                  className={`dpb-dt-cell${
                    cell.date === datePart ? " dpb-dt-cell-sel" : ""
                  }`}
                  data-testid="dpb-cal-day"
                  data-date={cell.date}
                  aria-pressed={cell.date === datePart}
                  autoFocus={cell.date === focusDate}
                  tabIndex={cell.date === focusDate ? 0 : -1}
                  onClick={() => pickDay(cell.date)}
                >
                  {cell.day}
                </button>
              ),
            )}
          </span>
          <span className="dpb-dt-time">
            <TimeStepper
              label="小时"
              testId="dpb-time-hour"
              value={hour}
              max={23}
              onChange={changeHour}
            />
            <span className="dpb-dt-colon">:</span>
            <TimeStepper
              label="分钟"
              testId="dpb-time-minute"
              value={minute}
              max={59}
              onChange={changeMinute}
            />
          </span>
          <span className="dpb-dt-hint">
            Esc 取消 · Enter 保存 · 点击外部保存
          </span>
        </span>
      </span>
      {error && (
        <span className="dpb-error" data-testid="dpb-error" role="status">
          {error}
        </span>
      )}
    </span>
  );
}

interface ValueEditorProps {
  field: FrontmatterField;
  editable: boolean;
  onCommit: (key: string, value: unknown) => void;
}

function ValueEditor({ field, editable, onCommit }: ValueEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [multiline, setMultiline] = useState(false);
  const [touched, setTouched] = useState(false);
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
    setTouched(false);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(rawForEdit(field));
    setTouched(false);
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
      setTouched(false);
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
    const inputType = field.type === "date" ? "date" : "text";
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

function TagsValue({
  field,
  selected = false,
}: {
  field: FrontmatterField;
  selected?: boolean;
}) {
  if (!Array.isArray(field.value)) return <ValueView field={field} />;
  return (
    <span className="dpb-tags-group" data-select-node="tags">
      {field.value.map((tag, i) => {
        const name = String(tag);
        return (
          <span
            className={`dpb-tag${selected ? " dpb-node-selected" : ""}`}
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
function TagEditor({
  field,
  onCommit,
  selected = false,
}: EditorProps & { selected?: boolean }) {
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
    <span className="dpb-tags-editor" ref={wrapRef} data-select-node="tags">
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
            <span
              className={`dpb-tag${selected ? " dpb-node-selected" : ""}`}
              key={tag}
              data-color={tagColor(tag)}
            >
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
  if (effectiveEditable && field.type === "datetime") {
    return (
      <DatetimeEditor field={field} editable={editable} onCommit={onCommit} />
    );
  }
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
  selected = false,
}: EditorProps & { editable: boolean; selected?: boolean }) {
  if (!editable) return <TagsValue field={field} selected={selected} />;
  return <TagEditor field={field} onCommit={onCommit} selected={selected} />;
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
  /** 文档标识：切换文档时隔离用户判定的类型。 */
  docKey?: string;
  /** 跨会话稳定的文档标识（文件路径；未落盘回退页签 id），供类型覆盖持久化。 */
  docId?: string;
  /** 所在格 id：写回必须落在本格编辑器，分屏下不能取全局活动视图（#1016）。 */
  panelId?: string;
}

export default function DocPropertyBar({
  content,
  mode,
  isNewDoc = false,
  docKey = "",
  docId = "",
  panelId = "main",
}: DocPropertyBarProps) {
  const hidden = useDocPropertyPanelStore((s) => s.hidden);
  const variant = useDocPropertyPanelStore((s) => s.variant);
  const collapsed = useDocPropertyPanelStore((s) => s.collapsed);
  const setCollapsed = useDocPropertyPanelStore((s) => s.setCollapsed);
  const setHidden = useDocPropertyPanelStore((s) => s.setHidden);
  const toggleVariant = useDocPropertyPanelStore((s) => s.toggleVariant);
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteAnchor, setPaletteAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [ghost, setGhost] = useState<{
    type: FrontmatterType;
    x: number;
    y: number;
  } | null>(null);
  const suppressItemClick = useRef(false);
  const { pos: palettePos, ref: paletteRef } = useMenuPos(
    paletteOpen ? paletteAnchor : null,
  );
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

  // 窄窗（<720px）自动胶囊：只覆盖「用户从未手动选择」的形态，且不写偏好。
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 719px)");
    const apply = () =>
      useDocPropertyPanelStore.getState().setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleCommitField = useCallback(
    (key: string, value: unknown) => {
      const view = getPanelEditorView(panelId);
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
    [content, docKey, panelId],
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

  const typeKey = docId || docKey;
  const [overrideMap, setOverrideMap] = useState<
    Record<string, Record<string, FrontmatterType>>
  >({});
  const [loadedTypeKey, setLoadedTypeKey] = useState<string | null>(null);
  if (typeKey && loadedTypeKey !== typeKey) {
    setLoadedTypeKey(typeKey);
    setOverrideMap((prev) => {
      if (prev[typeKey]) return prev;
      const stored = readDocFieldTypes(typeKey);
      if (Object.keys(stored).length === 0) return prev;
      return { ...prev, [typeKey]: stored };
    });
  }
  useEffect(() => {
    for (const [id, types] of Object.entries(overrideMap)) {
      if (id) writeDocFieldTypes(id, types);
    }
  }, [overrideMap]);

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
        getPanelEditorView(panelId)?.dispatch({
          changes: { from: result.from, to: result.to, insert: result.block },
        });
      }
      const baseKeys = new Set(base.map((f) => f.key));
      setOverrideMap((prev) => {
        const cur = prev[typeKey] ?? {};
        const merged = { ...cur };
        for (const field of next) {
          if (!baseKeys.has(field.key)) merged[field.key] = field.type;
        }
        return { ...prev, [typeKey]: merged };
      });
      showTplStatus(
        `套用模板「${template.name}」→ 新增 ${added} 个字段${skipped ? `，跳过 ${skipped} 个已有键` : ""}`,
      );
    },
    [content, propAliasMap, showTplStatus, typeKey, panelId],
  );

  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});
  const typeErrorTimer = useRef<number | null>(null);
  const typeOverrides = overrideMap[typeKey] ?? EMPTY_OVERRIDES;

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
        const cur = prev[typeKey] ?? {};
        return { ...prev, [typeKey]: { ...cur, [field.key]: next } };
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
    [typeKey, handleCommitField, showTypeError],
  );

  const handleRename = useCallback(
    (fromKey: string, toKey: string): string | null => {
      const result = renameFrontmatterField(content, fromKey, toKey);
      if (!result.ok) return result.reason;
      if (result.text !== content) {
        const view = getPanelEditorView(panelId);
        view?.dispatch({
          changes: { from: result.from, to: result.to, insert: result.block },
        });
      }
      setOverrideMap((prev) => {
        const cur = prev[typeKey];
        if (!cur || !(fromKey in cur)) return prev;
        const next = { ...cur };
        next[toKey] = next[fromKey];
        delete next[fromKey];
        return { ...prev, [typeKey]: next };
      });
      return null;
    },
    [content, typeKey, panelId],
  );

  const parsed = useMemo(
    () => parseFrontmatter(content, propAliasMap),
    [content, propAliasMap],
  );
  // 撤销 / 删字段后键已不存在：剪掉失效类型覆盖，避免同键重建时被旧类型劫持（#1045）。
  useEffect(() => {
    if (!typeKey) return;
    setOverrideMap((prev) => {
      const cur = prev[typeKey];
      if (!cur) return prev;
      const present = new Set(parsed.fields.map((f) => f.key));
      const next: Record<string, FrontmatterType> = {};
      for (const [key, type] of Object.entries(cur)) {
        if (present.has(key)) next[key] = type;
      }
      if (Object.keys(next).length === Object.keys(cur).length) return prev;
      return { ...prev, [typeKey]: next };
    });
  }, [typeKey, parsed]);
  const allFields = useMemo(() => {
    if (Object.keys(typeOverrides).length === 0) return parsed.fields;
    return parsed.fields.map((f) => {
      const t = typeOverrides[f.key];
      return t && t !== f.type
        ? { ...f, type: t, display: formatFrontmatterValue(f.value, t) }
        : f;
    });
  }, [parsed, typeOverrides]);
  // 托管日期排除出可编辑列表：不渲染字段行、不计入字段数，写回时原样并回。
  const fields = useMemo(
    () => allFields.filter((f) => !isManagedDateKey(f.key)),
    [allFields],
  );
  const managedKeysPresent = useMemo(
    () => parsed.fields.some((f) => isManagedDateKey(f.key)),
    [parsed.fields],
  );
  const managedDates = useMemo(
    () =>
      allFields
        .filter((f) => isManagedDateKey(f.key))
        .map((f) => ({
          key: f.key,
          label: f.key === "created" ? "创建" : "修改",
          text: managedDateDisplay(f.value),
        }))
        .filter(
          (d): d is { key: string; label: string; text: string } =>
            d.text !== null,
        ),
    [allFields],
  );
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
  const hasSelection = selected.size > 0;
  // 可选中节点 = 字段名（标题位除外）+ 标签行；值不参与选中（#1128）。
  const selectableIds = useMemo(() => {
    const ids: FrontmatterRowId[] = [];
    fields.forEach((_, i) => {
      if (i !== titleIdx && i !== tagsIdx) ids.push(i);
    });
    if (tagsIdx >= 0) ids.push("tags");
    return ids;
  }, [fields, titleIdx, tagsIdx]);

  const numericSelected = useCallback((): number[] => {
    return [...selectedRef.current]
      .filter((x): x is number => typeof x === "number")
      .sort((a, b) => a - b);
  }, []);

  // 结构写回前把托管日期按原文键序并回，避免删除 / 排序把日期键丢掉。
  const withManagedDates = useCallback(
    (editable: FrontmatterField[]): FrontmatterField[] => {
      if (!managedKeysPresent) return editable;
      const byKey = new Map(editable.map((f) => [f.key, f]));
      for (const f of allFields) {
        if (!byKey.has(f.key) && isManagedDateKey(f.key)) byKey.set(f.key, f);
      }
      const out: FrontmatterField[] = [];
      for (const orig of parsed.fields) {
        const hit = byKey.get(orig.key);
        if (hit) {
          out.push(hit);
          byKey.delete(orig.key);
        }
      }
      for (const f of byKey.values()) out.push(f);
      return out;
    },
    [allFields, managedKeysPresent, parsed.fields],
  );

  const commitFields = useCallback(
    (next: FrontmatterField[], nextSel: FrontmatterRowId[]) => {
      const result = writeFrontmatterOrdered(content, withManagedDates(next));
      if (result.text !== content) {
        const view = getPanelEditorView(panelId);
        if (!view) {
          log.error(
            "DocPropertyBar",
            `结构变更写回失败：本格编辑器未就绪（panelId=${panelId}）`,
          );
        } else {
          view.dispatch({
            changes: { from: result.from, to: result.to, insert: result.block },
          });
        }
      }
      applySelection(nextSel);
    },
    [content, applySelection, panelId, withManagedDates],
  );

  const handleAutoFocusHandled = useCallback((key: string) => {
    setPendingRenameKey((cur) => (cur === key ? null : cur));
  }, []);

  /** 控件区插入：空态先建 frontmatter 块；指定类型空字段单事务写回，一次可撤销。 */
  const insertField = useCallback(
    (type: FrontmatterType, index?: number) => {
      const base = parsed.present
        ? fields
        : parseFrontmatter(newDocFrontmatter(), propAliasMap).fields;
      const at = Math.max(0, Math.min(base.length, index ?? base.length));
      const key = uniqueKey(
        NEW_FIELD_KEY,
        base.map((f) => f.key),
      );
      commitFields(
        [
          ...base.slice(0, at),
          { key, type, value: "", display: "" },
          ...base.slice(at),
        ],
        [],
      );
      setOverrideMap((prev) => {
        const cur = prev[typeKey] ?? {};
        return { ...prev, [typeKey]: { ...cur, [key]: type } };
      });
      setPendingRenameKey(key);
    },
    [parsed.present, fields, propAliasMap, commitFields, typeKey],
  );

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
    const cur = selectedRef.current;
    if (cur.size === 0) {
      applySelection(selectableIds);
      return;
    }
    // 反选 = 可选中集合内反转；标题位不进入全选 / 反选，保留其手动选中态。
    const next = selectableIds.filter((id) => !cur.has(id));
    if (titleIdx >= 0 && cur.has(titleIdx)) next.push(titleIdx);
    applySelection(next);
  }, [selectableIds, titleIdx, applySelection]);

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

  const togglePalette = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!paletteOpen) {
        const r = e.currentTarget.getBoundingClientRect();
        setPaletteAnchor({
          x: Math.max(8, r.left),
          y: Math.min(window.innerHeight - 240, r.bottom + 4),
        });
      }
      setPaletteOpen((v) => !v);
    },
    [paletteOpen],
  );

  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || typeof t.closest !== "function") return;
      if (paletteRef.current?.contains(t)) return;
      if (t.closest('[data-testid="dpb-add-field"]')) return;
      setPaletteOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [paletteOpen, paletteRef]);

  useEffect(() => {
    if (hidden) setPaletteOpen(false);
  }, [hidden]);

  const hitFieldArea = (clientX: number, clientY: number): boolean => {
    const panel = panelRef.current;
    if (!panel) return false;
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || typeof el.closest !== "function") return false;
    if (!panel.contains(el)) return false;
    if (el.closest('[data-testid="dpb-tools"]')) return false;
    if (el.closest(".dpb-b-head")) return false;
    if (el.closest(".dpb-b-foot")) return false;
    if (el.closest(".dpb-ops")) return false;
    if (el.closest(".dpb-menu")) return false;
    if (el.closest('[data-testid="dpb-add-field"]')) return false;
    return true;
  };

  const onPaletteItemPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    type: FrontmatterType,
  ) => {
    if (!editable) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let over: number | null = null;
    let inside = false;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (
          Math.abs(ev.clientY - startY) + Math.abs(ev.clientX - startX) <
          DRAG_THRESHOLD
        ) {
          return;
        }
        started = true;
        suppressItemClick.current = true;
        setPaletteOpen(false);
      }
      inside = hitFieldArea(ev.clientX, ev.clientY);
      over = inside ? computeDropIndex(ev.clientY) : null;
      setGhost({ type, x: ev.clientX, y: ev.clientY });
      setDrop(over != null ? { index: over, top: dropTopFor(over) } : null);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGhost(null);
      setDrop(null);
      if (!started) return;
      if (inside && over != null) insertField(type, over);
      window.setTimeout(() => {
        suppressItemClick.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const paletteOverlay =
    paletteOpen && paletteAnchor
      ? createPortal(
          <span
            ref={paletteRef}
            className="dpb-menu dpb-palette"
            data-testid="dpb-field-palette"
            role="menu"
            aria-label="添加字段控件区"
            style={{
              left: (palettePos ?? paletteAnchor).x,
              top: (palettePos ?? paletteAnchor).y,
            }}
          >
            {PICKABLE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                className="dpb-menu-row"
                data-testid="dpb-palette-item"
                data-type={t}
                onPointerDown={(e) => onPaletteItemPointerDown(e, t)}
                onClick={() => {
                  if (suppressItemClick.current) {
                    suppressItemClick.current = false;
                    return;
                  }
                  setPaletteOpen(false);
                  insertField(t);
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
        )
      : null;

  const dragGhost =
    ghost &&
    createPortal(
      <span
        className="dpb-drag-ghost"
        data-testid="dpb-drag-ghost"
        style={{ left: ghost.x, top: ghost.y }}
      >
        <TypeIcon type={ghost.type} />
        {TYPE_LABEL[ghost.type]}
      </span>,
      document.body,
    );

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
            onClick={togglePalette}
          >
            + 添加字段
          </button>
        )}
        {paletteOverlay}
        {dragGhost}
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
      title={hasSelection ? "反选（不含标题）" : "全选（不含标题）"}
      onClick={handleSelectAll}
    >
      {hasSelection ? "反选" : "全选"}
    </button>
  ) : null;

  const variantToggle = (
    <button
      type="button"
      className="dpb-tpl-btn dpb-variant-toggle"
      data-testid="dpb-variant-toggle"
      title={variant === "A" ? "切换到胶囊形态（B）" : "切换到一行条形态（A）"}
      aria-label="切换属性面板形态"
      aria-pressed={variant === "B"}
      onClick={toggleVariant}
    >
      <Icon name="docPropertyVariant" size={14} />
    </button>
  );

  const managedDatesView =
    managedDates.length > 0 ? (
      <span className="dpb-dates" data-testid="dpb-managed-dates">
        <Icon name="lock" size={14} className="dpb-lock" />
        {managedDates.map((d) => (
          <span
            className="dpb-date"
            data-testid="dpb-managed-date"
            data-key={d.key}
            key={d.key}
          >
            {d.label} {d.text}
          </span>
        ))}
      </span>
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
              <button
                type="button"
                className="dpb-tpl-btn"
                data-testid="dpb-add-field"
                title="添加字段"
                onClick={togglePalette}
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
            {variantToggle}
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
                    selectId={rowId}
                    selected={selected.has(rowId)}
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
                        selected={selected.has("tags")}
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
              {managedDatesView}
            </div>
            {paletteOverlay}
            {dragGhost}
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
            <TemplateMenuButton
              templates={propTemplates}
              onApply={handleApplyTemplate}
            />
          )}
          {selectAllButton}
          {collapseButton}
          {variantToggle}
          {tplStatus && (
            <span
              className="dpb-tpl-status"
              data-testid="dpb-tpl-status"
              role="status"
            >
              {tplStatus}
            </span>
          )}
          {editable && (
            <button
              type="button"
              className="dpb-tpl-btn"
              data-testid="dpb-add-field"
              title="添加字段"
              onClick={togglePalette}
            >
              + 添加字段
            </button>
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
                    selectId={rowId}
                    selected={selected.has(rowId)}
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
                  selectId="tags"
                  selected={selected.has("tags")}
                  onSubmit={handleRename}
                  autoFocusKey={pendingRenameKey}
                  onAutoFocusHandled={handleAutoFocusHandled}
                />
                <TagsCell
                  field={tagsField}
                  editable={editable}
                  onCommit={handleCommitField}
                  selected={selected.has("tags")}
                />
              </span>
            )}
          </div>
        </>
      )}
      {managedDatesView && (
        <div className="dpb-a-foot">
          {managedDatesView}
          <span data-testid="dpb-count">{fields.length} 个字段</span>
        </div>
      )}
      {paletteOverlay}
      {dragGhost}
    </div>
  );
}

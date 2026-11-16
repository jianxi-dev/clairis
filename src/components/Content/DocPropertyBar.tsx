import { useEffect, useMemo, useRef } from "react";
import type { EditorMode } from "../../types";
import {
  parseFrontmatter,
  type FrontmatterField,
  type FrontmatterType,
} from "../../lib/frontmatter";
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
};

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
          : "☰";
  return (
    <span className="dpb-ico" aria-hidden="true">
      {text}
    </span>
  );
}

function ValueView({ field }: { field: FrontmatterField }) {
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
      className="dpb-v dpb-clamp2"
      data-testid="dpb-value"
      title={long ? field.display : undefined}
    >
      {field.display || "—"}
    </span>
  );
}

function TagsValue({ field }: { field: FrontmatterField }) {
  if (!Array.isArray(field.value)) return <ValueView field={field} />;
  return (
    <span className="dpb-tags-group">
      {field.value.map((tag, i) => (
        <span className="dpb-tag" key={`${String(tag)}-${i}`}>
          {String(tag)}
        </span>
      ))}
    </span>
  );
}

interface DocPropertyBarProps {
  content: string;
  mode: EditorMode;
  /** 新建（未落盘）文档：默认显隐走全局 newDocVisible。 */
  isNewDoc?: boolean;
}

export default function DocPropertyBar({
  content,
  mode,
  isNewDoc = false,
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

  const parsed = useMemo(() => parseFrontmatter(content), [content]);
  const fields = parsed.fields;
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
              >
                <span className="dpb-b-handle">{editable ? "⠿" : ""}</span>
                <span className="dpb-b-type" title={TYPE_LABEL[field.type]}>
                  <TypeIcon type={field.type} />
                </span>
                <span className="dpb-b-label">{field.key}</span>
                <span className="dpb-b-value">
                  {field === tagsField ? (
                    <TagsValue field={field} />
                  ) : (
                    <ValueView field={field} />
                  )}
                </span>
                <span className="dpb-b-x" />
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
            >
              {editable && (
                <span className="dpb-row-handle" aria-hidden="true">
                  ⠿
                </span>
              )}
              {editable && <TypeIcon type={field.type} />}
              <span className="dpb-k">{field.key}</span>
              <ValueView field={field} />
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
              <span className="dpb-k">{tagsField.key}</span>
              <TagsValue field={tagsField} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

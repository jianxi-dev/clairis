import { useEffect, useRef, useState } from "react";
import {
  listCapabilities,
  setCapabilityEnabled,
  type CapabilityId,
} from "../lib/capabilities";
import type { PreviewSettings } from "../lib/previewAnchor";
import { applyTheme, saveAppConfig } from "../hooks/useConfig";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import Icon from "./Icon";
import { ICONS, ICON_NAMES } from "../ui/icons";

interface SettingsViewProps {
  onClose: () => void;
}

const SECTIONS = [
  { id: "appearance", label: "外观" },
  { id: "editor", label: "编辑器" },
  { id: "reading", label: "阅读空间" },
  { id: "grid", label: "网格概览" },
  { id: "preview", label: "悬浮预览" },
  { id: "ai", label: "AI 服务" },
  { id: "extensions", label: "扩展" },
  { id: "shortcuts", label: "快捷键" },
  { id: "data", label: "数据与备份" },
  { id: "about", label: "关于" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const PLACEHOLDER_SECTIONS: ReadonlySet<SectionId> = new Set([
  "reading",
  "grid",
  "ai",
  "extensions",
  "data",
  "about",
]);

const THEME_OPTIONS = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "warm", label: "暖色" },
] as const;

const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;

const LABEL_LEVELS = [
  { value: "auto", label: "自动", hint: "主入口图标+文字，重复处仅图标" },
  { value: "text", label: "始终显示文字", hint: "任何位置都带文字标签" },
  { value: "icon", label: "仅图标", hint: "任何位置都不显示文字" },
] as const;

const GRID_MODES = [
  { value: "hover", label: "悬停" },
  { value: "click", label: "点击" },
  { value: "off", label: "关闭" },
] as const;

const CORE_SHORTCUTS = [
  { keys: "⌘P", label: "统一检索" },
  { keys: "⌘\\", label: "阅读空间" },
  { keys: "⌘⇧\\", label: "网格概览" },
  { keys: "⌘K", label: "AI 浮层" },
  { keys: "⌘⇧A", label: "AI 小窗·停靠" },
  { keys: "⌘,", label: "设置" },
  { keys: "?", label: "快捷键总览" },
] as const;

const FULL_SHORTCUTS: ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ keys: string; label: string }>;
}> = [
  {
    group: "文件",
    items: [
      { keys: "⌘O", label: "打开" },
      { keys: "⌘S", label: "保存" },
      { keys: "⌘N", label: "新建" },
      { keys: "⌘T", label: "新页签" },
      { keys: "⌘W", label: "关页签 / 格" },
    ],
  },
  {
    group: "工作区",
    items: [
      { keys: "⌘↵", label: "打开选中" },
      { keys: "⌘⌥→", label: "右分" },
      { keys: "⌘⌥↓", label: "下分" },
      { keys: "⌘⇧↵", label: "全屏当前格" },
    ],
  },
  {
    group: "导航",
    items: [
      { keys: "j / k", label: "上下整行" },
      { keys: "h / l", label: "行内左右" },
      { keys: "PageUp / PageDown", label: "整页" },
      { keys: "Home / End", label: "首尾" },
      { keys: "Enter", label: "打开" },
      { keys: "/", label: "搜索" },
    ],
  },
];

export default function SettingsView({ onClose }: SettingsViewProps) {
  const [active, setActive] = useState<SectionId>("appearance");
  const [capabilities, setCapabilities] = useState(listCapabilities);
  const [showFullShortcuts, setShowFullShortcuts] = useState(false);

  const theme = useEditorStore((s) => s.config.theme ?? "system");
  const iconLabel = useEditorStore((s) => s.config.iconLabel ?? "text");
  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
  const setConfig = useEditorStore((s) => s.setConfig);
  const setFontSize = useEditorStore((s) => s.setFontSize);

  const previewSettings = useStore((s) => s.previewSettings);

  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const lastExplicitRef = useRef<"light" | "dark" | "warm">(
    theme === "system" ? "light" : theme,
  );
  const effectiveTheme: "light" | "dark" | "warm" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const followSystem = theme === "system";

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const chooseTheme = (next: "light" | "dark" | "warm") => {
    lastExplicitRef.current = next;
    setConfig({ theme: next });
    applyTheme(next);
    void saveAppConfig();
  };

  const toggleFollowSystem = (next: boolean) => {
    if (next) {
      setConfig({ theme: "system" });
      applyTheme("system");
      void saveAppConfig();
    } else {
      chooseTheme(lastExplicitRef.current);
    }
  };

  const chooseFontSize = (size: number) => {
    setConfig({ readerFontSize: size });
    setFontSize(size);
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${size}px`,
    );
    void saveAppConfig();
  };

  const chooseLabelLevel = (value: "auto" | "text" | "icon") => {
    setConfig({ iconLabel: value });
    void saveAppConfig();
  };

  const toggleCapability = (id: CapabilityId, enabled: boolean) => {
    setCapabilityEnabled(id, enabled);
    setCapabilities(listCapabilities());
    void saveAppConfig();
  };

  const updatePreview = (patch: Partial<PreviewSettings>) => {
    useStore.getState().setPreviewSettings(patch);
    void saveAppConfig();
  };

  return (
    <div
      ref={rootRef}
      data-testid="settings-scene"
      tabIndex={-1}
      role="dialog"
      aria-label="设置"
      className="flex h-full w-full bg-[var(--app-bg)] outline-none"
    >
      <nav
        data-testid="settings-nav"
        className="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-[var(--app-border)] bg-[var(--app-surface)] p-2"
      >
        {SECTIONS.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-testid="settings-nav-item"
              data-settings-nav={section.id}
              data-active={isActive ? "true" : "false"}
              onClick={() => setActive(section.id)}
              className={`rounded px-3 py-1.5 text-left text-sm ${
                isActive
                  ? "bg-[var(--app-accent-soft)] font-medium text-[var(--app-accent)]"
                  : "text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-base font-medium text-[var(--app-text-strong)]">
              设置
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-1.5 text-xs text-[var(--app-text-3)] hover:bg-[var(--app-sunken)]"
              aria-label="关闭设置"
            >
              关闭
            </button>
          </div>

          {active === "appearance" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  主题
                </h2>
                <div className="flex flex-wrap gap-2">
                  {THEME_OPTIONS.map((option) => {
                    const selected = effectiveTheme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`theme-option-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseTheme(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="follow-system"
                    checked={followSystem}
                    onChange={(e) => toggleFollowSystem(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-[var(--app-text)]">
                      跟随系统外观
                    </span>
                    <span className="block text-xs text-[var(--app-text-3)]">
                      默认开启：系统亮/暗对应浅色/深色
                    </span>
                  </span>
                </label>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  字号
                </h2>
                <div className="flex flex-wrap gap-2">
                  {FONT_SIZES.map((size) => {
                    const selected = readerFontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        data-testid={`font-size-${size}`}
                        aria-pressed={selected}
                        onClick={() => chooseFontSize(size)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section data-testid="settings-icons">
                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                  图标
                </h2>
                <p className="mb-2 text-xs text-[var(--app-text-3)]">
                  全站同一概念同一形状，尺寸只有 18（密集）与 24（主操作）两档。
                </p>
                <div className="mb-3 flex flex-wrap gap-3">
                  {LABEL_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className="flex cursor-pointer items-start gap-1.5"
                      title={level.hint}
                    >
                      <input
                        type="radio"
                        name="icon-label-level"
                        data-testid={`icon-label-${level.value}`}
                        checked={iconLabel === level.value}
                        onChange={() => chooseLabelLevel(level.value)}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-[var(--app-text)]">
                        {level.label}
                      </span>
                    </label>
                  ))}
                </div>
                <div
                  data-testid="icon-drawer"
                  className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded border border-[var(--app-border)] p-2"
                >
                  {ICON_NAMES.map((name) => (
                    <div
                      key={name}
                      data-icon-entry={name}
                      className="flex items-center gap-1.5 text-xs text-[var(--app-text-2)]"
                    >
                      <Icon name={name} size={18} />
                      <span className="truncate">{ICONS[name].label}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--app-text-3)]">
                        18/24
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === "editor" && (
            <section>
              <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                高级
              </h2>
              <p className="mb-3 text-xs text-[var(--app-text-3)]">
                能力默认全开；关闭后只是不再渲染，文档内容不受影响。
              </p>
              <ul className="space-y-2">
                {capabilities.map((capability) => (
                  <li key={capability.id}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        data-testid={`capability-${capability.id}`}
                        checked={capability.enabled}
                        onChange={(e) =>
                          toggleCapability(capability.id, e.target.checked)
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm text-[var(--app-text)]">
                          {capability.label}
                        </span>
                        <span className="block text-xs text-[var(--app-text-3)]">
                          {capability.hint}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {active === "preview" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  阅读空间
                </h2>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="preview-rail-hover"
                    checked={previewSettings.railHover}
                    onChange={(e) =>
                      updatePreview({ railHover: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-[var(--app-text)]">
                    悬停行显示预览
                  </span>
                </label>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  网格预览模式
                </h2>
                <div className="flex flex-wrap gap-2">
                  {GRID_MODES.map((mode) => {
                    const selected = previewSettings.gridMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        data-testid={`grid-mode-${mode.value}`}
                        aria-pressed={selected}
                        onClick={() => updatePreview({ gridMode: mode.value })}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {active === "shortcuts" && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                核心快捷键
              </h2>
              <ul className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
                {CORE_SHORTCUTS.map((shortcut) => (
                  <li
                    key={shortcut.keys}
                    data-testid="shortcut-core"
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-[var(--app-text)]">
                      {shortcut.label}
                    </span>
                    <kbd className="rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-2 py-0.5 text-xs text-[var(--app-text-2)]">
                      {shortcut.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="shortcuts-full-toggle"
                onClick={() => setShowFullShortcuts((v) => !v)}
                className="mt-3 rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
              >
                {showFullShortcuts ? "收起完整列表" : "查看完整列表"}
              </button>
              {showFullShortcuts && (
                <div data-testid="shortcuts-full" className="mt-4 space-y-4">
                  {FULL_SHORTCUTS.map((group) => (
                    <div key={group.group}>
                      <h3 className="mb-1 text-xs font-medium text-[var(--app-text-3)]">
                        {group.group}
                      </h3>
                      <ul className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
                        {group.items.map((shortcut) => (
                          <li
                            key={shortcut.keys}
                            data-testid="shortcut-full-row"
                            className="flex items-center justify-between py-2"
                          >
                            <span className="text-sm text-[var(--app-text)]">
                              {shortcut.label}
                            </span>
                            <kbd className="rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-2 py-0.5 text-xs text-[var(--app-text-2)]">
                              {shortcut.keys}
                            </kbd>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {PLACEHOLDER_SECTIONS.has(active) && (
            <p className="text-sm text-[var(--app-text-3)]">
              此分区将在后续票补全
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

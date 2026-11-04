import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  listCapabilities,
  setCapabilityEnabled,
  type CapabilityId,
} from "../lib/capabilities";
import { saveAppConfig } from "../hooks/useConfig";
import { useEditorStore } from "../stores/editorStore";
import Icon from "./Icon";
import { ICONS, ICON_NAMES } from "../ui/icons";

interface SettingsDialogProps {
  onClose: () => void;
}

/**
 * 设置面板：目前只有「高级 → 能力」一节。
 * 只在用户主动打开时挂载（无常驻 UI、无红点）；关闭能力不删任何用户数据。
 */
const LABEL_LEVELS = [
  { value: "auto", label: "自动", hint: "主入口图标+文字，重复处仅图标" },
  { value: "text", label: "始终显示文字", hint: "任何位置都带文字标签" },
  { value: "icon", label: "仅图标", hint: "任何位置都不显示文字" },
] as const;

export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [capabilities, setCapabilities] = useState(listCapabilities);
  const iconLabel = useEditorStore((s) => s.config.iconLabel ?? "text");
  const setConfig = useEditorStore((s) => s.setConfig);

  const chooseLabelLevel = (value: "auto" | "text" | "icon") => {
    setConfig({ iconLabel: value });
    void saveAppConfig();
  };
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
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

  const toggle = (id: CapabilityId, enabled: boolean) => {
    setCapabilityEnabled(id, enabled);
    setCapabilities(listCapabilities());
    void saveAppConfig();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex items-start justify-center bg-black/20 pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-testid="settings-dialog"
        tabIndex={-1}
        role="dialog"
        aria-label="设置"
        className="w-[420px] max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white shadow-lg outline-none dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
            设置
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="关闭设置"
          >
            关闭
          </button>
        </div>

        <section className="px-4 py-3" data-testid="settings-icons">
          <h2 className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            图标
          </h2>
          <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
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
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {level.label}
                </span>
              </label>
            ))}
          </div>
          <div
            data-testid="icon-drawer"
            className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded border border-gray-200 p-2 dark:border-gray-700"
          >
            {ICON_NAMES.map((name) => (
              <div
                key={name}
                data-icon-entry={name}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
              >
                <Icon name={name} size={18} />
                <span className="truncate">{ICONS[name].label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                  18/24
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 py-3">
          <h2 className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            高级
          </h2>
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
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
                    onChange={(e) => toggle(capability.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-gray-800 dark:text-gray-100">
                      {capability.label}
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {capability.hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  listCapabilities,
  setCapabilityEnabled,
  type CapabilityId,
} from "../lib/capabilities";
import { saveAppConfig } from "../hooks/useConfig";

interface SettingsDialogProps {
  onClose: () => void;
}

/**
 * 设置面板：目前只有「高级 → 能力」一节。
 * 只在用户主动打开时挂载（无常驻 UI、无红点）；关闭能力不删任何用户数据。
 */
export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [capabilities, setCapabilities] = useState(listCapabilities);
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

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Template } from "../lib/extensions/templates";

interface TemplatePickerProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  onBlank: () => void;
  onClose: () => void;
}

/**
 * 新建页模板选择浮层：模板名列表 + 空白文档项 + 取消。
 * 无常驻 UI（仅存在模板且用户点「新建」时挂载）；Esc 或点击外部关闭。
 */
export default function TemplatePicker({
  templates,
  onSelect,
  onBlank,
  onClose,
}: TemplatePickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex items-start justify-center bg-black/20 pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-testid="template-picker"
        tabIndex={-1}
        role="dialog"
        aria-label="选择模板"
        className="w-64 rounded-lg border border-gray-200 bg-white shadow-lg outline-none dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          选择模板
        </div>
        <ul className="max-h-64 overflow-auto">
          {templates.map((template) => (
            <li key={template.path}>
              <button
                type="button"
                data-testid="template-item"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onSelect(template)}
              >
                {template.name}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              data-testid="template-blank"
              className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={onBlank}
            >
              空白文档
            </button>
          </li>
        </ul>
        <button
          type="button"
          className="w-full border-t border-gray-200 px-3 py-2 text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </div>,
    document.body,
  );
}

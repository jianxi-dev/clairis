import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { saveAppConfig } from "../../hooks/useConfig";
import type { AppConfig } from "../../types";

const FONT_SIZES = [15, 16, 17, 18, 19, 21];

const WIDTH_PRESETS = [
  { label: "紧凑", value: 720 },
  { label: "标准", value: 1080 },
  { label: "宽松", value: 1200 },
];

const WIDTH_MIN = 400;
const WIDTH_MAX = 1200;

// 阅读主题与明暗正交：新增主题只需在这里加一项 + reader.css 里加一层 --tone-* 变量
const TONES = [
  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
  { id: "indigo", label: "靛青", swatch: "#2b4a7d" },
  { id: "moss", label: "松绿", swatch: "#2f5d3f" },
  { id: "clay", label: "赭石", swatch: "#8a4b2a" },
];

/** 阅读设置：字号 / 行宽 / 皮肤。沿用 shell-ui spec 的三档 pill + 滑块形态。 */
export default function ReaderSettingsPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const readerFontSize = useEditorStore((s) => s.config.readerFontSize) ?? 17;
  const readerWidth = useEditorStore((s) => s.config.readerWidth) ?? 1080;
  const readerSkin = useEditorStore((s) => s.config.readerSkin) ?? "paper";

  const update = (patch: Partial<AppConfig>) => {
    useEditorStore.getState().setConfig(patch);
    void saveAppConfig();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="reader-settings" ref={rootRef}>
      <button
        type="button"
        className="reader-settings-toggle"
        title="阅读设置"
        aria-label="阅读设置"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 size={14} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="reader-settings-panel">
          <div className="reader-settings-row">
            <span className="reader-settings-label">字号</span>
            <div className="reader-settings-pills">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`reader-pill${size === readerFontSize ? " on" : ""}`}
                  onClick={() => update({ readerFontSize: size })}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="reader-settings-row">
            <span className="reader-settings-label">行宽</span>
            <div className="reader-settings-pills">
              {WIDTH_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`reader-pill${p.value === readerWidth ? " on" : ""}`}
                  onClick={() => update({ readerWidth: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="reader-settings-row">
            <input
              type="range"
              className="reader-range"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              step={20}
              value={readerWidth}
              onChange={(e) => update({ readerWidth: Number(e.target.value) })}
              aria-label="行宽精调"
            />
            <span className="reader-settings-value">{readerWidth}px</span>
          </div>

          <div className="reader-settings-row">
            <span className="reader-settings-label">配色</span>
            <div className="reader-settings-pills">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`reader-pill${t.id === readerSkin ? " on" : ""}`}
                  onClick={() => update({ readerSkin: t.id })}
                >
                  <span
                    className="reader-swatch"
                    style={{ background: t.swatch }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

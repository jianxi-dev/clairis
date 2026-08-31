import { useStore } from "../../stores/index";

interface TranslatePanelProps {
  onTranslate?: () => void;
}

export default function TranslatePanel({ onTranslate }: TranslatePanelProps) {
  const activeTab = useStore((s) =>
    s.activeTabId ? s.tabs[s.activeTabId] : null,
  );

  if (!activeTab) {
    return (
      <div className="translate-panel" style={{ padding: 12, fontSize: 13, color: "#999" }}>
        未打开文件
      </div>
    );
  }

  return (
    <div className="translate-panel" style={{ padding: 12, fontSize: 13 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>翻译</strong>
      </div>
      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
        源文本: {activeTab.content.slice(0, 100)}
        {activeTab.content.length > 100 ? "..." : ""}
      </div>
      <button
        onClick={onTranslate}
        style={{
          padding: "4px 12px",
          fontSize: 12,
          cursor: "pointer",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 4,
        }}
      >
        翻译
      </button>
    </div>
  );
}

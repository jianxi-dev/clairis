import { useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

interface SidebarPanelProps {
  side: "left" | "right";
  tabs: TabDef[];
  defaultTab?: string;
}

export default function SidebarPanel({
  side,
  tabs,
  defaultTab,
}: SidebarPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key || "");

  const current = tabs.find((t) => t.key === activeTab);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-sm select-none overflow-hidden">
      {/* Tab header */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-xs py-1.5 px-2 transition-colors ${
                activeTab === tab.key
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-500"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {current?.content || (
          <div className="p-4 text-xs text-gray-400">无内容</div>
        )}
      </div>
    </div>
  );
}

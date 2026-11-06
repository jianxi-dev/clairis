import { useEffect, useMemo } from "react";
import Icon from "./Icon";
import { useStore } from "../stores/index";
import {
  TYPE_COLORS,
  fileTypeOf,
  iconOfType,
  type FileTypeKind,
} from "../lib/fileType";
import { fileDragHandlers } from "../hooks/fileDrag";

/** 8 类磁贴的固定顺序与中文名（门户 §2 分类磁贴） */
const TILES: Array<{ kind: FileTypeKind; label: string }> = [
  { kind: "markdown", label: "Markdown" },
  { kind: "html", label: "HTML" },
  { kind: "text", label: "文本" },
  { kind: "pdf", label: "PDF" },
  { kind: "video", label: "视频" },
  { kind: "image", label: "图片" },
  { kind: "code", label: "代码" },
  { kind: "audio", label: "音频" },
];

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

function parentOf(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.slice(-2).join("/");
}

/**
 * 门户（启动首屏，Layout Portal §2）。
 *
 * 四块：继续阅读 hero / 最近文件富卡 / 8 类磁贴 / 快速动作；底部 ⌘P 提示。
 * 没有「来源」入口——这个维度已从产品里删除。
 */
export default function PortalView({
  onOpenFile,
  onNewFile,
  onOpenPath,
  onAiCommand,
  onStudyPage,
}: {
  onOpenFile: () => void;
  onNewFile: () => void;
  /** 按路径打开（文件当前没有页签时走这条，别用无人消费的 CustomEvent） */
  onOpenPath: (path: string) => void | Promise<void>;
  onAiCommand: () => void;
  /** 「生成学习页」：把意图填进 AI 输入框再唤起（不是空按钮） */
  onStudyPage: () => void;
}) {
  const recentFiles = useStore((s) => s.recentFiles);
  const scrollPositions = useStore((s) => s.scrollPositions);
  const setScene = useStore((s) => s.setScene);
  const setGridTypeFilter = useStore((s) => s.setGridTypeFilter);
  const setGridQuery = useStore((s) => s.setGridQuery);
  const setGridPinnedOnly = useStore((s) => s.setGridPinnedOnly);
  const setGridSelectedPath = useStore((s) => s.setGridSelectedPath);
  const setActiveTab = useStore((s) => s.switchTab);
  const tabs = useStore((s) => s.tabs);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const counts = useMemo(() => {
    const acc = new Map<FileTypeKind, number>();
    for (const f of recentFiles) {
      const kind = fileTypeOf(f.path);
      acc.set(kind, (acc.get(kind) ?? 0) + 1);
    }
    return acc;
  }, [recentFiles]);

  const hero = recentFiles[0] ?? null;
  const cards = recentFiles.slice(0, 6);

  const openRecent = (path: string) => {
    const tab = Object.values(tabs).find((t) => t.path === path);
    if (tab) {
      setActiveTab(tab.id);
      setScene("workspace");
      return;
    }
    // 最近记录里但当前没有页签：交给上层按路径真正打开
    void onOpenPath(path);
  };

  // 门户是首屏，但不能把人锁在里面：Esc 回到工作区（有页签时）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (Object.keys(useStore.getState().tabs).length === 0) return;
      e.preventDefault();
      setScene("workspace");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScene]);

  /** 阅读进度：{scrollPos}/{contentHeight}，hero 与最近卡共用同一个公式 */
  const percentOf = (path: string): number => {
    const pos = scrollPositions[path];
    if (!pos || pos.contentHeight <= 0) return 0;
    return Math.min(100, Math.round((pos.scrollPos / pos.contentHeight) * 100));
  };
  const heroPercent = hero ? percentOf(hero.path) : 0;

  return (
    <div
      data-testid="portal"
      className="h-full overflow-auto bg-white px-10 py-8 dark:bg-gray-900"
    >
      <header className="mb-8">
        <h1
          data-testid="portal-greeting"
          className="text-2xl font-medium text-gray-900 dark:text-gray-100"
        >
          {greeting(now)}
        </h1>
        <p
          data-testid="portal-date"
          className="mt-1 text-sm text-gray-400 dark:text-gray-500"
        >
          {dateLabel}
        </p>
      </header>

      {recentFiles.length === 0 ? (
        <section
          data-testid="portal-empty"
          className="rounded-lg border border-dashed border-gray-200 p-10 text-center dark:border-gray-700"
        >
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            还没有打开过文件。开始第一份文档吧。
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onNewFile}
              data-testid="empty-new"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              新建文档
            </button>
            <button
              onClick={onOpenFile}
              data-testid="empty-open"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              打开文件
            </button>
            <button
              onClick={onOpenFile}
              data-testid="empty-import"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              导入
            </button>
          </div>
        </section>
      ) : (
        <>
          {hero && (
            <button
              data-testid="portal-hero"
              data-recent-path={hero.path}
              {...fileDragHandlers(hero.path)}
              onClick={() => openRecent(hero.path)}
              className="mb-8 block w-full rounded-lg border border-gray-200 p-5 text-left hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                <Icon
                  name={iconOfType(fileTypeOf(hero.path))}
                  size={18}
                  color={TYPE_COLORS[fileTypeOf(hero.path)]}
                />
                继续阅读
              </div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {hero.title}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                {hero.excerpt || "（还没有内容）"}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <span>{relativeTime(hero.openedAt)}</span>
                {heroPercent > 0 && (
                  <>
                    <span>·</span>
                    <span data-testid="hero-progress">已读 {heroPercent}%</span>
                  </>
                )}
              </div>
            </button>
          )}

          <section className="mb-8">
            <h2 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
              最近文件
            </h2>
            <div
              data-testid="portal-recent"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {cards.map((f) => (
                <button
                  key={f.path}
                  data-recent-path={f.path}
                  {...fileDragHandlers(f.path)}
                  onClick={() => openRecent(f.path)}
                  className="rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon
                      name={iconOfType(fileTypeOf(f.path))}
                      size={18}
                      color={TYPE_COLORS[fileTypeOf(f.path)]}
                    />
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {f.title}
                    </span>
                  </div>
                  <p className="mb-1 line-clamp-2 h-8 text-xs text-gray-500 dark:text-gray-400">
                    {f.excerpt || "（还没有内容）"}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="truncate">{parentOf(f.path)}</span>
                    <span className="shrink-0">
                      {relativeTime(f.openedAt)}
                      {percentOf(f.path) > 0 && (
                        <span data-card-progress={f.path}>
                          {" · 已读 "}
                          {percentOf(f.path)}%
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
              按类型
            </h2>
            <div
              data-testid="portal-tiles"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {TILES.map((tile) => (
                <button
                  key={tile.kind}
                  data-tile-kind={tile.kind}
                  onClick={() => {
                    setGridTypeFilter(tile.kind);
                    setGridQuery("");
                    setGridPinnedOnly(false);
                    setGridSelectedPath(null);
                    setScene("grid");
                  }}
                  className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Icon
                    name={iconOfType(tile.kind)}
                    size={18}
                    color={TYPE_COLORS[tile.kind]}
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {tile.label}
                  </span>
                  <span className="ml-auto text-gray-400">
                    {counts.get(tile.kind) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
          快速动作
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onNewFile}
            data-testid="quick-new"
            className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="file" size={18} />
            新建文档
          </button>
          <button
            onClick={onOpenFile}
            data-testid="quick-open-file"
            className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="folder" size={18} />
            打开文件
          </button>
          <button
            onClick={onStudyPage}
            data-testid="quick-study"
            className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="text" size={18} />
            生成学习页
          </button>
          <button
            onClick={onAiCommand}
            data-testid="quick-ai"
            className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="settings" size={18} />
            AI 指令
          </button>
        </div>
      </section>

      <footer
        data-testid="portal-hint"
        className="text-xs text-gray-400 dark:text-gray-500"
      >
        ⌘P 搜索全部
      </footer>
    </div>
  );
}

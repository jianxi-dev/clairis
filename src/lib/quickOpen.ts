import type { RecentFile, Tab } from "../types";
import type { IconName } from "../ui/icons";

/**
 * 快速打开的条目模型与纯过滤逻辑（reading-surface-refine 6.1）。
 *
 * 三类条目联合排序：当前页签 → 最近文件（已在页签里的去重）→ 命令。
 * 过滤为 title + path 的大小写不敏感子串匹配；命令项的 title 即命令名。
 * 逻辑放在这里是为了能脱离组件单测（与 railCards.ts 同一约定）。
 */

export type QuickItem =
  | {
      kind: "tab";
      key: string;
      title: string;
      path: string | null;
      tabId: string;
    }
  | {
      kind: "recent";
      key: string;
      title: string;
      path: string;
    }
  | {
      kind: "command";
      key: string;
      label: string;
      hint: string;
      icon: IconName;
      run: () => void;
    };

export interface QuickCommandSpec {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  run: () => void;
}

/**
 * 构建快速打开条目：页签 + 最近文件（去掉已打开的）+ 命令，按 query 过滤。
 * query 为空时返回全部；recent 与 tab 同路径时只保留 tab。
 */
export function buildQuickItems(
  tabs: Record<string, Tab>,
  recentFiles: RecentFile[],
  commands: QuickCommandSpec[],
  query: string,
): QuickItem[] {
  const needle = query.trim().toLowerCase();
  const match = (text: string) => text.toLowerCase().includes(needle);
  const out: QuickItem[] = [];

  for (const tab of Object.values(tabs)) {
    if (needle && !match(tab.title) && !(tab.path && match(tab.path))) continue;
    out.push({
      kind: "tab",
      key: `tab:${tab.id}`,
      title: tab.title,
      path: tab.path,
      tabId: tab.id,
    });
  }

  const openPaths = new Set(
    Object.values(tabs)
      .map((t) => t.path)
      .filter((p): p is string => !!p),
  );
  for (const file of recentFiles) {
    if (openPaths.has(file.path)) continue;
    if (needle && !match(file.title) && !match(file.path)) continue;
    out.push({
      kind: "recent",
      key: `recent:${file.path}`,
      title: file.title,
      path: file.path,
    });
  }

  for (const command of commands) {
    if (needle && !match(command.label)) continue;
    out.push({ kind: "command", ...command });
  }

  return out;
}

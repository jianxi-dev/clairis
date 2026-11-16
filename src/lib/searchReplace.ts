/* 替换事务的纯函数（#983 / S-4）。
 *
 * 命中集合 → CM6 单事务 changes：一次 `view.dispatch({ changes })` 即完成整次
 * 替换，Ctrl+Z 一次还原。这里只做区间计算，不碰编辑器，便于单测覆盖重叠 /
 * 相邻 / 末尾命中与正则特殊字符按字面插入。
 */
import type { SearchScanHit } from "./searchScan";

/** 单条 CM6 change spec（`insert` 按字面插入，无 `$` 替换语义）。 */
export interface ReplaceChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * 把命中集合转成一份**文档顺序**、互不重叠的 changes 数组。
 *
 * 命中按 `from` 升序排列；重叠或零宽命中被丢弃（`searchScan` 本身不产出重叠，
 * 这里再兜一层，保证送进 CM6 单事务一定合法）。替换词为空即纯删除。
 */
export function buildReplaceChanges(
  hits: SearchScanHit[],
  replacement: string,
): ReplaceChange[] {
  const changes: ReplaceChange[] = [];
  let lastTo = -1;
  const sorted = [...hits].sort((a, b) => a.from - b.from);
  for (const hit of sorted) {
    if (hit.to <= hit.from) continue;
    if (hit.from < lastTo) continue;
    changes.push({ from: hit.from, to: hit.to, insert: replacement });
    lastTo = hit.to;
  }
  return changes;
}

/**
 * 把 changes 应用到纯文本（倒序应用，避免前面的替换让后面的偏移失效）。
 * 供面板在替换后重算「下一处命中」的索引，也让单测能验证整次替换结果。
 */
export function applyReplaceChanges(
  text: string,
  changes: ReplaceChange[],
): string {
  const sorted = [...changes].sort((a, b) => b.from - a.from);
  let out = text;
  for (const change of sorted) {
    out = out.slice(0, change.from) + change.insert + out.slice(change.to);
  }
  return out;
}

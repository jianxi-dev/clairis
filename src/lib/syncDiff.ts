/**
 * 回灌最小 diff：把「整篇替换」折算成一次只覆盖真正变化区间的事务。
 *
 * 公共前后缀裁剪是保守的：只动中间不同的那一段，其余字节的位置不变，CM6 的
 * 装饰 / 选区映射不会被整篇重排带走。完全相同返回 null（调用方据此跳过 dispatch）。
 */

export interface SyncDiff {
  /** 替换起点（已 clamp 进文档范围） */
  from: number;
  /** 替换终点（已 clamp 进文档范围，>= from） */
  to: number;
  /** 插入文本 */
  insert: string;
}

/** 求两个字符串的最长公共前缀长度。 */
function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

/** 求两个字符串的最长公共后缀长度（不超过任一串去掉公共前缀后的剩余长度）。 */
function commonSuffixLength(a: string, b: string, prefix: number): number {
  let i = 0;
  while (
    i < a.length - prefix &&
    i < b.length - prefix &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i++;
  }
  return i;
}

/**
 * 计算 `current` → `next` 的最小替换区间。相同返回 null。
 *
 * 结果保证 `from <= to` 且都不越界；调用方仍需按「apply 前文档长度」再 clamp 一次
 * （diff 是按 store 里的目标文本算的，真正落笔时文档可能又被用户改过）。
 */
export function diffContent(current: string, next: string): SyncDiff | null {
  if (current === next) return null;
  const prefix = commonPrefixLength(current, next);
  const suffix = commonSuffixLength(current, next, prefix);
  return {
    from: prefix,
    to: current.length - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
}

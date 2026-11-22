/* 列表空项回车的纯判定，供 smart-input 与单测共用。 */

/** 空项回车动作：退一层（保留列表标记）或退出列表。 */
export type EmptyItemEnterAction = "outdent" | "exit-list";

/** 当前项之后是否存在更深的子项行；跳过空行，取首个非空行比较缩进。 */
export function hasDeeperChild(
  currentIndent: number,
  followingLines: readonly string[],
): boolean {
  for (const line of followingLines) {
    if (line.trim() === "") continue;
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    return indent > currentIndent;
  }
  return false;
}

/**
 * 空项回车动作：有子项且仍有缩进 → 退一层；无子项或已在首层 → 退出列表。
 */
export function emptyItemEnterAction(
  currentIndent: number,
  followingLines: readonly string[],
): EmptyItemEnterAction {
  if (currentIndent > 0 && hasDeeperChild(currentIndent, followingLines)) {
    return "outdent";
  }
  return "exit-list";
}

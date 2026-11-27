/** 会话内 callout emoji 覆盖快照。编辑器发布、预览渲染端读取；不进 markdown。
 *
 * 为什么单独成模块：`stores/index` 会引入 `editors/decorations`，快照模块若
 * 反向依赖 store 就成环。这里只依赖文档文本与纯函数，两端都能安全 import。
 *
 * 快照按「文档内容签名」匹配：编辑态发布时记下当前文档的签名，预览渲染时用
 * 同一份内容取快照。签名不匹配（换了文档）就返回空数组，预览回落类型默认
 * emoji——绝不把 A 文档的覆盖串到 B 文档上。
 *
 * 多面板 / 多页签并存时不能互相覆盖：单槽 `last` 会被最后发布的面板顶掉，
 * 其它面板的预览随即读空。这里改按签名存 Map（保插入序），各自命中各自的。
 */

export type CalloutEmojiSnapshot = (string | undefined)[];

/** 最多保留的签名数；超限删最早插入的 key（Map 保插入序）。 */
const MAX_ENTRIES = 8;

/** 32 位 FNV-1a：对文档前 4000 字做哈希，前缀再带长度，避免截断碰撞。 */
function signatureOf(doc: string): string {
  const sample = doc.slice(0, 4000);
  let hash = 0x811c9dc5;
  for (let i = 0; i < sample.length; i += 1) {
    hash ^= sample.charCodeAt(i);
    // 32 位乘法：| 0 把结果压回有符号 32 位整数（FNV 质数 16777619）。
    hash = (hash * 16777619) | 0;
  }
  return `${doc.length}:${hash}`;
}

const snapshots = new Map<string, CalloutEmojiSnapshot>();

/** 编辑态发布当前文档的覆盖快照（按文档内容签名存，维护上限）。 */
export function setCalloutEmojiSnapshot(
  doc: string,
  snapshot: CalloutEmojiSnapshot,
): void {
  const key = signatureOf(doc);
  // 先删后写：重复发布同一签名时把它移到「最新插入」，避免占着旧位置被淘汰。
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  while (snapshots.size > MAX_ENTRIES) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    snapshots.delete(oldest);
  }
}

/** 预览渲染端读取：签名不匹配（含无快照）返回空数组。 */
export function getCalloutEmojiSnapshot(doc: string): CalloutEmojiSnapshot {
  return snapshots.get(signatureOf(doc)) ?? [];
}

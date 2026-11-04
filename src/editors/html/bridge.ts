/**
 * 编辑态桥的消息收口（E-16 切片 3 / design D4）。
 *
 * iframe 里跑的是**用户文档所在的上下文**，主侧只信自己解析过的形状：
 * 版本位对不上、类型不认识、nodeId 不是字符串，一律丢弃。
 */

export const BRIDGE_VERSION = 1;

export interface SelectionMessage {
  v: number;
  type: "selection";
  nodeId: string | null;
}

export interface ReadyMessage {
  v: number;
  type: "ready";
  nodeCount: number;
}

export type BridgeMessage = SelectionMessage | ReadyMessage;

/** 主侧 → iframe 的命令。 */
export interface HighlightCommand {
  v: number;
  type: "highlight";
  nodeId: string | null;
}

/**
 * 把任意 postMessage 载荷解析成桥消息；形状不对返回 null。
 *
 * 不做 try/catch 兜底猜测：拦不住的载荷就该被丢掉，而不是让半个对象流进状态。
 */
export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg.v !== BRIDGE_VERSION) return null;

  switch (msg.type) {
    case "selection":
      if (msg.nodeId !== null && typeof msg.nodeId !== "string") return null;
      return { v: BRIDGE_VERSION, type: "selection", nodeId: msg.nodeId };
    case "ready":
      if (typeof msg.nodeCount !== "number") return null;
      return { v: BRIDGE_VERSION, type: "ready", nodeCount: msg.nodeCount };
    default:
      return null;
  }
}

/** selection 变化 → 需要下发给 iframe 的命令（nodeId 为 null 表示清除高亮）。 */
export function commandForSelection(nodeId: string | null): HighlightCommand {
  return { v: BRIDGE_VERSION, type: "highlight", nodeId };
}

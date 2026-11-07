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

/** 选中元素的矩形（iframe 视口坐标）。主侧靠它定位工具条（design D2）。 */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionRectMessage {
  v: number;
  type: "selectionRect";
  nodeId: string;
  rect: SelectionRect;
}

export interface ReadyMessage {
  v: number;
  type: "ready";
  nodeCount: number;
}

export interface TextEditMessage {
  v: number;
  type: "textEditInput";
  nodeId: string;
  text: string;
}

export interface BlockSplitMessage {
  v: number;
  type: "splitBlock";
  nodeId: string;
  /** 光标之前的部分。由 iframe 给出——它才是那一刻文本的真相 */
  before: string;
  /** 光标之后的部分 */
  after: string;
}

export interface SaveRequestMessage {
  v: number;
  type: "saveRequest";
}

export interface TextEditEdgeMessage {
  v: number;
  type: "textEditBegin" | "textEditEnd";
  nodeId: string;
}

export type BridgeMessage =
  | SaveRequestMessage
  | TextEditEdgeMessage
  | SelectionMessage
  | SelectionRectMessage
  | ReadyMessage
  | TextEditMessage
  | BlockSplitMessage;

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
    case "selectionRect": {
      if (typeof msg.nodeId !== "string") return null;
      const rect = msg.rect as Record<string, unknown> | null;
      if (typeof rect !== "object" || rect === null) return null;
      const { x, y, width, height } = rect;
      for (const n of [x, y, width, height]) {
        if (typeof n !== "number" || !Number.isFinite(n)) return null;
      }
      return {
        v: BRIDGE_VERSION,
        type: "selectionRect",
        nodeId: msg.nodeId,
        rect: { x, y, width, height } as SelectionRect,
      };
    }
    case "ready":
      if (typeof msg.nodeCount !== "number") return null;
      return { v: BRIDGE_VERSION, type: "ready", nodeCount: msg.nodeCount };
    case "saveRequest":
      return { v: BRIDGE_VERSION, type: "saveRequest" };
    case "textEditBegin":
    case "textEditEnd":
      if (typeof msg.nodeId !== "string") return null;
      return { v: BRIDGE_VERSION, type: msg.type, nodeId: msg.nodeId };
    case "textEditInput":
      if (typeof msg.nodeId !== "string" || typeof msg.text !== "string") {
        return null;
      }
      return {
        v: BRIDGE_VERSION,
        type: "textEditInput",
        nodeId: msg.nodeId,
        text: msg.text,
      };
    case "splitBlock":
      if (
        typeof msg.nodeId !== "string" ||
        typeof msg.before !== "string" ||
        typeof msg.after !== "string"
      ) {
        return null;
      }
      return {
        v: BRIDGE_VERSION,
        type: "splitBlock",
        nodeId: msg.nodeId,
        before: msg.before,
        after: msg.after,
      };
    default:
      return null;
  }
}

/** selection 变化 → 需要下发给 iframe 的命令（nodeId 为 null 表示清除高亮）。 */
export function commandForSelection(nodeId: string | null): HighlightCommand {
  return { v: BRIDGE_VERSION, type: "highlight", nodeId };
}

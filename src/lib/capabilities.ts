/* 核心能力开关（design §D5 / spec X-3）。
 *
 * 每个内置能力一个稳定 id，默认全开。`enable()/disable()` 幂等：重复调用同一
 * 状态不产生任何通知，订阅者只在模块加载时注册一次，因此不会重复挂监听或 DOM。
 *
 * 关闭语义 = 停用渲染/交互路径，**不删用户数据**：源码文本始终留在文档里，
 * 只是不再被水合成图、公式或高亮。
 */

export type CapabilityId =
  "math" | "code-highlight" | "mermaid" | "preview-zoom";

export interface CapabilityMeta {
  id: CapabilityId;
  label: string;
  hint: string;
}

/** 展示顺序即设置面板里的顺序。 */
export const CAPABILITY_META: readonly CapabilityMeta[] = [
  { id: "math", label: "数学公式", hint: "关闭后 $$…$$ 显示为原文" },
  { id: "code-highlight", label: "代码高亮", hint: "关闭后代码块显示为纯文本" },
  { id: "mermaid", label: "图表水合", hint: "关闭后图显示为源码块" },
  {
    id: "preview-zoom",
    label: "预览缩放",
    hint: "关闭后 Ctrl+滚轮/捏合不缩放",
  },
];

const ALL_IDS: readonly CapabilityId[] = CAPABILITY_META.map((m) => m.id);

type Listener = (id: CapabilityId, enabled: boolean) => void;

const state = new Map<CapabilityId, boolean>(ALL_IDS.map((id) => [id, true]));
const listeners = new Set<Listener>();

/** 当前是否启用；未知 id 视为启用（宁可不拦）。 */
export function isCapabilityEnabled(id: CapabilityId): boolean {
  return state.get(id) ?? true;
}

/** 幂等切换：状态未变则不通知，返回是否真的变了。 */
export function setCapabilityEnabled(
  id: CapabilityId,
  enabled: boolean,
): boolean {
  const current = state.get(id) ?? true;
  if (current === enabled) return false;
  state.set(id, enabled);
  for (const listener of listeners) listener(id, enabled);
  return true;
}

export const enableCapability = (id: CapabilityId): boolean =>
  setCapabilityEnabled(id, true);
export const disableCapability = (id: CapabilityId): boolean =>
  setCapabilityEnabled(id, false);

/** 订阅能力变化；同一个函数重复订阅只保留一份。返回退订函数。 */
export function subscribeCapability(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface CapabilityView extends CapabilityMeta {
  enabled: boolean;
}

/** 设置面板用的快照（按展示顺序）。 */
export function listCapabilities(): CapabilityView[] {
  return CAPABILITY_META.map((meta) => ({
    ...meta,
    enabled: isCapabilityEnabled(meta.id),
  }));
}

/** 可持久化的开关表：只包含被显式关闭的项，默认全开的项不落盘。 */
export function serializeCapabilities(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ALL_IDS) {
    if (!isCapabilityEnabled(id)) out[id] = false;
  }
  return out;
}

/**
 * 应用持久化的开关表。未出现的 id 保持默认（开），未知 id 忽略。
 * 只在值真的变化时逐项通知，因此重复加载同一份配置不会重复触发副作用。
 */
export function applyCapabilityConfig(
  config: Record<string, unknown> | null | undefined,
): void {
  if (!config) return;
  for (const id of ALL_IDS) {
    const raw = config[id];
    const enabled = raw === undefined ? true : raw !== false;
    setCapabilityEnabled(id, enabled);
  }
}

/**
 * 测试用：恢复全开。
 * 不动订阅者——渲染模块在 import 时就订阅了一次，清掉会让它们静默失效。
 */
export function resetCapabilities(): void {
  for (const id of ALL_IDS) state.set(id, true);
}

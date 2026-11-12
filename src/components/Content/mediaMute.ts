/**
 * 媒体静音状态（按文件路径隔离）
 *
 * 背景：静音以前是模块级单布尔，subscribeMediaMute 广播给所有播放器实例，
 * 一个页签静音会把其它文件的音视频一起静音（#669）。改为按文件路径（页签
 * 维度）各持一个状态，订阅者只接收自己文件的变化。
 */

type Listener = (key: string, muted: boolean) => void;

/** 文件路径 → 是否静音；缺省视为未静音 */
const mutedMap = new Map<string, boolean>();
const listeners = new Set<Listener>();

export function isMediaMuted(key: string): boolean {
  return mutedMap.get(key) ?? false;
}

export function setMediaMuted(key: string, next: boolean): void {
  if (isMediaMuted(key) === next) return;
  mutedMap.set(key, next);
  listeners.forEach((fn) => fn(key, next));
}

export function toggleMediaMuted(key: string): void {
  setMediaMuted(key, !isMediaMuted(key));
}

/** 页签关闭时清理该文件的静音记录，避免下次打开同一文件残留静音状态。 */
export function clearMediaMuted(key: string): void {
  if (!mutedMap.has(key)) return;
  mutedMap.delete(key);
  listeners.forEach((fn) => fn(key, false));
}

export function subscribeMediaMute(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

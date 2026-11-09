/**
 * 媒体播放器状态（按格持有）
 *
 * 背景：多个栏目可以同时打开视频/音频。单源单例会让「第二栏打开视频」把
 * 第一栏的播放器换源，表现为先前的视频黑屏。这里按格（paneId，缺省用
 * 文件路径）各持有一个源与可见性；宿主为每个格渲染独立 VideoPlayer。
 *
 * - 媒体 tab 激活 → 该格 visible=true，播放器覆盖该格内容区
 * - 切到其他 tab → 该格 visible=false，播放不中断，移出视口
 * - 其他格的操作不影响本格
 */

export interface MediaSource {
  filePath: string;
  url: string;
  fileKind: "video" | "audio";
  /** 媒体所属格的 leaf id。缺省时按文件路径隔离。 */
  paneId?: string;
}

export interface MediaPlayerState {
  /** 当前所有媒体源，按格键去重 */
  sources: MediaSource[];
  /** 格键 → 是否显示在内容区 */
  visibility: Record<string, boolean>;
  /** 最近一次 show 的源（兼容旧调用方/测试） */
  source: MediaSource | null;
  /** 最近一次 show 的源是否可见（兼容旧调用方/测试） */
  visible: boolean;
}

export function mediaKey(source: MediaSource): string {
  return source.paneId ?? source.filePath;
}

let sources: MediaSource[] = [];
let visible: Record<string, boolean> = {};
let lastKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export const mediaPlayer = {
  /** 媒体 tab 激活：写入该格的源并显示；其他格保持不变 */
  show(source: MediaSource) {
    const key = mediaKey(source);
    const index = sources.findIndex((s) => mediaKey(s) === key);
    const sameSource =
      index >= 0 &&
      sources[index].url === source.url &&
      sources[index].filePath === source.filePath;
    const next = sources.slice();
    if (index >= 0) next[index] = source;
    else next.push(source);
    const wasVisible = visible[key] === true;
    sources = next;
    visible = { ...visible, [key]: true };
    lastKey = key;
    if (!sameSource || !wasVisible) emit();
  },
  /** 某个格的媒体 tab 切走：保持播放，移出视口。缺省收起最近一次 show 的格。 */
  minimize(paneId?: string) {
    const key = paneId ?? lastKey;
    if (!key || visible[key] !== true) return;
    visible = { ...visible, [key]: false };
    emit();
  },
  /** 关闭媒体：传路径只停匹配文件；不传则清空全部 */
  stop(filePath?: string) {
    if (filePath === undefined) {
      if (sources.length === 0) return;
      sources = [];
      visible = {};
      lastKey = null;
      emit();
      return;
    }
    const next = sources.filter((s) => s.filePath !== filePath);
    if (next.length === sources.length) return;
    const nextVisible = { ...visible };
    for (const s of sources) {
      if (s.filePath === filePath) delete nextVisible[mediaKey(s)];
    }
    sources = next;
    visible = nextVisible;
    if (lastKey && !sources.some((s) => mediaKey(s) === lastKey)) {
      lastKey = sources.length ? mediaKey(sources[sources.length - 1]) : null;
    }
    emit();
  },
  getState(): MediaPlayerState {
    const source = lastKey
      ? (sources.find((s) => mediaKey(s) === lastKey) ?? null)
      : null;
    return {
      sources,
      visibility: visible,
      source,
      visible: lastKey ? visible[lastKey] === true : false,
    };
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

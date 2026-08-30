/**
 * 媒体播放器状态（模块级单例）
 *
 * 背景：ContentArea 是单实例，tab 切换会卸载 PreviewView → VideoPlayer。
 * 播放器实例常驻挂载（MediaPlayerHost 挂在 ContentSplitView 层）：
 * - 媒体 tab 激活 → 全尺寸覆盖内容区（visible=true）
 * - 切到其他 tab → 播放不中断，移出视口（visible=false），但不显示迷你条
 * - 切回媒体 tab → 恢复全尺寸
 */

export interface MediaSource {
  filePath: string;
  url: string;
  fileKind: "video" | "audio";
}

export interface MediaPlayerState {
  /** 当前播放的媒体源（null = 无媒体） */
  source: MediaSource | null;
  /** 是否以全尺寸显示在内容区（媒体 tab 激活 = true；切走 = false → 离屏继续播放） */
  visible: boolean;
}

let current: MediaPlayerState = { source: null, visible: false };
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export const mediaPlayer = {
  /** 媒体 tab 激活：设置播放源并以全尺寸显示 */
  show(source: MediaSource) {
    const sameSource =
      current.source?.url === source.url &&
      current.source?.filePath === source.filePath;
    const wasHidden = !current.visible;
    current = { source, visible: true };
    // 源变化（switchUrl）或从离屏恢复可见（StrictMode 下 effect
    // 会 show→minimize→show，第二次 show 必须 emit 才能刷新 Host）都要通知
    if (!sameSource || wasHidden) emit();
  },
  /** 媒体 tab 切走：保持播放，移出视口（无迷你条） */
  minimize() {
    if (current.visible && current.source) {
      current = { ...current, visible: false };
      emit();
    }
  },
  /** 关闭播放器（关闭媒体 tab） */
  stop() {
    if (current.source) {
      current = { source: null, visible: false };
      emit();
    }
  },
  getState(): MediaPlayerState {
    return current;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

import { useEffect, useState } from "react";
import { mediaPlayer, type MediaPlayerState } from "./mediaPlayerState";
import VideoPlayer from "./VideoPlayer";

/**
 * 媒体播放器宿主（挂在 ContentSplitView 层，不随 tab 卸载）
 *
 * - 媒体 tab 激活 → 全尺寸覆盖内容区（absolute inset 0）
 * - 切到其他 tab → 播放器移出视口继续播放（无迷你条 UI）
 * - 播放器实例始终挂载，源切换走 switchUrl，画中画不丢失
 */
export default function MediaPlayerHost() {
  const [state, setState] = useState<MediaPlayerState>(() =>
    mediaPlayer.getState(),
  );

  useEffect(
    () => mediaPlayer.subscribe(() => setState(mediaPlayer.getState())),
    [],
  );

  const { source, visible } = state;
  if (!source) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: visible ? 0 : -99999,
        width: "100%",
        height: "100%",
        zIndex: 20,
        background: "var(--app-bg, #fff)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <VideoPlayer
        filePath={source.filePath}
        url={source.url}
        fileKind={source.fileKind}
      />
    </div>
  );
}

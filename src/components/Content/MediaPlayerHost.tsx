import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  mediaKey,
  mediaPlayer,
  type MediaPlayerState,
  type MediaSource,
} from "./mediaPlayerState";
import VideoPlayer from "./VideoPlayer";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 读出格内容区相对宿主父容器的 rect；leaf 的直接子元素是 [header, 内容区]。 */
function readPaneRect(host: HTMLElement, paneId: string): Rect | null {
  const pane = document.querySelector(`[data-pane-id="${paneId}"]`);
  if (!pane) return null;
  const content =
    pane.children.length > 1 ? (pane.children[1] as HTMLElement) : pane;
  const parent = host.parentElement;
  if (!parent) return null;
  const pr = parent.getBoundingClientRect();
  const r = content.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    left: r.left - pr.left,
    top: r.top - pr.top,
    width: r.width,
    height: r.height,
  };
}

/**
 * 媒体播放器宿主（挂在 PaneTreeView/ContentSplitView 层，不随 tab 卸载）
 *
 * - 媒体 tab 激活 → 覆盖**所属格**内容区（visible=true），不遮挡 rail / 其它格
 * - 切到其他 tab → 播放器移出视口继续播放（无迷你条 UI）
 * - 播放器实例始终挂载，源切换走 switchUrl，画中画不丢失
 * - 无格信息（旧调用 / 独立挂载）时退回全尺寸覆盖
 */
export default function MediaPlayerHost() {
  const [state, setState] = useState<MediaPlayerState>(() =>
    mediaPlayer.getState(),
  );

  useEffect(
    () => mediaPlayer.subscribe(() => setState(mediaPlayer.getState())),
    [],
  );

  if (state.sources.length === 0) return null;
  return (
    <>
      {state.sources.map((source) => (
        <PaneMediaPlayer
          key={mediaKey(source)}
          source={source}
          visible={state.visibility[mediaKey(source)] === true}
        />
      ))}
    </>
  );
}

/** 单个格的播放器：常驻挂载，按格定位；隐藏时移出视口但继续播放。 */
function PaneMediaPlayer({
  source,
  visible,
}: {
  source: MediaSource;
  visible: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paneId = source.paneId ?? null;
  const [paneRect, setPaneRect] = useState<{
    paneId: string;
    rect: Rect | null;
  } | null>(null);
  const probed = paneRect?.paneId === paneId;
  const rect = probed ? paneRect.rect : null;

  useEffect(() => {
    if (!paneId) {
      setPaneRect(null);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const update = () =>
      setPaneRect({ paneId, rect: readPaneRect(host, paneId) });
    update();
    const pane = document.querySelector(`[data-pane-id="${paneId}"]`);
    const content =
      pane && pane.children.length > 1
        ? (pane.children[1] as HTMLElement)
        : pane;
    if (typeof ResizeObserver === "undefined" || !content) return;
    const ro = new ResizeObserver(update);
    ro.observe(content);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [paneId]);

  const offscreen = !visible || (paneId !== null && (!probed || rect === null));

  const style: CSSProperties = {
    position: "absolute",
    left: offscreen ? -99999 : rect ? rect.left : 0,
    top: rect ? rect.top : 0,
    width: rect ? rect.width : "100%",
    height: rect ? rect.height : "100%",
    zIndex: 40,
    background: "var(--app-bg, #fff)",
    pointerEvents: visible ? "auto" : "none",
  };

  return (
    <div ref={hostRef} style={style} data-media-pane={paneId ?? undefined}>
      <VideoPlayer
        filePath={source.filePath}
        url={source.url}
        fileKind={source.fileKind}
      />
    </div>
  );
}

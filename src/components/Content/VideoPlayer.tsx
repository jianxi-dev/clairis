import { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import { invoke } from "@tauri-apps/api/core";

/**
 * 视频预览播放器（ArtPlayer 封装）
 *
 * 全屏策略：macOS WKWebView 下 HTML5 原生全屏 API 存在但实际失败（Tauri 已知问题），
 * 因此全屏一律走「网页全屏」（fullscreenWeb，position:fixed 铺满窗口）——
 * 双击、全屏按钮、F 键均切换网页全屏，跨平台行为一致，且不会触发 Tauri 全屏 bug。
 *
 * 快捷键（仅播放器聚焦时生效，不干扰编辑器）：
 * - 空格 播放/暂停、←/→ 快退/快进 5s、↑/↓ 音量、Esc 退出全屏（ArtPlayer 内置）
 * - F 全屏、M 静音（本组件注册）
 *
 * 记忆播放位置：ArtPlayer 内置 autoPlayback，localStorage 按 URL 记录，
 * 再次打开弹「上次看到 … / 跳转播放」提示。
 */
interface VideoPlayerProps {
  /** 本地文件路径（用于 media 协议白名单注册） */
  filePath: string;
  /** media:// 协议 URL（支持 Range 流式） */
  url: string;
}

/** 快捷键提示条文案 */
const SHORTCUT_HINTS: Array<{ keys: string; desc: string }> = [
  { keys: "空格", desc: "播放 / 暂停" },
  { keys: "←/→", desc: "快退 / 快进" },
  { keys: "↑/↓", desc: "音量" },
  { keys: "F", desc: "全屏" },
  { keys: "M", desc: "静音" },
];

export default function VideoPlayer({ filePath, url }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 打开预览时把路径注册到 media 协议白名单
  useEffect(() => {
    void invoke("register_media_path", { path: filePath }).catch(() => {});
  }, [filePath]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 双击不触发 HTML5 原生全屏（macOS WKWebView 下不可靠），由下方 dblclick 接管为网页全屏
    Artplayer.DBCLICK_FULLSCREEN = false;

    const art = new Artplayer({
      container,
      url,
      autoplay: true,
      autoSize: true,
      // 不启用 HTML5 原生全屏（WKWebView 下失败）；只保留网页全屏按钮
      fullscreen: false,
      fullscreenWeb: true,
      // 记忆播放位置：localStorage 记录，弹「上次看到 / 跳转播放」
      autoPlayback: true,
      // 内置快捷键：空格 / ←→ / ↑↓ / Esc（仅播放器聚焦时生效，不干扰编辑器）
      hotkey: true,
      lang: "zh-cn",
      theme: "#6366f1",
      moreVideoAttr: { playsInline: true },
    });

    // 双击 → 网页全屏（铺满窗口，避开 WKWebView 原生全屏 bug）
    art.on("dblclick", () => {
      art.fullscreenWeb = !art.fullscreenWeb;
    });

    // F 全屏 / M 静音（ArtPlayer 内置键位没有这两项）
    art.hotkey.add("KeyF", () => {
      art.fullscreenWeb = !art.fullscreenWeb;
    });
    art.hotkey.add("KeyM", () => {
      art.muted = !art.muted;
    });

    art.on("video:error", () => {
      setError("视频加载失败（可能编码不受支持或文件不可访问）");
    });

    return () => {
      art.destroy(false);
    };
  }, [url]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", flex: 1, minHeight: 0 }}
      />
      {error ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "#666",
            background: "rgba(255,255,255,0.9)",
          }}
        >
          {error}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "4px 16px",
            padding: "6px 14px",
            borderRadius: 8,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(6px)",
            fontSize: 11,
            color: "rgba(255,255,255,0.82)",
            userSelect: "none",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {SHORTCUT_HINTS.map((h) => (
            <span
              key={h.keys}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <kbd
                style={{
                  padding: "0 5px",
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderBottomWidth: 2,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.14)",
                  fontSize: 10,
                  color: "#fff",
                  fontFamily: "inherit",
                }}
              >
                {h.keys}
              </kbd>
              <span>{h.desc}</span>
            </span>
          ))}
          <span style={{ color: "rgba(255,255,255,0.55)" }}>双击视频全屏</span>
        </div>
      )}
    </div>
  );
}

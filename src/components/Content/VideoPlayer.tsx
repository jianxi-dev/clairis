import { useCallback, useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getActiveEditorView } from "../../editors/editorRef";
import { useStore } from "../../stores";
import Icon from "../Icon";
import { iconSvg, type IconName } from "../../ui/icons";

/**
 * 媒体预览播放器（ArtPlayer 封装）
 *
 * 全屏策略：网页全屏（fullscreenWeb）铺满 webview，同时同步 Tauri 窗口全屏
 * （setFullscreen）隐藏系统标题栏 —— 双击、全屏按钮、F 键统一触发。
 *
 * 增强功能（v1.1）：
 * - 播放列表：同目录视频/音频，浮层从播放列表按钮处弹出，switchUrl 切集
 * - 三态循环：不循环 / 单集循环（option.loop）/ 列表循环（video:ended 接管），
 *   循环按钮图标随模式变化，播放列表头部同步
 * - 画中画：pip 按钮（ArtPlayer 原生）
 * - 多字幕：同目录同名 .srt/.ass/.vtt，轨道切换 + 上下位置
 * - 续播记忆：再次打开直接 seek 到上次位置并播放，notice 提示「已续播到 mm:ss」
 * - 音频：频谱图（Web Audio AnalyserNode + canvas）+ 音符 poster 兜底
 * - 时间戳笔记：可拖动/可调整大小的输入窗，写入 inbox 或插入当前 md 编辑器
 *
 * 快捷键（仅播放器聚焦时生效，不干扰编辑器）：
 * 空格 播放/暂停 · ←/→ 快退/快进 · ↑/↓ 音量 · Esc 退出全屏（内置）
 * F 全屏 · M 静音 · N/P 上一集/下一集 · L 循环模式 · C 字幕轨道 · X 字幕位置 · T 时间戳笔记
 */

interface MediaEntry {
  path: string;
  name: string;
  kind: string;
  target: string;
}

interface VideoPlayerProps {
  /** 本地文件路径（用于 media 协议白名单注册 + 播放列表定位） */
  filePath: string;
  /** media:// 协议 URL（支持 Range 流式） */
  url: string;
  /** 文件类型：video / audio（audio 显示频谱图） */
  fileKind?: "video" | "audio";
}

type LoopMode = "none" | "single" | "playlist";

const LOOP_ORDER: LoopMode[] = ["none", "single", "playlist"];
const LOOP_LABEL: Record<LoopMode, string> = {
  none: "不循环",
  single: "单集循环",
  playlist: "列表循环",
};

const LOOP_ICON_NAME: Record<LoopMode, IconName> = {
  none: "loopNone",
  single: "loopSingle",
  playlist: "loopPlaylist",
};

// .art-icon 外壳复用 ArtPlayer 原生控件的 36px 尺寸/缩放；内层 svg 保持 22px 与原生一致。
const PLAYER_ICON_SIZE = 22;

function controlSvg(name: IconName): string {
  return `<i class="art-icon">${iconSvg(name, PLAYER_ICON_SIZE)}</i>`;
}

function loopControlSvg(mode: LoopMode): string {
  const svg = controlSvg(LOOP_ICON_NAME[mode]);
  return mode === "none" ? svg.replace("<i ", '<i style="opacity:0.45" ') : svg;
}

function loopIconSvg(mode: LoopMode): string {
  const svg = iconSvg(LOOP_ICON_NAME[mode]);
  return mode === "none"
    ? svg.replace("<svg ", '<svg style="opacity:0.45" ')
    : svg;
}

/** 媒体文件 → media:// URL（斜杠保留、host 后不追加斜杠，与 Rust decode 约定一致） */
function mediaUrlForPath(path: string): string {
  const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
  const withSlash = encoded.startsWith("/") ? encoded : "/" + encoded;
  return "media://localhost" + withSlash;
}

/** 秒 → mm:ss */
function formatTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** 文件路径 → 文件名 */
function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/** 音频无解码器时的音符 poster（data URI SVG） */
const AUDIO_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
      <rect width="100%" height="100%" fill="#18181f"/>
      <text x="50%" y="50%" font-size="96" text-anchor="middle" dominant-baseline="central"></text>
    </svg>`,
  );

const SHORTCUT_ROWS: Array<[string, string]> = [
  ["空格", "播放 / 暂停"],
  ["←/→", "快退 / 快进 5s"],
  ["↑/↓", "音量"],
  ["F", "全屏"],
  ["M", "静音"],
  ["N / P", "上一集 / 下一集"],
  ["L", "循环模式"],
  ["C", "字幕轨道"],
  ["X", "字幕上 / 下"],
  ["T", "时间戳笔记"],
  ["Esc", "退出全屏"],
  ["双击", "全屏"],
];

const RESUME_MIN_SECONDS = 5;

/** 倍速档位：label 直接做主控件文案，比图标更容易一眼读出当前速度。 */
const PLAYBACK_RATES: Array<{ value: number; label: string }> = [
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1.0×" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2.0×" },
];

const RATE_LABEL = (value: number): string =>
  PLAYBACK_RATES.find((r) => r.value === value)?.label ?? `${value}×`;

function rateControlHtml(value: number): string {
  return `<span class="art-rate-label" style="font-size:12px;line-height:1;letter-spacing:-0.02em;white-space:nowrap">${RATE_LABEL(
    value,
  )}</span>`;
}

type PopoverKind = "playlist" | "subtitle" | "hints" | "rate" | null;

/** 浮层锚点：相对播放器容器的偏移 */
interface PopoverAnchor {
  left: number;
  bottom: number;
}

export default function VideoPlayer({
  filePath,
  url,
  fileKind = "video",
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // props 的 ref 镜像（常驻实例读取最新值，避免创建 effect 因 props 变化重建）
  const urlRef = useRef(url);
  const filePathRef = useRef(filePath);
  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);
  const fileKindRef = useRef(fileKind);
  useEffect(() => {
    fileKindRef.current = fileKind;
  }, [fileKind]);

  const [playlist, setPlaylist] = useState<MediaEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loopMode, setLoopMode] = useState<LoopMode>("none");
  const [rate, setRate] = useState(1);
  const [subtitlePos, setSubtitlePos] = useState<"bottom" | "top">("bottom");
  const [activeSubtitle, setActiveSubtitle] = useState<string>("");
  const [subtitleList, setSubtitleList] = useState<MediaEntry[]>([]);

  const [popover, setPopover] = useState<PopoverKind>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<PopoverAnchor>({
    left: 0,
    bottom: 0,
  });

  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteTime, setNoteTime] = useState(0);
  // 笔记窗口几何：x/y 为相对容器偏移，width/height 为尺寸
  const [noteRect, setNoteRect] = useState({ x: 0, y: 0, w: 360, h: 220 });

  const loopRef = useRef<LoopMode>("none");
  const rateRef = useRef(1);
  const currentIndexRef = useRef(-1);
  const subtitlePosRef = useRef<"bottom" | "top">("bottom");
  const playlistRef = useRef<MediaEntry[]>([]);
  const subtitleRef = useRef<MediaEntry[]>([]);
  const activeSubtitleRef = useRef("");

  // 控件按钮引用（浮层锚定）
  const playlistBtnRef = useRef<HTMLElement | null>(null);
  const subtitleBtnRef = useRef<HTMLElement | null>(null);
  const hintsBtnRef = useRef<HTMLElement | null>(null);

  // 笔记窗口拖拽 / resize
  const noteDragRef = useRef<{
    mode: "move" | "resize" | null;
    /** 四角 resize 方向：nw/ne/sw/se */
    resizeDir?: "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    startRect: { x: number; y: number; w: number; h: number };
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startRect: { x: 0, y: 0, w: 0, h: 0 },
  });

  // 浮层当前值 ref（mounted 闭包读取，避免播放器因 popover 状态重建）
  const popoverRef = useRef<PopoverKind>(null);
  useEffect(() => {
    popoverRef.current = popover;
  }, [popover]);

  /**
   * 设置倍速并同步主控件文案。
   *
   * 变调修正必须同时写 `preservesPitch` 与旧 WebKit 的 `webkitPreservesPitch`：
   * 只写前者时部分 WebKit 内核仍会变调（听感上 1.5× 像快放磁带的尖叫）。
   */
  const applyRate = useCallback((value: number) => {
    rateRef.current = value;
    setRate(value);
    const video = artRef.current?.video;
    if (!video) return;
    video.playbackRate = value;
    video.preservesPitch = true;
    (
      video as HTMLVideoElement & { webkitPreservesPitch?: boolean }
    ).webkitPreservesPitch = true;
    const label = artRef.current?.query<HTMLElement>(
      ".art-control[data-name='rate'] .art-rate-label",
    );
    if (label) label.textContent = RATE_LABEL(value);
  }, []);

  /** 计算按钮相对播放器容器的锚点（浮层从按钮处弹出，右侧不超出容器） */
  const anchorFor = useCallback(
    (btn: HTMLElement | null, popoverWidth: number): PopoverAnchor => {
      const container = containerRef.current;
      if (!container || !btn) return { left: 0, bottom: 0 };
      const cr = container.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      const left = br.left - cr.left;
      const maxLeft = Math.max(0, cr.width - popoverWidth - 8);
      return {
        left: Math.min(left, maxLeft),
        bottom: cr.bottom - br.top,
      };
    },
    [],
  );

  const openPopover = useCallback(
    (kind: Exclude<PopoverKind, null>, btn: HTMLElement | null, w: number) => {
      setPopoverAnchor(anchorFor(btn, w));
      setPopover(kind);
    },
    [anchorFor],
  );

  // 打开预览时把路径注册到 media 协议白名单 + 加载播放列表
  useEffect(() => {
    void invoke("register_media_path", { path: filePath }).catch(() => {});
    void invoke<MediaEntry[]>("list_media_in_dir", { path: filePath })
      .then((items) => {
        const media = items.filter((i) => i.kind !== "subtitle");
        const subs = items.filter((i) => i.kind === "subtitle");
        playlistRef.current = media;
        subtitleRef.current = subs;
        setPlaylist(media);
        setSubtitleList(subs);
        const idx = media.findIndex((i) => i.path === filePath);
        currentIndexRef.current = idx >= 0 ? idx : 0;
        setCurrentIndex(currentIndexRef.current);
      })
      .catch(() => {
        // 非 Tauri 环境或无目录访问权限：降级为仅当前文件
      });
  }, [filePath]);

  const playIndexRef = useRef<(i: number) => void>(() => {});
  const playIndex = useCallback(
    async (i: number) => {
      const art = artRef.current;
      const list = playlistRef.current;
      if (!art || list.length === 0) return;
      const idx = ((i % list.length) + list.length) % list.length;
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      applyRate(1);
      try {
        await art.switchUrl(mediaUrlForPath(list[idx].path));
        // 页签路径保持不变（仍归属原文件），仅显示名跟随当前媒体
        const store = useStore.getState();
        const owner = Object.values(store.tabs).find(
          (t) => t.path === filePathRef.current,
        );
        if (owner) {
          store.renameTab(owner.id, list[idx].name || baseName(list[idx].path));
        }
        // 切集后自动加载对应同名字幕（若有）
        const stem = list[idx].name.replace(/\.[^.]+$/, "");
        const sub = subtitleRef.current.find((s) => s.target === stem);
        if (sub) {
          void art.subtitle.switch(mediaUrlForPath(sub.path), {
            name: sub.name,
          });
          setActiveSubtitle(sub.name);
        } else {
          setActiveSubtitle("");
        }
      } catch {
        // 文件损坏/不可解码：跳到下一个可播文件
        if (list.length > 1) playIndexRef.current(idx + 1);
      }
    },
    [applyRate],
  );
  useEffect(() => {
    playIndexRef.current = playIndex;
  }, [playIndex]);

  const cycleLoop = useCallback(() => {
    const next =
      LOOP_ORDER[(LOOP_ORDER.indexOf(loopRef.current) + 1) % LOOP_ORDER.length];
    loopRef.current = next;
    setLoopMode(next);
    const art = artRef.current;
    if (!art) return;
    art.option.loop = next === "single";
    // 同步循环按钮图标
    const btn = art.query<HTMLElement>(".art-control[data-name='loop']");
    if (btn) btn.innerHTML = loopControlSvg(next);
    art.notice.show = `循环: ${LOOP_LABEL[next]}`;
  }, []);

  const toggleSubtitlePos = useCallback(() => {
    const next = subtitlePosRef.current === "bottom" ? "top" : "bottom";
    subtitlePosRef.current = next;
    setSubtitlePos(next);
    const art = artRef.current;
    if (!art) return;
    art.subtitle.style({
      bottom: next === "top" ? "calc(100% - 90px)" : "15px",
    });
  }, []);

  const selectSubtitle = useCallback(async (subPath: string) => {
    const art = artRef.current;
    if (!art) return;
    if (!subPath) {
      setActiveSubtitle("");
      art.subtitle.url = "";
      return;
    }
    try {
      await art.subtitle.switch(mediaUrlForPath(subPath), {
        name: baseName(subPath),
      });
      setActiveSubtitle(baseName(subPath));
    } catch {
      // 字幕加载失败：忽略，不影响播放
    }
  }, []);

  const openNote = useCallback(() => {
    const art = artRef.current;
    if (!art) return;
    art.pause();
    setNoteTime(art.currentTime);
    setNoteText("");
    setShowNote(true);
    setPopover(null);
    // 默认弹出在进度条上方（容器底部向上偏移 ~110px），水平居中
    const container = containerRef.current;
    if (container) {
      const w = 360;
      const h = 180;
      const cx = container.clientWidth;
      const cy = container.clientHeight;
      setNoteRect({
        x: Math.max(8, Math.floor(cx / 2 - w / 2)),
        y: Math.max(8, cy - h - 110),
        w,
        h,
      });
    }
  }, []);

  const saveNote = useCallback(async () => {
    const text = noteText.trim();
    const art = artRef.current;
    if (!text || !art) return;
    const stamp = `[${baseName(filePath)} @${formatTime(noteTime)}] ${text}`;
    try {
      await invoke("append_inbox", {
        entry: {
          id: `note-${Date.now()}`,
          content: stamp,
          prefix: ".",
          capturedAt: new Date().toISOString(),
        },
      });
    } catch {
      // inbox 写入失败：尝试插入当前编辑器
      const view = getActiveEditorView();
      if (view) {
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: stamp + "\n" },
        });
      }
    }
    setNoteText("");
    setShowNote(false);
    art.play();
  }, [noteText, noteTime, filePath]);

  // 笔记窗口拖拽 / resize 全局事件
  useEffect(() => {
    if (!showNote) return;
    const onMove = (e: PointerEvent) => {
      const drag = noteDragRef.current;
      if (!drag.mode) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.mode === "move") {
        setNoteRect((r) => ({
          ...r,
          x: drag.startRect.x + dx,
          y: drag.startRect.y + dy,
        }));
      } else {
        const dir = drag.resizeDir ?? "se";
        const minW = 260;
        const minH = 160;
        setNoteRect(() => {
          let { x, y, w, h } = drag.startRect;
          if (dir.includes("e")) w = Math.max(minW, drag.startRect.w + dx);
          if (dir.includes("s")) h = Math.max(minH, drag.startRect.h + dy);
          if (dir.includes("w")) {
            w = Math.max(minW, drag.startRect.w - dx);
            x = drag.startRect.x + (drag.startRect.w - w);
          }
          if (dir.includes("n")) {
            h = Math.max(minH, drag.startRect.h - dy);
            y = drag.startRect.y + (drag.startRect.h - h);
          }
          return { x, y, w, h };
        });
      }
    };
    const onUp = () => {
      noteDragRef.current.mode = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [showNote]);

  // 创建播放器（常驻：只创建一次，url/fileKind 变化由下方独立 effect 处理）
  /* eslint-disable react-hooks/exhaustive-deps -- 回调均 useCallback([]) 稳定、闭包只读 refs，加依赖会导致 tab 切换重建实例 */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    Artplayer.DBCLICK_FULLSCREEN = false;

    const initialUrl = urlRef.current;
    const initialKind = fileKindRef.current;

    const art = new Artplayer({
      container,
      url: initialUrl,
      autoplay: true,
      autoSize: true,
      fullscreen: false,
      fullscreenWeb: true,
      pip: true,
      // 记忆播放：显示「上次看到 mm:ss / 跳转播放」浮层（下详 ready 自动跳转）
      autoPlayback: true,
      hotkey: true,
      lang: "zh-cn",
      theme: "#6366f1",
      ...(initialKind === "audio" ? { poster: AUDIO_POSTER } : {}),
      moreVideoAttr: { playsInline: true },
      controls: [
        {
          name: "playlist",
          position: "right",
          index: 42,
          html: controlSvg("playlist"),
          tooltip: "播放列表",
          mounted: function ($control) {
            playlistBtnRef.current = $control;
            this.proxy($control, "click", () => {
              if (popoverRef.current === "playlist") {
                setPopover(null);
              } else {
                openPopover("playlist", $control, 260);
              }
            });
          },
        },
        {
          name: "loop",
          position: "right",
          index: 52,
          html: loopControlSvg("none"),
          tooltip: "循环模式",
          mounted: function ($control) {
            $control.dataset.name = "loop";
            this.proxy($control, "click", () => cycleLoop());
          },
        },
        {
          name: "rate",
          position: "right",
          index: 50,
          html: rateControlHtml(1),
          tooltip: "播放速度",
          mounted: function ($control) {
            $control.dataset.name = "rate";
            this.proxy($control, "click", () => {
              if (popoverRef.current === "rate") {
                setPopover(null);
              } else {
                openPopover("rate", $control, 132);
              }
            });
          },
        },
        {
          name: "subtitle",
          position: "right",
          index: 54,
          html: controlSvg("subtitle"),
          tooltip: "字幕",
          mounted: function ($control) {
            subtitleBtnRef.current = $control;
            this.proxy($control, "click", () => {
              if (popoverRef.current === "subtitle") {
                setPopover(null);
              } else {
                openPopover("subtitle", $control, 230);
              }
            });
          },
        },
        {
          name: "note",
          position: "right",
          index: 56,
          html: controlSvg("timestampNote"),
          tooltip: "时间戳笔记",
          mounted: function ($control) {
            this.proxy($control, "click", () => openNote());
          },
        },
        {
          name: "hints",
          position: "right",
          index: 80,
          html: controlSvg("keyboardHints"),
          tooltip: "快捷键说明",
          mounted: function ($control) {
            hintsBtnRef.current = $control;
            this.proxy($control, "click", () => {
              if (popoverRef.current === "hints") {
                setPopover(null);
              } else {
                openPopover("hints", $control, 250);
              }
            });
          },
        },
      ],
    });
    artRef.current = art;

    // 双击 → 网页全屏 + 同步窗口全屏
    const toggleFullscreenWeb = () => {
      art.fullscreenWeb = !art.fullscreenWeb;
    };
    art.on("dblclick", toggleFullscreenWeb);

    // 全屏时隐藏系统标题栏（关闭/最小化/最大化按钮）
    const syncWindowFullscreen = (on: boolean) => {
      const win = getCurrentWindow();
      // setDecorations(false) 直接移除标题栏与窗口按钮（macOS 可靠路径），
      // setFullscreen 进入原生全屏兜底；进入时先去装饰再全屏，退出时先退全屏再还原
      const apply = on
        ? win.setDecorations(false).then(() => win.setFullscreen(true))
        : win.setFullscreen(false).then(() => win.setDecorations(true));
      void apply.catch((err) => {
        console.warn("window fullscreen sync failed", on, err);
      });
    };
    art.on("fullscreenWeb", (state: boolean) => {
      syncWindowFullscreen(state);
    });
    // 浏览器原生全屏事件兜底（ArtPlayer 内部 webkit 全屏路径）
    const onNativeFullscreen = () => {
      syncWindowFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onNativeFullscreen);

    art.hotkey.add("KeyF", toggleFullscreenWeb);
    art.hotkey.add("KeyM", () => {
      art.muted = !art.muted;
    });

    // 播放列表切集 / 循环模式
    art.hotkey.add("KeyN", () => {
      void playIndex(currentIndexRef.current + 1);
    });
    art.hotkey.add("KeyP", () => {
      void playIndex(currentIndexRef.current - 1);
    });
    art.hotkey.add("KeyL", () => cycleLoop());

    // 字幕：C 切轨道，X 切换上下位置
    art.hotkey.add("KeyC", () => {
      const subs = subtitleRef.current;
      if (subs.length === 0) return;
      const idx = subs.findIndex((s) => s.name === activeSubtitleRef.current);
      void selectSubtitle(subs[(idx + 1) % subs.length].path);
    });
    art.hotkey.add("KeyX", () => toggleSubtitlePos());

    art.hotkey.add("KeyT", () => openNote());

    // 自动播放下一个：默认顺序连播（最后一个停），playlist 模式回绕，single 由 option.loop 内部处理
    art.on("video:ended", () => {
      if (loopRef.current === "single") return; // ArtPlayer 内部 loop 已处理
      const list = playlistRef.current;
      const cur = currentIndexRef.current;
      if (list.length === 0) return;
      if (loopRef.current === "playlist" || cur < list.length - 1) {
        void playIndex(cur + 1);
      }
    });

    // 续播记忆：autoPlayback 负责存储进度 + 显示「上次看到 mm:ss」浮层；
    // ready 后自动定位到上次位置（无需点击「跳转播放」），浮层停留数秒后自行消失
    Artplayer.AUTO_PLAYBACK_TIMEOUT = 8000;
    art.on("ready", () => {
      try {
        const settings = JSON.parse(
          localStorage.getItem("artplayer_settings") ?? "{}",
        ) as { times?: Record<string, number> };
        const saved = settings.times?.[initialUrl] ?? 0;
        if (saved >= RESUME_MIN_SECONDS) {
          art.currentTime = saved;
          void art.play();
        }
      } catch {
        // 忽略
      }
    });

    art.on("video:error", () => {
      setError("视频加载失败（可能编码不受支持或文件不可访问）");
    });

    // ArtPlayer 的 autoSize 只跟随 window resize；分栏拖拽与格全屏改的是容器尺寸，
    // 不触发 window resize，画面会停在旧比例。容器自身的尺寸变化必须回到同一条重排入口。
    let fitRaf = 0;
    const fitObserver = new ResizeObserver(() => {
      if (fitRaf) return;
      fitRaf = window.requestAnimationFrame(() => {
        fitRaf = 0;
        art.autoSize();
      });
    });
    fitObserver.observe(container);

    return () => {
      fitObserver.disconnect();
      if (fitRaf) window.cancelAnimationFrame(fitRaf);
      document.removeEventListener("fullscreenchange", onNativeFullscreen);
      art.destroy(false);
      artRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  // 播放源切换（媒体 tab 切换）：switchUrl 更新，不重建实例（画中画/播放状态保持）。
  // 用 lastUrlRef 记录「上次已成功切换的 url」而非镜像 prop：若镜像 prop 提前
  // 同步，切换 effect 的短路判断会恒真，switchUrl 永不执行（StrictMode 下更甚）。
  const lastUrlRef = useRef(url);
  useEffect(() => {
    const art = artRef.current;
    if (!art) return;
    if (url === lastUrlRef.current) return;
    applyRate(1);
    void art
      .switchUrl(url)
      .then(() => {
        lastUrlRef.current = url;
      })
      .catch(() => {});
  }, [url, applyRate]);

  // 媒体类型切换（video ↔ audio）：更新 poster
  useEffect(() => {
    const art = artRef.current;
    if (!art) return;
    if (fileKind === "audio") {
      art.poster = AUDIO_POSTER;
    } else {
      art.poster = "";
    }
  }, [fileKind]);

  // activeSubtitle ref 同步（供 hotkey 闭包读取最新值）
  useEffect(() => {
    activeSubtitleRef.current = activeSubtitle;
  }, [activeSubtitle]);

  // 音频频谱图：Web Audio AnalyserNode → canvas
  useEffect(() => {
    if (fileKind !== "audio") return;
    const art = artRef.current;
    const canvas = canvasRef.current;
    if (!art || !canvas) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let rafId = 0;
    const ctx2d = canvas.getContext("2d");

    const setupAudio = () => {
      if (audioCtx) return;
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source = audioCtx.createMediaElementSource(art.video);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        void audioCtx.resume();
      } catch {
        // Web Audio 不可用（如 CORS 限制）：保留 poster
      }
    };

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      if (!ctx2d || !analyser) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const bars = 48;
      const gap = 3;
      const bw = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length)] / 255;
        const bh = Math.max(3, v * (h - 8));
        const x = i * (bw + gap);
        const y = h - bh - 2;
        ctx2d.fillStyle = `rgba(129, 140, 248, ${0.35 + v * 0.65})`;
        ctx2d.fillRect(x, y, bw, bh);
      }
    };

    const onPlay = () => {
      setupAudio();
      if (!rafId) draw();
    };
    art.on("video:play", onPlay);

    return () => {
      cancelAnimationFrame(rafId);
      art.off("video:play", onPlay);
      try {
        source?.disconnect();
        analyser?.disconnect();
        void audioCtx?.close();
      } catch {
        // 忽略
      }
    };
  }, [fileKind]);

  const mediaItems = playlist;

  const popoverStyle: React.CSSProperties = {
    position: "absolute",
    left: popoverAnchor.left,
    bottom: popoverAnchor.bottom + 8,
    zIndex: 100,
    borderRadius: 8,
    background: "rgba(0,0,0,0.88)",
    backdropFilter: "blur(8px)",
    color: "#fff",
    fontSize: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    maxHeight: "70%",
    overflowY: "auto",
  };

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
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
      {/* 音频频谱覆盖层（仅 audio，且播放中） */}
      {fileKind === "audio" && (
        <canvas
          ref={canvasRef}
          width={480}
          height={90}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 90,
            transform: "translateX(-50%)",
            width: "70%",
            height: 72,
            pointerEvents: "none",
            opacity: 0.9,
          }}
        />
      )}
      {error && (
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
      )}

      {/* 倍速菜单（从按钮处弹出） */}
      {popover === "rate" && (
        <div
          className="rate-menu"
          role="menu"
          style={{ ...popoverStyle, width: 132, padding: "4px 0" }}
        >
          {PLAYBACK_RATES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="menuitemradio"
              aria-checked={rate === r.value}
              className="rate-menu-item"
              data-rate={r.value}
              onClick={() => {
                applyRate(r.value);
                setPopover(null);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "7px 12px",
                border: "none",
                background: rate === r.value ? "rgba(99,102,241,0.35)" : "none",
                color: rate === r.value ? "#fff" : "rgba(255,255,255,0.78)",
                fontSize: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {r.label}
              {rate === r.value ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {/* 播放列表浮层（从按钮处弹出） */}
      {popover === "playlist" && (
        <div style={{ ...popoverStyle, width: 260 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: `${loopIconSvg(loopMode)} 播放列表（${mediaItems.length}）· ${LOOP_LABEL[loopMode]}`,
              }}
            />
            <button
              onClick={() => setPopover(null)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {mediaItems.length === 0 && (
            <div style={{ padding: 12, color: "rgba(255,255,255,0.5)" }}>
              无同目录媒体文件
            </div>
          )}
          {mediaItems.map((item, i) => (
            <div
              key={item.path}
              onClick={() => {
                void playIndex(i);
                setPopover(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                cursor: "pointer",
                background:
                  i === currentIndex ? "rgba(99,102,241,0.35)" : "transparent",
                color: i === currentIndex ? "#fff" : "rgba(255,255,255,0.8)",
              }}
            >
              <span>
                <Icon
                  name={item.kind === "audio" ? "audio" : "video"}
                  size={18}
                />
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </span>
              {i === currentIndex && <span>●</span>}
            </div>
          ))}
        </div>
      )}

      {/* 字幕选择浮层（从按钮处弹出） */}
      {popover === "subtitle" && (
        <div style={{ ...popoverStyle, width: 230 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span>字幕</span>
            <button
              onClick={() => setPopover(null)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {subtitleList.length === 0 && (
            <div style={{ padding: 10, color: "rgba(255,255,255,0.5)" }}>
              无同目录字幕文件（.srt/.ass/.vtt）
            </div>
          )}
          <div
            onClick={() => void selectSubtitle("")}
            style={{
              padding: "7px 10px",
              cursor: "pointer",
              color: !activeSubtitle ? "#fff" : "rgba(255,255,255,0.7)",
            }}
          >
            {activeSubtitle ? "○" : "●"} 关闭字幕
          </div>
          {subtitleList.map((sub) => (
            <div
              key={sub.path}
              onClick={() => void selectSubtitle(sub.path)}
              style={{
                padding: "7px 10px",
                cursor: "pointer",
                color:
                  activeSubtitle === sub.name
                    ? "#fff"
                    : "rgba(255,255,255,0.7)",
              }}
            >
              {activeSubtitle === sub.name ? "●" : "○"} {sub.name}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span>位置:</span>
            <button
              onClick={() => toggleSubtitlePos()}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 4,
                color: "#fff",
                padding: "2px 8px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {subtitlePos === "bottom" ? "下方" : "上方"}
            </button>
          </div>
        </div>
      )}

      {/* 快捷键说明浮层（从按钮处弹出） */}
      {popover === "hints" && (
        <div style={{ ...popoverStyle, width: 250 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span>快捷键</span>
            <button
              onClick={() => setPopover(null)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div
            style={{
              padding: "8px 10px",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "6px 12px",
            }}
          >
            {SHORTCUT_ROWS.map(([k, d]) => (
              <div key={k} style={{ display: "contents" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{k}</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 时间戳笔记窗口：可拖动 + 可调整大小 */}
      {showNote && (
        <div
          style={{
            position: "absolute",
            left: noteRect.x,
            top: noteRect.y,
            width: noteRect.w,
            height: noteRect.h,
            zIndex: 110,
            borderRadius: 8,
            background: "rgba(20,20,28,0.95)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {/* 标题栏（可拖动） */}
          <div
            onPointerDown={(e) => {
              noteDragRef.current = {
                mode: "move",
                startX: e.clientX,
                startY: e.clientY,
                startRect: { ...noteRect },
              };
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 10px",
              cursor: "move",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            <span>
              <Icon name="text" size={18} className="mr-1 inline-block" />
              记录 @ {formatTime(noteTime)}
            </span>
            <button
              onClick={() => {
                setShowNote(false);
                artRef.current?.play();
              }}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {/* 输入区（弹性放大） */}
          <textarea
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="输入笔记内容，Ctrl/⌘+回车保存…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void saveNote();
              }
              if (e.key === "Escape") {
                setShowNote(false);
                artRef.current?.play();
              }
            }}
            style={{
              flex: 1,
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 0,
              color: "#fff",
              fontSize: 13,
              padding: 6,
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {/* 底部操作条 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "3px 8px",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>
              写入 inbox
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => {
                  setShowNote(false);
                  artRef.current?.play();
                }}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 10px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                取消
              </button>
              <button
                onClick={() => void saveNote()}
                style={{
                  background: "#6366f1",
                  border: "none",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 10px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                保存
              </button>
            </div>
          </div>
          {/* 四角隐形 resize 热区（无可见三角） */}
          <NoteResizeCorners
            onStart={(dir, e) => {
              e.stopPropagation();
              noteDragRef.current = {
                mode: "resize",
                resizeDir: dir,
                startX: e.clientX,
                startY: e.clientY,
                startRect: { ...noteRect },
              };
            }}
          />
        </div>
      )}
    </div>
  );
}

/** 笔记窗口四角隐形 resize 热区（无可见三角，光标提示方向） */
function NoteResizeCorners({
  onStart,
}: {
  onStart: (dir: "nw" | "ne" | "sw" | "se", e: React.PointerEvent) => void;
}) {
  const corners: Array<{
    dir: "nw" | "ne" | "sw" | "se";
    style: React.CSSProperties;
  }> = [
    { dir: "nw", style: { left: 0, top: 0, cursor: "nwse-resize" } },
    { dir: "ne", style: { right: 0, top: 0, cursor: "nesw-resize" } },
    { dir: "sw", style: { left: 0, bottom: 0, cursor: "nesw-resize" } },
    { dir: "se", style: { right: 0, bottom: 0, cursor: "nwse-resize" } },
  ];
  return (
    <>
      {corners.map((c) => (
        <div
          key={c.dir}
          onPointerDown={(e) => onStart(c.dir, e)}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            ...c.style,
            zIndex: 2,
          }}
        />
      ))}
    </>
  );
}

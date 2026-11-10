import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { isTauriEnv } from "../utils/tauri";
import { log } from "../utils/log";
import type { AppConfig, ScrollPosition, Theme } from "../types";
import {
  applyCapabilityConfig,
  serializeCapabilities,
} from "../lib/capabilities";
import {
  parseSerializedLayout,
  restoreLayout,
  type SerializedNode,
} from "../lib/paneTree";
import {
  DEFAULT_RAIL_VIEW_SPEC,
  type RailDensity,
  type RailLayout,
  type RailViewSpec,
} from "../lib/railView";
import { DENSITY_HEIGHT, clampCardHeight } from "../lib/railCards";
import { normalizePreviewSettings } from "../lib/previewAnchor";
import {
  DEFAULT_VIEW_SPEC,
  normalizeViewSpec,
  type ViewSpec,
} from "../lib/aiViewSpec";

/** Snake-case config from Rust, mapped to camelCase in the store. */
interface RustAppConfig {
  fontSize: number | null;
  headingColors: Record<string, string> | null;
  readerFontSize: number | null;
  readerWidth: number | null;
  readerSkin: string | null;
  defaultSavePath?: string | null;
  ollamaEndpoint: string | null;
  openaiEndpoint: string | null;
  openaiModel: string | null;
  translationProvider: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  theme: string | null;
  aiConfirmDensity: string | null;
  iconLabel: string | null;
  sidebarLeftVisible: boolean | null;
  sidebarRightVisible: boolean | null;
  sidebarLeftWidth: number | null;
  sidebarRightWidth: number | null;
  horizontalSplitRatio: number | null;
  verticalSplitRatio: number | null;
  recentFiles: Array<{
    path: string;
    title: string;
    openedAt: string;
    excerpt?: string;
  }> | null;
  scrollPositions: Record<string, ScrollPosition> | null;
  capabilities?: Record<string, boolean> | null;
  rouletteSectors?: string[] | null;
  paneLayout?: string | null;
  railViewSpec?: {
    layout: string | null;
    density: string | null;
    cardHeight?: number | null;
  } | null;
  previewSettings?: {
    railHover: boolean | null;
    gridMode: string | null;
    enabled: boolean | null;
  } | null;
  aiViewSpec?: {
    railLayout?: string | null;
    railDensity?: string | null;
    railCardHeight?: number | null;
    blockColors?: boolean | null;
    iconLabel?: string | null;
    previewEnabled?: boolean | null;
    railPinnedWidth?: number | null;
    gridMode?: string | null;
    gridGrouping?: string | null;
    gridSort?: string | null;
    unreadOnly?: boolean | null;
    themeGroups?: boolean | null;
    pinnedAndRecentOnly?: boolean | null;
    pinnedSegmentScale?: number | null;
  } | null;
}

const DEBOUNCE_MS = 500;

const SAVE_ECHO_WINDOW_MS = 1500;
let lastLocalSaveAt = 0;

/** Apply theme to <html> element. */
export function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (!root) return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", isDark);
  root.classList.toggle("warm", !isDark && theme === "warm");
}

/** Apply theme to <html> element. */
export function applyReaderSkin(skin: string): void {
  document.documentElement.dataset.skin = skin || "paper";
}

/** Persist the current editor + app config (module-level, callable outside hooks). */
export async function saveAppConfig(): Promise<void> {
  if (!isTauriEnv()) return;
  lastLocalSaveAt = Date.now();
  const es = useEditorStore.getState();
  const config: RustAppConfig = {
    fontSize: es.fontSize,
    headingColors: es.headingColors
      ? ({ ...es.headingColors } as unknown as Record<string, string>)
      : null,
    readerFontSize: es.config.readerFontSize ?? null,
    readerWidth: es.config.readerWidth ?? null,
    readerSkin: es.config.readerSkin ?? null,
    defaultSavePath: es.config.defaultSavePath ?? null,
    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
    openaiEndpoint: es.config.openaiEndpoint ?? null,
    openaiModel: es.config.openaiModel ?? null,
    translationProvider: es.config.translationProvider ?? null,
    sourceLang: es.config.langPair?.source ?? null,
    targetLang: es.config.langPair?.target ?? null,
    theme: es.config.theme ?? null,
    aiConfirmDensity: es.config.aiConfirmDensity ?? null,
    iconLabel: es.config.iconLabel ?? null,
    sidebarLeftVisible: es.config.sidebarLeftVisible ?? null,
    sidebarRightVisible: es.config.sidebarRightVisible ?? null,
    sidebarLeftWidth: es.config.sidebarLeftWidth ?? null,
    sidebarRightWidth: es.config.sidebarRightWidth ?? null,
    horizontalSplitRatio: es.config.horizontalSplitRatio ?? null,
    verticalSplitRatio: es.config.verticalSplitRatio ?? null,
    // 读 store 的实时值，不是加载时的陈旧快照——否则本次会话新开的文件
    // 永远不会被持久化，门户下次启动又变成空的
    recentFiles: useStore.getState().recentFiles,
    scrollPositions: useStore.getState().scrollPositions ?? null,
    capabilities: serializeCapabilities(),
    rouletteSectors: es.config.rouletteSectors ?? null,
    // 读实时值：本次会话分裂/调整的比例要能持久化
    paneLayout: useStore.getState().paneLayoutJson(),
    // 阅读空间栏「设为默认」规格（layout-portal 6.1）
    railViewSpec: useStore.getState().railViewSpec,
    // 悬浮预览窗双轨开关（layout-portal 8.1）
    previewSettings: useStore.getState().previewSettings,
    // AI 视图改写规格（layout-portal 9.1）
    aiViewSpec: useStore.getState().captureViewSpec(),
  };
  try {
    await invoke("save_config", { config });
  } catch (e) {
    log.error("Config", "Failed to save config", e);
  }
}

/**
 * 启动时恢复工作区布局树（layout-portal 3.1）。
 *
 * 持久化的是每格页签的文件路径；这里按路径走 open_file_direct 把页签重建
 * 出来，再按原结构还原。解析失败 / 文件已不在都退化处理，绝不抛错。
 * 只在首次配置加载时跑一次（reloadAppConfig 重入由 guard 拦掉）。
 */
let paneRestoreStarted = false;

async function restorePaneLayout(
  paneLayoutJson: string | null | undefined,
): Promise<void> {
  if (paneRestoreStarted) return;
  paneRestoreStarted = true;
  if (!paneLayoutJson) return;

  const parsed = parseSerializedLayout(paneLayoutJson);
  if (!parsed) {
    log.warn("Config", "paneLayout 解析失败，退回默认单格");
    return;
  }

  const paths = new Set<string>();
  const collect = (node: SerializedNode) => {
    if (node.type === "leaf") {
      for (const p of node.tabs) paths.add(p);
      if (node.activePath) paths.add(node.activePath);
    } else {
      collect(node.children[0]);
      collect(node.children[1]);
    }
  };
  collect(parsed.root);
  if (paths.size === 0) return;

  const idOfPath = (path: string): string | null => {
    const tab = Object.values(useStore.getState().tabs).find(
      (t) => t.path === path,
    );
    return tab ? tab.id : null;
  };

  for (const path of paths) {
    if (idOfPath(path)) continue;
    try {
      const result = await invoke<{
        content: string;
        path: string;
        file_size: number;
      }>("open_file_direct", { path });
      useStore.getState().openFile(result.path, result.content);
    } catch (e) {
      log.warn("Config", `布局恢复：文件打不开，跳过 ${path}`, e);
    }
  }

  const { root, focusedId } = restoreLayout(parsed, idOfPath);
  useStore.getState().restorePaneLayout(root, focusedId);
}

/**
 * 阅读空间栏视图规格的合法取值；非法 / 缺失一律退回默认。
 * 老配置没有 `rail_view_spec` 时走默认值，绝不抛错。
 */
function normalizeRailViewSpec(
  raw: RustAppConfig["railViewSpec"],
): RailViewSpec {
  const layouts: RailLayout[] = ["stacked", "tabs"];
  const densities: RailDensity[] = ["compact", "comfortable", "card"];
  const layout = layouts.includes(raw?.layout as RailLayout)
    ? (raw?.layout as RailLayout)
    : DEFAULT_RAIL_VIEW_SPEC.layout;
  const density = densities.includes(raw?.density as RailDensity)
    ? (raw?.density as RailDensity)
    : DEFAULT_RAIL_VIEW_SPEC.density;
  const cardHeight = clampCardHeight(
    raw?.cardHeight ?? DEFAULT_RAIL_VIEW_SPEC.cardHeight ?? DENSITY_HEIGHT.card,
  );
  // 卡片高度只属于卡片档；紧凑/舒适档保持 6.1 的规格形状（无该字段）
  return density === "card"
    ? { layout, density, cardHeight }
    : { layout, density };
}

/**
 * Map a Rust config onto the stores and the document.
 * Touches config/theme only; never rewrites editor content.
 */
const ROULETTE_SECTOR_IDS = [
  "smart",
  "convert",
  "align",
  "columns",
  "history",
  "clear",
  "format",
  "color",
] as const;

export function normalizeRouletteSectors(
  raw: string[] | null | undefined,
): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: string[] = [];
  for (const id of raw) {
    if (!ROULETTE_SECTOR_IDS.some((known) => known === id)) {
      log.warn("Config", `忽略未知轮盘扇区: ${id}`);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out.length > 0 ? out : null;
}

function applyRustConfig(raw: RustAppConfig): void {
  const config: Partial<AppConfig> = {
    fontSize: raw.fontSize ?? 17,
    headingColors: raw.headingColors
      ? (raw.headingColors as unknown as AppConfig["headingColors"])
      : undefined,
    readerFontSize: raw.readerFontSize ?? 17,
    readerWidth: raw.readerWidth ?? 1080,
    readerSkin: raw.readerSkin ?? "paper",
    defaultSavePath: raw.defaultSavePath ?? null,
    ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
    openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
    openaiModel: raw.openaiModel ?? "gpt-4o-mini",
    translationProvider:
      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
    langPair: {
      source: raw.sourceLang ?? "en",
      target: raw.targetLang ?? "zh-CN",
    },
    theme: (raw.theme as Theme) ?? "system",
    aiConfirmDensity:
      (raw.aiConfirmDensity as AppConfig["aiConfirmDensity"]) ??
      "session-silent",
    iconLabel: (raw.iconLabel as AppConfig["iconLabel"]) ?? "text",
    sidebarLeftVisible: raw.sidebarLeftVisible ?? true,
    sidebarRightVisible: raw.sidebarRightVisible ?? false,
    sidebarLeftWidth: raw.sidebarLeftWidth ?? 220,
    sidebarRightWidth: raw.sidebarRightWidth ?? 320,
    horizontalSplitRatio: raw.horizontalSplitRatio ?? 0.5,
    verticalSplitRatio: raw.verticalSplitRatio ?? 0.5,
    recentFiles: raw.recentFiles ?? [],
    capabilities: raw.capabilities ?? {},
    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
  };

  const es = useEditorStore.getState();
  es.setConfig(config);
  es.setFontSize(config.fontSize ?? 17);
  es.setConfigLoaded(true);

  // Restore scroll positions (A-9)
  useStore.getState().setScrollPositions(raw.scrollPositions ?? {});

  // Restore sidebar state
  if (config.sidebarLeftVisible !== undefined) {
    useStore.getState().setSidebarLeftVisible(config.sidebarLeftVisible);
  }
  if (config.sidebarRightVisible !== undefined) {
    useStore.getState().setSidebarRightVisible(config.sidebarRightVisible);
  }

  // Restore split ratios
  const splitRatios = {
    horizontal: config.horizontalSplitRatio,
    vertical: config.verticalSplitRatio,
  };
  useStore.getState().setSplitRatios(splitRatios);

  // Sync recent files
  if (config.recentFiles && config.recentFiles.length > 0) {
    const { recentFiles } = useStore.getState();
    if (recentFiles.length === 0) {
      // 整体赋值而不是逐条 addRecentFile：那个 API 是前置插入，逐条加会把
      // 持久化的「最近优先」顺序翻反——重启后门户 hero 会显示最旧的一份。
      // 直接放回数组也保住了原来的 openedAt（否则相对时间全变成「刚刚」）。
      useStore.setState({
        recentFiles: config.recentFiles
          .map((f) => ({
            path: f.path,
            title: f.title,
            openedAt: f.openedAt,
            excerpt: f.excerpt,
          }))
          .slice(0, 10),
      });
    }
  }

  applyTheme(config.theme ?? "system");
  applyReaderSkin(config.readerSkin ?? "paper");
  applyCapabilityConfig(raw.capabilities);

  // 阅读空间栏视图规格（layout-portal 6.1）：老配置缺字段 → 默认；重启后与所设严格相等
  const railSpec = normalizeRailViewSpec(raw.railViewSpec);
  useStore.setState({
    railViewSpec: railSpec,
    railLayout: railSpec.layout,
    railDensity: railSpec.density,
    railCardHeight:
      railSpec.cardHeight ??
      clampCardHeight(
        raw.railViewSpec?.cardHeight ??
          DEFAULT_RAIL_VIEW_SPEC.cardHeight ??
          DENSITY_HEIGHT.card,
      ),
  });

  // 悬浮预览窗开关（layout-portal 8.1）：老配置缺字段 → 默认；非法值归一化
  const previewSpec = normalizePreviewSettings(raw.previewSettings);
  useStore.setState({ previewSettings: previewSpec });

  // AI 视图规格（layout-portal 9.1）：最后应用，覆盖 rail/preview；缺字段回落
  const baseViewSpec: ViewSpec = {
    ...DEFAULT_VIEW_SPEC,
    railLayout: railSpec.layout,
    railDensity: railSpec.density,
    railCardHeight: railSpec.cardHeight ?? DEFAULT_VIEW_SPEC.railCardHeight,
    previewEnabled: previewSpec.enabled,
    iconLabel: config.iconLabel ?? DEFAULT_VIEW_SPEC.iconLabel,
  };
  useStore
    .getState()
    .setViewSpec(normalizeViewSpec(raw.aiViewSpec, baseViewSpec));

  // 布局树恢复放在配置生效之后：它依赖 tabs 记录与页签打开流程
  void restorePaneLayout(raw.paneLayout);
}

/** Re-read the effective config from Rust and apply it without touching content. */
export function reloadAppConfig(force = false): void {
  if (!isTauriEnv()) return;
  if (!force && Date.now() - lastLocalSaveAt < SAVE_ECHO_WINDOW_MS) return;
  invoke<RustAppConfig>("load_config")
    .then(applyRustConfig)
    .catch((e) => log.error("Config", "Failed to reload config", e));
}

export function useConfig() {
  const configLoaded = useEditorStore((s) => s.configLoaded);
  const configLoading = useEditorStore((s) => s.configLoading);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load config once on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const editorStore = useEditorStore.getState();
    editorStore.setConfigLoading(true);

    // 浏览器环境（dev server / 无 Tauri mock 的 e2e）无 invoke：直接落默认配置。
    if (!isTauriEnv()) {
      const es = useEditorStore.getState();
      es.setConfig({
        fontSize: 17,
        headingColors: undefined,
        readerFontSize: 17,
        readerWidth: 1080,
        readerSkin: "paper",
        ollamaEndpoint: "http://localhost:11434",
        openaiEndpoint: "https://api.openai.com",
        openaiModel: "gpt-4o-mini",
        translationProvider: "ollama",
        langPair: { source: "en", target: "zh-CN" },
        theme: "system",
        aiConfirmDensity: "session-silent",
        sidebarLeftVisible: true,
        sidebarRightVisible: false,
        sidebarLeftWidth: 220,
        sidebarRightWidth: 320,
        horizontalSplitRatio: 0.5,
        verticalSplitRatio: 0.5,
        recentFiles: [],
      });
      es.setConfigLoaded(true);
      es.setConfigLoading(false);
      applyTheme("system");
      applyReaderSkin("paper");
      return;
    }

    invoke<RustAppConfig>("load_config")
      .then(applyRustConfig)
      .catch((e) => {
        log.error("Config", "Failed to load config", e);
      })
      .finally(() => {
        useEditorStore.getState().setConfigLoading(false);
      });
  }, []); // Only run once on mount

  // Hot-apply config written by the app, the AI, or an external editor (C2).
  useEffect(() => {
    if (!isTauriEnv()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen("config-changed", () => reloadAppConfig())
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((e) => {
        log.error("Config", "Failed to subscribe config-changed", e);
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const saveConfig = useCallback(() => {
    void saveAppConfig();
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConfig();
    }, DEBOUNCE_MS);
  }, [saveConfig]);

  const setTheme = useCallback(
    (theme: Theme) => {
      useEditorStore.getState().setConfig({ theme });
      applyTheme(theme);
      scheduleSave();
    },
    [scheduleSave],
  );

  const setFontSize = useCallback(
    (size: number) => {
      useEditorStore.getState().setFontSize(size);
      document.documentElement.style.setProperty(
        "--editor-font-size",
        `${size}px`,
      );
      scheduleSave();
    },
    [scheduleSave],
  );

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const theme = useEditorStore.getState().config.theme;
      if (theme === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return {
    loadConfig: () => {}, // No-op: config loads on mount
    saveConfig,
    scheduleSave,
    setFontSize,
    setHeadingColors: (colors: AppConfig["headingColors"]) => {
      useEditorStore.getState().setHeadingColors(colors);
      scheduleSave();
    },
    setTheme,
    configLoaded,
    configLoading,
  };
}

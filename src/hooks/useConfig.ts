import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_HEADING_COLORS, useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import {
  normalizeDocPropertyVariant,
  useDocPropertyPanelStore,
} from "../stores/docPropertyPanel";
import { isTauriEnv } from "../utils/tauri";
import { log } from "../utils/log";
import type {
  AppConfig,
  HeadingColors,
  HeadingFonts,
  PropertyBarConfig,
  ScrollPosition,
  Theme,
} from "../types";
import { normalizePropertyBar } from "../lib/propertyBarConfig";
import { normalizeSearchPanel } from "../lib/searchPanelConfig";
import {
  normalizePropTemplates,
  type RawPropTemplate,
} from "../lib/propTemplates";
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
import { normalizePropAliasMap } from "../lib/frontmatter";
import {
  DEFAULT_VIEW_SPEC,
  normalizeViewSpec,
  type ViewSpec,
} from "../lib/aiViewSpec";
import { normalizeHeadingFonts } from "../lib/headingFonts";
import {
  getCareScaleItems,
  getSurfaceItems,
  subscribeSurfaces,
} from "../lib/dataSurfaces/store";

/** Snake-case config from Rust, mapped to camelCase in the store. */
interface RustAppConfig {
  fontSize: number | null;
  headingColors: Record<string, string> | null;
  headingFonts?: Partial<HeadingFonts> | null;
  readerFontSize: number | null;
  readerWidth: number | null;
  readerSkin: string | null;
  paneMode?: string | null;
  paneScale?: string | null;
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
  embedScrollPositions: Record<string, ScrollPosition> | null;
  capabilities?: Record<string, boolean> | null;
  rouletteSectors?: string[] | null;
  rouletteHotkey?: string | null;
  rouletteForm?: string | null;
  roulettePosition?: { x: number; y: number } | null;
  noticeDuration?: number | null;
  htmlToolbarItems?: string[] | null;
  paneLayout?: string | null;
  railPinHidden?: boolean | null;
  docPropertyVariant?: string | null;
  propertyBar?: {
    displayStyle?: string | null;
    displayDefault?: {
      preview?: string | null;
      edit?: string | null;
    } | null;
    newDocVisible?: boolean | null;
  } | null;
  searchPanel?: {
    defaultPos?: string | null;
  } | null;
  propTemplates?: RawPropTemplate[] | null;
  propAliasMap?: Record<string, string> | null;
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

/** 本地保存后的 echo 窗口：窗口内的外部写入事件延迟到窗口末合并补一次。 */
export const SAVE_ECHO_WINDOW_MS = 1500;
let lastLocalSaveAt = 0;

/**
 * AI 写类工具（bug #1484）：回合内一旦调用这些工具，回合结束必须 force 重载，
 * 否则写入会落进 echo 窗口被吞掉。放这里导出，避免 useAiEntry ↔ useConfig 循环依赖。
 */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  "patch_config",
  "patch_data_surface",
]);

/** echo 窗口内待补的 reload 调度状态（模块级，与 lastLocalSaveAt 同源）。 */
let pendingReload = false;
let pendingReloadTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingReload(): void {
  if (pendingReloadTimer) {
    clearTimeout(pendingReloadTimer);
    pendingReloadTimer = null;
  }
  pendingReload = false;
}

/** 测试隔离用：清空 echo 调度状态与 lastLocalSaveAt。 */
export function __resetEchoScheduler(): void {
  clearPendingReload();
  lastLocalSaveAt = 0;
}

/**
 * 配置重载守卫（bug #1494）：重载后的窗口内 scheduleSave 直接返回，
 * 确立不变量「配置重载不得触发保存」，否则写盘 → watcher → config-changed
 * → 重载会形成 ~2s 自持环，把 AI 写入的配置全量覆盖掉。
 */
const RELOAD_SAVE_GUARD_MS = 1000;
let lastRemoteApplyAt = 0;

/** 测试隔离用：清空重载守卫时间戳。 */
export function __resetRemoteApplyGuard(): void {
  lastRemoteApplyAt = 0;
}

/** 实际执行一次全量重载（force 越过 echo 窗口）。 */
function performReload(): void {
  invoke<RustAppConfig>("load_config")
    .then(applyRustConfig)
    .catch((e) => log.error("Config", "Failed to reload config", e));
}

/**
 * 外部（AI / 外部编辑器）写入后的重载调度（bug #1484）。
 *
 * 旧语义：命中 SAVE_ECHO_WINDOW_MS 就整包丢弃 → AI 密集写 + 一次前端保存后，
 * 后续 config-changed 全被吞，patch 提示成功但 UI 永不应用。
 * 新语义：窗口内不立即 reload，而是合并成一次 trailing 补 reload（窗口剩余时长
 * 到点后 force 执行）；窗口外保持立即 reload。
 *
 * @param now 当前时间戳（测试用 fake timers 注入；生产不传，走 Date.now()）
 */
export function scheduleExternalReload(now: number = Date.now()): void {
  if (!isTauriEnv()) return;
  const elapsed = now - lastLocalSaveAt;
  if (elapsed >= SAVE_ECHO_WINDOW_MS) {
    performReload();
    return;
  }
  if (pendingReload) return; // 窗口内多次事件合并
  pendingReload = true;
  pendingReloadTimer = setTimeout(() => {
    pendingReloadTimer = null;
    pendingReload = false;
    performReload();
  }, SAVE_ECHO_WINDOW_MS - elapsed);
}

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

/**
 * 把 paneMode 映射到 <html> 的 data-pane-mode（G-9）。选 <html> 是因为
 * .app-chrome（每格页头）与 .app-status-bar 都是它的后代，且 .immersive 类
 * 也挂在同一节点上——优先级 readingMode > paneMode 可用同一节点的类/属性
 * 选择器表达（.immersive 规则写在 [data-pane-mode] 之后即自然覆盖）。
 */
export function applyPaneMode(mode: string): void {
  const root = document.documentElement;
  const next =
    mode === "simple" || mode === "standard" || mode === "hardcore"
      ? mode
      : "standard";
  root.dataset.paneMode = next;
}

/**
 * 把 paneScale（选中 id）映射到 <html> 的 data-pane-scale 与缩放 CSS 变量
 * （CF-8 / DS-10）。倍率来自 care-scale 面：选中项 scale → `--pane-scale-factor`，
 * 仅因子 ≠ 1 时设 `data-pane-scale-active="true"`（CSS 据此施加 zoom）。
 * 缺省 / 未知 id / 面未加载 → 因子 1、不设 active；data-pane-scale 仍写选中 id。
 */
export function applyPaneScale(scale: string): void {
  const root = document.documentElement;
  const items = getCareScaleItems();
  const hit = items.find((item) => item.id === scale);
  const factor = hit ? hit.scale : 1;
  root.dataset.paneScale = scale;
  root.style.setProperty("--pane-scale-factor", String(factor));
  if (factor !== 1) {
    root.dataset.paneScaleActive = "true";
  } else {
    delete root.dataset.paneScaleActive;
  }
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
    headingFonts: es.config.headingFonts ?? null,
    readerFontSize: es.config.readerFontSize ?? null,
    readerWidth: es.config.readerWidth ?? null,
    readerSkin: es.config.readerSkin ?? null,
    paneMode: es.config.paneMode ?? null,
    paneScale: es.config.paneScale ?? null,
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
    embedScrollPositions: useStore.getState().embedScrollPositions ?? null,
    capabilities: serializeCapabilities(),
    rouletteSectors: es.config.rouletteSectors ?? null,
    rouletteHotkey: es.config.rouletteHotkey ?? null,
    rouletteForm: es.config.rouletteForm ?? null,
    roulettePosition: es.config.roulettePosition ?? null,
    noticeDuration: es.config.noticeDuration ?? null,
    htmlToolbarItems: es.config.htmlToolbarItems ?? null,
    // 读实时值：本次会话分裂/调整的比例要能持久化
    paneLayout: useStore.getState().paneLayoutJson(),
    railPinHidden: es.config.railPinHidden ?? null,
    docPropertyVariant: useDocPropertyPanelStore.getState().preference ?? null,
    propertyBar: es.config.propertyBar ?? null,
    searchPanel: es.config.searchPanel ?? null,
    propTemplates: es.config.propTemplates ?? null,
    propAliasMap: es.config.propAliasMap ?? null,
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

/** 文档属性面板样式桥接：设置改了显示样式立即换形态（字段内容与顺序不变）。 */
export function applyPropertyBarConfig(config: PropertyBarConfig): void {
  useDocPropertyPanelStore
    .getState()
    .setVariant(config.displayStyle === "dual" ? "B" : "A");
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

export function normalizeHtmlToolbarItems(
  raw: string[] | null | undefined,
): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const known = new Set(
    getSurfaceItems<{ id: string }>("html-toolbar").map((item) => item.id),
  );
  const out: string[] = [];
  for (const id of raw) {
    if (!known.has(id)) {
      log.warn("Config", `忽略未知工具条动作: ${id}`);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out.length > 0 ? out : null;
}

/**
 * 提示时长（ui-polish-batch15 4.1）：有限数、0.1–10、1 位小数才有效，
 * 其余（含缺失）一律回落 null，消费端按默认 3 秒处理。
 */
export function normalizeNoticeDuration(
  raw: number | null | undefined,
): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw < 0.1 || raw > 10) return null;
  if (Math.abs(raw * 10 - Math.round(raw * 10)) > 1e-9) return null;
  return raw;
}

/** 未配置「提示时长」时的回退延迟（ms）：tooltip 与页签信息窗共用（Q-缺陷4b 钉死 400ms）。 */
export const NOTICE_DURATION_FALLBACK_MS = 400;
const NOTICE_DURATION_MIN_MS = 100;
const NOTICE_DURATION_MAX_MS = 10_000;

/**
 * 提示延迟（ms）：取配置「提示时长」（秒），钳制 100–10000ms，未配置回退 400ms。
 * 悬停胶囊与页签信息窗共用同一回退值（单一来源）。
 */
export function noticeDurationMs(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds))
    return NOTICE_DURATION_FALLBACK_MS;
  const ms = Math.round(seconds * 1000);
  return Math.min(NOTICE_DURATION_MAX_MS, Math.max(NOTICE_DURATION_MIN_MS, ms));
}

/**
 * 把 Rust 配置映射到各 store 与 document。
 * 导出仅供测试与 reload 路径使用（模块外不直接调用）。
 */
export function applyRustConfig(raw: RustAppConfig): void {
  const { config: propertyBarConfig, warnings } = normalizePropertyBar(
    raw.propertyBar,
  );
  const { config: searchPanelConfig, warnings: searchPanelWarnings } =
    normalizeSearchPanel(raw.searchPanel);
  const { config: propTemplates, warnings: propTemplateWarnings } =
    normalizePropTemplates(raw.propTemplates);
  const { config: propAliasMap, warnings: propAliasWarnings } =
    normalizePropAliasMap(raw.propAliasMap);
  const configWarnings = [
    ...warnings,
    ...searchPanelWarnings,
    ...propTemplateWarnings,
    ...propAliasWarnings,
  ];
  if (configWarnings.length > 0) {
    log.warn("Config", configWarnings.join("；"));
  }
  const config: Partial<AppConfig> = {
    fontSize: raw.fontSize ?? 17,
    headingColors: raw.headingColors
      ? (raw.headingColors as unknown as AppConfig["headingColors"])
      : undefined,
    headingFonts: normalizeHeadingFonts(raw.headingFonts),
    readerFontSize: raw.readerFontSize ?? 17,
    readerWidth: raw.readerWidth ?? 1080,
    readerSkin: raw.readerSkin ?? "paper",
    paneMode:
      raw.paneMode === "simple" ||
      raw.paneMode === "standard" ||
      raw.paneMode === "hardcore"
        ? raw.paneMode
        : "standard",
    paneScale:
      raw.paneScale === "small" ||
      raw.paneScale === "medium" ||
      raw.paneScale === "large"
        ? raw.paneScale
        : "medium",
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
    rouletteHotkey: raw.rouletteHotkey ? raw.rouletteHotkey : null,
    rouletteForm:
      raw.rouletteForm === "hub" || raw.rouletteForm === "disk"
        ? raw.rouletteForm
        : null,
    roulettePosition:
      raw.roulettePosition &&
      Number.isFinite(raw.roulettePosition.x) &&
      Number.isFinite(raw.roulettePosition.y)
        ? { x: raw.roulettePosition.x, y: raw.roulettePosition.y }
        : null,
    noticeDuration: normalizeNoticeDuration(raw.noticeDuration),
    htmlToolbarItems: normalizeHtmlToolbarItems(raw.htmlToolbarItems),
    railPinHidden: raw.railPinHidden ?? false,
    propertyBar: propertyBarConfig,
    searchPanel: searchPanelConfig,
    propTemplates,
    propAliasMap,
  };

  const es = useEditorStore.getState();
  es.setConfig(config);
  // 桥接修复（bug #1482）：消费链（PreviewView / ContentArea）读顶层
  // s.headingColors，而 setConfig 只合并 config 子对象，重载路径必须同步
  // setHeadingColors，否则写盘成功的补丁在 UI 上永远不生效。
  es.setHeadingColors(
    (config.headingColors as HeadingColors | undefined) ??
      DEFAULT_HEADING_COLORS,
  );
  es.setFontSize(config.fontSize ?? 17);
  es.setConfigLoaded(true);
  useDocPropertyPanelStore.getState().applyLoadedPreference(
    normalizeDocPropertyVariant(raw.docPropertyVariant),
    // docPropertyVariant 是面板形态的唯一来源；displayStyle 为 legacy 镜像，
    // 不再驱动形态（否则历史遗留的 dual 会绕过显式偏好继续短路窄窗，#1147）。
    "A",
  );

  // Restore scroll positions (A-9)
  useStore.getState().setScrollPositions(raw.scrollPositions ?? {});
  // Restore embedded scroll freezes (D10 / B5b)
  useStore.getState().setEmbedScrollPositions(raw.embedScrollPositions ?? {});

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
  applyPaneMode(config.paneMode ?? "standard");
  applyPaneScale(config.paneScale ?? "medium");
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

  // bug #1494：标记本次为「配置重载」，窗口内的 scheduleSave 一律早退，
  // 断开「重载 → 保存 → watcher → 重载」的自持环。
  lastRemoteApplyAt = Date.now();
}

/**
 * Re-read the effective config from Rust and apply it without touching content.
 * 非 force 命中 echo 窗口时不再整包丢弃，改走 scheduleExternalReload 延迟兜底。
 */
export function reloadAppConfig(force = false): void {
  if (!isTauriEnv()) return;
  if (force) {
    clearPendingReload();
    performReload();
    return;
  }
  scheduleExternalReload();
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
        headingFonts: {},
        readerFontSize: 17,
        readerWidth: 1080,
        readerSkin: "paper",
        paneMode: "standard",
        paneScale: "medium",
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
        propTemplates: normalizePropTemplates(null).config,
        propAliasMap: normalizePropAliasMap(null).config,
      });
      es.setConfigLoaded(true);
      es.setConfigLoading(false);
      applyTheme("system");
      applyReaderSkin("paper");
      applyPaneMode("standard");
      applyPaneScale("medium");
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

  // 面集合异步到达 / 外部改动后重放缩放：首次 applyPaneScale 可能早于 care-scale
  // 面加载（竞态），surfaces-changed 到达时按当前选中 id 重解析一次（DS-2）。
  useEffect(() => {
    return subscribeSurfaces(() => {
      const id = useEditorStore.getState().config.paneScale ?? "medium";
      applyPaneScale(id);
    });
  }, []);

  const saveConfig = useCallback(() => {
    void saveAppConfig();
  }, []);

  const scheduleSave = useCallback(() => {
    // bug #1494：重载刚落地的窗口内不落盘——否则保存本身会重新点燃重载环。
    if (Date.now() - lastRemoteApplyAt < RELOAD_SAVE_GUARD_MS) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConfig();
    }, DEBOUNCE_MS);
  }, [saveConfig]);

  // AB 形态切换写全局偏好：偏好变化即落盘（首次加载的回填不算）。
  const docPreference = useDocPropertyPanelStore((s) => s.preference);
  const prefLoadedRef = useRef(false);
  useEffect(() => {
    if (!prefLoadedRef.current) {
      prefLoadedRef.current = true;
      return;
    }
    if (docPreference) scheduleSave();
  }, [docPreference, scheduleSave]);

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

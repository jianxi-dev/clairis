import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  listCapabilities,
  setCapabilityEnabled,
  type CapabilityId,
} from "../lib/capabilities";
import type { PreviewSettings } from "../lib/previewAnchor";
import {
  applyReaderSkin,
  applyTheme,
  reloadAppConfig,
  saveAppConfig,
} from "../hooks/useConfig";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { PROVIDERS } from "../lib/providers";
import { formatSnapshotTime } from "../hooks/useAiEntry";
import { isTauriEnv } from "../utils/tauri";
import Icon from "./Icon";
import { ICONS, ICON_NAMES } from "../ui/icons";
import {
  SHORTCUT_FAMILY_LABELS,
  SHORTCUT_FAMILY_ORDER,
  coreShortcuts,
  shortcutsByFamily,
} from "../lib/shortcuts";
import pkg from "../../package.json";

interface SettingsViewProps {
  onClose: () => void;
}

interface ExtensionPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  source: "builtin" | "ai" | "user";
  enabled: boolean;
  dir: string | null;
  skill: string;
}

const SOURCE_LABELS: Record<ExtensionPackage["source"], string> = {
  builtin: "内置",
  ai: "AI 生成",
  user: "用户导入",
};

const SECTIONS = [
  { id: "appearance", label: "外观" },
  { id: "editor", label: "编辑器" },
  { id: "files", label: "文件" },
  { id: "reading", label: "阅读空间" },
  { id: "grid", label: "网格概览" },
  { id: "preview", label: "悬浮预览" },
  { id: "ai", label: "AI 服务" },
  { id: "extensions", label: "扩展" },
  { id: "shortcuts", label: "快捷键" },
  { id: "data", label: "数据与备份" },
  { id: "about", label: "关于" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const RAIL_LAYOUT_OPTIONS = [
  { value: "stacked", label: "堆叠" },
  { value: "tabs", label: "标签页" },
] as const;

const RAIL_DENSITY_OPTIONS = [
  { value: "compact", label: "紧凑" },
  { value: "comfortable", label: "舒适" },
  { value: "card", label: "卡片" },
] as const;

const GRID_GROUP_OPTIONS = [
  { value: "time", label: "时间" },
  { value: "type", label: "类型" },
  { value: "theme", label: "主题" },
  { value: "none", label: "不分组" },
] as const;

const GRID_SORT_OPTIONS = [
  { value: "recent", label: "最近" },
  { value: "name", label: "名称" },
  { value: "type", label: "类型" },
] as const;

const GRID_MODE_OPTIONS = [
  { value: "grid", label: "网格" },
  { value: "list", label: "列表" },
] as const;

const PLANNED_PROVIDERS = [
  { id: "local-llm", label: "本地 LLM（Ollama）" },
  { id: "multi-agent", label: "多 agent 协同" },
] as const;

const THEME_OPTIONS = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "warm", label: "暖色" },
] as const;

const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;

const READER_WIDTH_PRESETS = [
  { value: 720, label: "紧凑" },
  { value: 960, label: "适中" },
  { value: 1080, label: "标准" },
  { value: 1200, label: "宽松" },
] as const;

/** 与 `lib/aiErrors.ts` 的校验区间一致（480–2400）。 */
const READER_WIDTH_MIN = 480;
const READER_WIDTH_MAX = 2400;
const READER_WIDTH_STEP = 20;

const READER_TONES = [
  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
  { id: "indigo", label: "靛青", swatch: "#2b4a7d" },
  { id: "moss", label: "松绿", swatch: "#2f5d3f" },
  { id: "clay", label: "赭石", swatch: "#8a4b2a" },
] as const;

const GRID_MODES = [
  { value: "hover", label: "悬停" },
  { value: "click", label: "点击" },
  { value: "off", label: "关闭" },
] as const;

function ExtensionsSection({
  tauriEnv,
  dropActive,
  setDropActive,
}: {
  tauriEnv: boolean;
  dropActive: boolean;
  setDropActive: (next: boolean) => void;
}) {
  const [packages, setPackages] = useState<ExtensionPackage[]>([]);
  const [loading, setLoading] = useState(tauriEnv);
  const [notice, setNotice] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiRunRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!tauriEnv) return;
    try {
      const list = await invoke<ExtensionPackage[]>("list_extension_packages");
      setPackages(Array.isArray(list) ? list : []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [tauriEnv]);

  useEffect(() => {
    if (!tauriEnv) return;
    let cancelled = false;
    invoke<ExtensionPackage[]>("list_extension_packages")
      .then((list) => {
        if (!cancelled) setPackages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tauriEnv]);

  const importPath = useCallback(
    async (target: string) => {
      if (!tauriEnv) return;
      try {
        await invoke<ExtensionPackage>("import_extension_package", {
          path: target,
        });
        await refresh();
        setNotice(`已导入扩展：${target}`);
      } catch {
        setNotice("导入失败，请重试。");
      }
    },
    [tauriEnv, refresh],
  );

  const importFrom = async (kind: "folder" | "zip") => {
    if (!tauriEnv) return;
    try {
      const picked = await invoke<string | null>("pick_extension_source", {
        kind,
      });
      if (!picked) return;
      await importPath(picked);
    } catch {
      setNotice("导入失败，请重试。");
    }
  };

  // Tauri webview 拖放：进入/悬停显示浮层，松开导入首个路径，离开或 Esc 收起。
  useEffect(() => {
    if (!tauriEnv) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        if (disposed) return;
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          const type = event.payload.type;
          if (type === "enter" || type === "over") {
            setDropActive(true);
            return;
          }
          if (type === "leave") {
            setDropActive(false);
            return;
          }
          if (type !== "drop") return;
          setDropActive(false);
          const path = event.payload.paths[0];
          if (path) void importPath(path);
        });
      } catch {
        /* 浏览器预览无 webview 拖放事件 */
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [tauriEnv, importPath, setDropActive]);

  const togglePackage = async (pkg: ExtensionPackage, enabled: boolean) => {
    try {
      await invoke("set_extension_package_enabled", {
        id: pkg.id,
        enabled,
      });
      await refresh();
    } catch {
      /* 开关失败时保留原状态 */
    }
  };

  const removePackage = async (id: string) => {
    try {
      await invoke("remove_extension_package", { id });
      await refresh();
      setNotice("已卸载扩展。");
    } catch {
      setNotice("卸载失败，请重试。");
    }
  };

  const exportPackage = async (id: string) => {
    try {
      const out = await invoke<string>("package_extension_package", { id });
      setNotice(`已导出：${out}`);
    } catch {
      setNotice("导出失败，请重试。");
    }
  };

  const openDir = async (dir: string | null) => {
    if (!dir) return;
    try {
      await invoke("reveal_in_finder", { path: dir });
    } catch {
      /* 打开文件夹失败静默 */
    }
  };

  const generateAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    const run = aiRunRef.current + 1;
    aiRunRef.current = run;
    setAiBusy(true);
    try {
      const generated = await invoke<ExtensionPackage>(
        "generate_extension_package",
        { prompt },
      );
      if (run !== aiRunRef.current) {
        try {
          await invoke("remove_extension_package", { id: generated.id });
        } catch {
          /* 取消后的清理失败不覆盖用户操作 */
        }
        return;
      }
      await refresh();
      setNotice("已生成扩展。");
    } catch {
      if (run === aiRunRef.current) setNotice("生成失败，请重试。");
    } finally {
      if (run === aiRunRef.current) setAiBusy(false);
    }
  };

  const cancelAi = () => {
    aiRunRef.current += 1;
    setAiBusy(false);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
          扩展
        </h2>
        <p className="mb-3 text-xs text-[var(--app-text-3)]">
          拖入含 manifest.json 与 SKILL.md 的文件夹或 .zip，导入后立即启用。
        </p>
        {!tauriEnv ? (
          <p
            className="text-sm text-[var(--app-text-3)]"
            data-testid="extensions-disabled-note"
          >
            扩展管理仅在桌面版可用，浏览器预览不可用。
          </p>
        ) : (
          <>
            <div
              data-testid="extensions-dropzone"
              className="rounded border border-dashed border-[var(--app-border)] px-4 py-6 text-center"
            >
              <p className="text-sm text-[var(--app-text-2)]">
                把扩展文件夹或 .zip 拖到这里
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  data-testid="extensions-import-folder"
                  onClick={() => void importFrom("folder")}
                  className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                >
                  选择文件夹
                </button>
                <button
                  type="button"
                  data-testid="extensions-import-zip"
                  onClick={() => void importFrom("zip")}
                  className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                >
                  选择 .zip
                </button>
              </div>
            </div>
            {dropActive && (
              <div
                data-testid="extensions-drop-overlay"
                className="mt-3 rounded border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-4 py-6 text-center text-sm text-[var(--app-accent)]"
              >
                松开以导入扩展，Esc 取消
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
          已安装
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--app-text-3)]">读取中…</p>
        ) : packages.length === 0 ? (
          <p
            className="text-sm text-[var(--app-text-3)]"
            data-testid="extensions-empty"
          >
            暂无扩展
          </p>
        ) : (
          <ul className="space-y-2">
            {packages.map((pkg) => {
              const isBuiltin = pkg.source === "builtin";
              return (
                <li
                  key={pkg.id}
                  data-testid="extension-row"
                  data-extension-id={pkg.id}
                  className="rounded border border-[var(--app-border)] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm text-[var(--app-text)]">
                          {pkg.name}
                        </span>
                        <span
                          data-testid="extension-source"
                          className="shrink-0 rounded bg-[var(--app-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--app-text-3)]"
                        >
                          {SOURCE_LABELS[pkg.source]}
                        </span>
                      </div>
                      {pkg.description && (
                        <p className="mt-0.5 truncate text-xs text-[var(--app-text-3)]">
                          {pkg.description}
                        </p>
                      )}
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="checkbox"
                        data-testid="extension-toggle"
                        checked={pkg.enabled}
                        disabled={isBuiltin}
                        onChange={(e) =>
                          void togglePackage(pkg, e.target.checked)
                        }
                      />
                      <span className="text-xs text-[var(--app-text-3)]">
                        {pkg.enabled ? "启用" : "停用"}
                      </span>
                    </label>
                    <button
                      type="button"
                      data-testid="extension-open"
                      disabled={isBuiltin || !pkg.dir}
                      onClick={() => void openDir(pkg.dir)}
                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      打开文件夹
                    </button>
                    <button
                      type="button"
                      data-testid="extension-export"
                      disabled={isBuiltin}
                      onClick={() => void exportPackage(pkg.id)}
                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      data-testid="extension-preview"
                      onClick={() =>
                        setPreviewId((cur) => (cur === pkg.id ? null : pkg.id))
                      }
                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                    >
                      {previewId === pkg.id ? "收起" : "预览"}
                    </button>
                    <button
                      type="button"
                      data-testid="extension-remove"
                      disabled={isBuiltin}
                      onClick={() => void removePackage(pkg.id)}
                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      卸载
                    </button>
                  </div>
                  {previewId === pkg.id && (
                    <pre
                      data-testid="extension-skill"
                      className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[var(--app-border)] bg-[var(--app-sunken)] p-2 text-xs text-[var(--app-text-2)]"
                    >
                      {pkg.skill}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {notice && (
          <p
            data-testid="extension-notice"
            className="mt-2 text-xs text-[var(--app-accent)]"
          >
            {notice}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
          AI 生成
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            data-testid="ai-extension-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="说出你要的功能"
            className="flex-1 rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
          />
          <button
            type="button"
            data-testid="ai-extension-generate"
            disabled={aiBusy || aiPrompt.trim() === ""}
            onClick={() => void generateAi()}
            className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            生成
          </button>
          {aiBusy && (
            <button
              type="button"
              data-testid="ai-extension-cancel"
              onClick={cancelAi}
              className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
            >
              取消
            </button>
          )}
        </div>
        {aiBusy && (
          <p
            data-testid="ai-extension-generating"
            className="mt-2 text-xs text-[var(--app-text-3)]"
          >
            生成中…
          </p>
        )}
      </section>
    </div>
  );
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const tauriEnv = isTauriEnv();
  const [active, setActive] = useState<SectionId>("appearance");
  const [capabilities, setCapabilities] = useState(listCapabilities);
  const [showFullShortcuts, setShowFullShortcuts] = useState(false);

  const theme = useEditorStore((s) => s.config.theme ?? "system");
  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
  const defaultSavePath = useEditorStore(
    (s) => s.config.defaultSavePath ?? null,
  );
  const fontSize = useEditorStore((s) => s.fontSize);
  const openaiEndpoint = useEditorStore((s) => s.config.openaiEndpoint ?? "");
  const openaiModel = useEditorStore((s) => s.config.openaiModel ?? "");
  const setConfig = useEditorStore((s) => s.setConfig);
  const setFontSize = useEditorStore((s) => s.setFontSize);

  const previewSettings = useStore((s) => s.previewSettings);
  const railLayout = useStore((s) => s.railLayout);
  const railDensity = useStore((s) => s.railDensity);
  const railCardHeight = useStore((s) => s.railCardHeight);
  const gridGroup = useStore((s) => s.gridGroup);
  const gridSort = useStore((s) => s.gridSort);
  const viewSpec = useStore((s) => s.viewSpec);
  const setRailLayout = useStore((s) => s.setRailLayout);
  const setRailDensity = useStore((s) => s.setRailDensity);
  const setRailCardHeight = useStore((s) => s.setRailCardHeight);
  const saveRailViewSpec = useStore((s) => s.saveRailViewSpec);
  const setGridGroup = useStore((s) => s.setGridGroup);
  const setGridSort = useStore((s) => s.setGridSort);
  const applyViewSpec = useStore((s) => s.applyViewSpec);

  const [selectedProvider, setSelectedProvider] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<
    "loading" | "configured" | "empty" | "error"
  >("loading");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyNotice, setKeyNotice] = useState("");

  const [dropActive, setDropActive] = useState(false);

  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState("");

  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const lastExplicitRef = useRef<"light" | "dark" | "warm">(
    theme === "system" ? "light" : theme,
  );
  const effectiveTheme: "light" | "dark" | "warm" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const followSystem = theme === "system";

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  useEffect(() => {
    if (active !== "ai" || !tauriEnv) return;
    let cancelled = false;
    invoke<string | null>("get_api_key", {
      service: "biaoyue",
      account: "openai",
    })
      .then((key) => {
        if (!cancelled) setKeyStatus(key ? "configured" : "empty");
      })
      .catch(() => {
        if (!cancelled) setKeyStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [active, tauriEnv]);

  useEffect(() => {
    if (active !== "data" || !tauriEnv) return;
    let cancelled = false;
    invoke<string[]>("list_config_snapshots")
      .then((names) => {
        if (!cancelled) setSnapshots([...names].reverse());
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      })
      .finally(() => {
        if (!cancelled) setSnapshotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, tauriEnv]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (dropActive) {
          setDropActive(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, dropActive]);

  const chooseTheme = (next: "light" | "dark" | "warm") => {
    lastExplicitRef.current = next;
    setConfig({ theme: next });
    applyTheme(next);
    void saveAppConfig();
  };

  const toggleFollowSystem = (next: boolean) => {
    if (next) {
      setConfig({ theme: "system" });
      applyTheme("system");
      void saveAppConfig();
    } else {
      chooseTheme(lastExplicitRef.current);
    }
  };

  const chooseFontSize = (size: number) => {
    setConfig({ readerFontSize: size });
    setFontSize(size);
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${size}px`,
    );
    void saveAppConfig();
  };

  const toggleCapability = (id: CapabilityId, enabled: boolean) => {
    setCapabilityEnabled(id, enabled);
    setCapabilities(listCapabilities());
    void saveAppConfig();
  };

  const updatePreview = (patch: Partial<PreviewSettings>) => {
    useStore.getState().setPreviewSettings(patch);
    void saveAppConfig();
  };

  const chooseEditorFontSize = (size: number) => {
    setFontSize(size);
    setConfig({ fontSize: size });
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${size}px`,
    );
    void saveAppConfig();
  };

  const chooseReaderWidth = (width: number) => {
    setConfig({ readerWidth: width });
    void saveAppConfig();
  };

  const chooseDefaultSavePath = async () => {
    try {
      const dir = await invoke<string>("pick_folder");
      if (!dir) return;
      setConfig({ defaultSavePath: dir });
      void saveAppConfig();
    } catch {
      // 用户取消选择：保持原值
    }
  };

  const clearDefaultSavePath = () => {
    setConfig({ defaultSavePath: null });
    void saveAppConfig();
  };

  // 拖动滑块时只更新配置（正文即时跟随）；松手/失焦再落盘，避免每一档
  // 都触发一次 saveAppConfig。
  const previewReaderWidth = (width: number) => {
    setConfig({ readerWidth: width });
  };

  const commitReaderWidth = () => {
    void saveAppConfig();
  };

  const chooseReaderSkin = (skin: string) => {
    setConfig({ readerSkin: skin });
    applyReaderSkin(skin);
    void saveAppConfig();
  };

  const chooseRailLayout = (layout: "stacked" | "tabs") => {
    setRailLayout(layout);
    saveRailViewSpec();
  };

  const chooseRailDensity = (density: "compact" | "comfortable" | "card") => {
    setRailDensity(density);
    saveRailViewSpec();
  };

  const changeRailCardHeight = (height: number) => {
    setRailCardHeight(height);
    saveRailViewSpec();
  };

  const chooseGridGroup = (group: "time" | "type" | "theme" | "none") => {
    setGridGroup(group);
    void saveAppConfig();
  };

  const chooseGridSort = (sort: "recent" | "name" | "type") => {
    setGridSort(sort);
    void saveAppConfig();
  };

  const chooseGridMode = (mode: "grid" | "list") => {
    applyViewSpec({ gridMode: mode });
    void saveAppConfig();
  };

  const selectProvider = (id: string) => {
    const preset = PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedProvider(id);
    setConfig({
      openaiEndpoint: preset.endpoint,
      openaiModel: preset.defaultModel,
    });
    void saveAppConfig();
  };

  const commitAiConfig = () => {
    void saveAppConfig();
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key || keyBusy) return;
    setKeyBusy(true);
    try {
      await invoke("set_api_key", {
        service: "biaoyue",
        account: "openai",
        key,
      });
      setKeyStatus("configured");
      setKeyInput("");
      setKeyNotice("已保存到系统钥匙串。");
    } catch {
      setKeyNotice("保存失败，请重试。");
    } finally {
      setKeyBusy(false);
    }
  };

  const deleteKey = async () => {
    if (keyBusy) return;
    setKeyBusy(true);
    try {
      await invoke("delete_api_key", {
        service: "biaoyue",
        account: "openai",
      });
      setKeyStatus("empty");
      setKeyInput("");
      setKeyNotice("已删除钥匙串中的密钥。");
    } catch {
      setKeyNotice("删除失败，请重试。");
    } finally {
      setKeyBusy(false);
    }
  };

  const confirmRestore = async () => {
    const name = pendingRestore;
    if (!name) return;
    setPendingRestore(null);
    try {
      await invoke("restore_config_snapshot", { name });
      reloadAppConfig();
      if (tauriEnv) {
        const names = await invoke<string[]>("list_config_snapshots");
        setSnapshots([...names].reverse());
      }
      setRestoreNotice("已恢复所选快照。");
    } catch {
      setRestoreNotice("恢复失败，请重试。");
    }
  };

  const cancelRestore = () => {
    setPendingRestore(null);
    setRestoreNotice("");
  };

  return (
    <div
      ref={rootRef}
      data-testid="settings-scene"
      tabIndex={-1}
      role="dialog"
      aria-label="设置"
      className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--app-bg)] outline-none"
    >
      <nav
        data-testid="settings-nav"
        className="flex min-h-0 w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-surface)] p-2"
      >
        {SECTIONS.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-testid="settings-nav-item"
              data-settings-nav={section.id}
              data-active={isActive ? "true" : "false"}
              onClick={() => {
                if (section.id === active) return;
                if (section.id === "ai" && tauriEnv) setKeyStatus("loading");
                if (section.id === "data" && tauriEnv)
                  setSnapshotsLoading(true);
                setActive(section.id);
              }}
              className={`rounded px-3 py-1.5 text-left text-sm ${
                isActive
                  ? "bg-[var(--app-accent-soft)] font-medium text-[var(--app-accent)]"
                  : "text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-base font-medium text-[var(--app-text-strong)]">
              设置
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-1.5 text-xs text-[var(--app-text-3)] hover:bg-[var(--app-sunken)]"
              aria-label="关闭设置"
            >
              关闭
            </button>
          </div>

          {active === "appearance" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  主题
                </h2>
                <div className="flex flex-wrap gap-2">
                  {THEME_OPTIONS.map((option) => {
                    const selected = effectiveTheme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`theme-option-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseTheme(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="follow-system"
                    checked={followSystem}
                    onChange={(e) => toggleFollowSystem(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-[var(--app-text)]">
                      跟随系统外观
                    </span>
                    <span className="block text-xs text-[var(--app-text-3)]">
                      默认开启：系统亮/暗对应浅色/深色
                    </span>
                  </span>
                </label>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  字号
                </h2>
                <div className="flex flex-wrap gap-2">
                  {FONT_SIZES.map((size) => {
                    const selected = readerFontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        data-testid={`font-size-${size}`}
                        aria-pressed={selected}
                        onClick={() => chooseFontSize(size)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section data-testid="settings-icons">
                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                  图标
                </h2>
                <p className="mb-2 text-xs text-[var(--app-text-3)]">
                  全站同一概念同一形状，尺寸只有 18（密集）与 24（主操作）两档。
                </p>
                <div
                  data-testid="icon-drawer"
                  className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded border border-[var(--app-border)] p-2"
                >
                  {ICON_NAMES.map((name) => (
                    <div
                      key={name}
                      data-icon-entry={name}
                      className="flex items-center gap-1.5 text-xs text-[var(--app-text-2)]"
                    >
                      <Icon name={name} size={18} />
                      <span className="truncate">{ICONS[name].label}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--app-text-3)]">
                        18/24
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === "editor" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  编辑器字号
                </h2>
                <div className="flex flex-wrap gap-2">
                  {FONT_SIZES.map((size) => {
                    const selected = fontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        data-testid={`editor-font-size-${size}`}
                        aria-pressed={selected}
                        onClick={() => chooseEditorFontSize(size)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                  高级
                </h2>
                <p className="mb-3 text-xs text-[var(--app-text-3)]">
                  能力默认全开；关闭后只是不再渲染，文档内容不受影响。
                </p>
                <ul className="space-y-2">
                  {capabilities.map((capability) => (
                    <li key={capability.id}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          data-testid={`capability-${capability.id}`}
                          checked={capability.enabled}
                          onChange={(e) =>
                            toggleCapability(capability.id, e.target.checked)
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm text-[var(--app-text)]">
                            {capability.label}
                          </span>
                          <span className="block text-xs text-[var(--app-text-3)]">
                            {capability.hint}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {active === "reading" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  行宽
                </h2>
                <div className="flex flex-wrap gap-2">
                  {READER_WIDTH_PRESETS.map((option) => {
                    const selected = readerWidth === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`reader-width-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseReaderWidth(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="range"
                    data-testid="reader-width-range"
                    min={READER_WIDTH_MIN}
                    max={READER_WIDTH_MAX}
                    step={READER_WIDTH_STEP}
                    value={Math.min(
                      READER_WIDTH_MAX,
                      Math.max(READER_WIDTH_MIN, readerWidth),
                    )}
                    aria-label="正文行宽"
                    onChange={(e) => previewReaderWidth(Number(e.target.value))}
                    onPointerUp={commitReaderWidth}
                    onKeyUp={commitReaderWidth}
                    onBlur={commitReaderWidth}
                    className="h-1 w-full cursor-pointer accent-[var(--app-accent)]"
                  />
                  <span
                    data-testid="reader-width-value"
                    className="w-16 shrink-0 text-right text-xs tabular-nums text-[var(--app-text-2)]"
                  >
                    {readerWidth}px
                  </span>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  配色
                </h2>
                <div className="flex flex-wrap gap-2">
                  {READER_TONES.map((tone) => {
                    const selected = readerSkin === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        data-testid={`reader-tone-${tone.id}`}
                        aria-pressed={selected}
                        onClick={() => chooseReaderSkin(tone.id)}
                        className={`flex items-center rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-black/15"
                          style={{ background: tone.swatch }}
                        />
                        {tone.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  默认布局
                </h2>
                <div className="flex flex-wrap gap-2">
                  {RAIL_LAYOUT_OPTIONS.map((option) => {
                    const selected = railLayout === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`rail-default-layout-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseRailLayout(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  默认密度
                </h2>
                <div className="flex flex-wrap gap-2">
                  {RAIL_DENSITY_OPTIONS.map((option) => {
                    const selected = railDensity === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`rail-default-density-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseRailDensity(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  卡片高度
                </h2>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={88}
                    max={160}
                    step={1}
                    data-testid="rail-default-card-height"
                    value={railCardHeight}
                    disabled={railDensity !== "card"}
                    onChange={(e) =>
                      changeRailCardHeight(Number(e.target.value))
                    }
                    className="w-56"
                  />
                  <span className="text-sm text-[var(--app-text-2)]">
                    {railCardHeight}px
                  </span>
                </div>
                {railDensity !== "card" && (
                  <p className="mt-1 text-xs text-[var(--app-text-3)]">
                    仅在卡片密度下生效
                  </p>
                )}
              </section>
            </div>
          )}

          {active === "grid" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  默认分组
                </h2>
                <div className="flex flex-wrap gap-2">
                  {GRID_GROUP_OPTIONS.map((option) => {
                    const selected = gridGroup === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`grid-default-group-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseGridGroup(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  默认排序
                </h2>
                <div className="flex flex-wrap gap-2">
                  {GRID_SORT_OPTIONS.map((option) => {
                    const selected = gridSort === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`grid-default-sort-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseGridSort(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  视图模式
                </h2>
                <div className="flex flex-wrap gap-2">
                  {GRID_MODE_OPTIONS.map((option) => {
                    const selected = viewSpec.gridMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`grid-default-mode-${option.value}`}
                        aria-pressed={selected}
                        onClick={() => chooseGridMode(option.value)}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {active === "ai" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                  服务提供方
                </h2>
                <p className="mb-2 text-xs text-[var(--app-text-3)]">
                  选择提供方后会填入其默认接口与模型，可再手动调整。
                </p>
                <ul className="space-y-1.5">
                  {PROVIDERS.map((provider) => {
                    const selected = selectedProvider === provider.id;
                    return (
                      <li key={provider.id}>
                        <button
                          type="button"
                          data-testid="ai-provider"
                          data-provider={provider.id}
                          aria-pressed={selected}
                          onClick={() => selectProvider(provider.id)}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
                            selected
                              ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                              : "border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-sunken)]"
                          }`}
                        >
                          <span>{provider.label}</span>
                          {selected && (
                            <span className="text-xs text-[var(--app-accent)]">
                              当前
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {PLANNED_PROVIDERS.map((provider) => (
                    <li
                      key={provider.id}
                      data-testid="ai-planned"
                      className="flex items-center justify-between rounded border border-dashed border-[var(--app-border)] px-3 py-2"
                    >
                      <span className="text-sm text-[var(--app-text-3)]">
                        {provider.label}
                      </span>
                      <span className="rounded bg-[var(--app-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--app-text-3)]">
                        规划中
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  接口与模型
                </h2>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--app-text-3)]">
                      接口地址
                    </span>
                    <input
                      type="text"
                      data-testid="ai-endpoint-input"
                      value={openaiEndpoint}
                      onChange={(e) =>
                        setConfig({ openaiEndpoint: e.target.value })
                      }
                      onBlur={commitAiConfig}
                      className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--app-text-3)]">
                      模型
                    </span>
                    <input
                      type="text"
                      data-testid="ai-model-input"
                      value={openaiModel}
                      onChange={(e) =>
                        setConfig({ openaiModel: e.target.value })
                      }
                      onBlur={commitAiConfig}
                      className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  API 密钥
                </h2>
                {!tauriEnv ? (
                  <p
                    className="text-sm text-[var(--app-text-3)]"
                    data-testid="ai-key-note"
                  >
                    密钥仅保存在桌面版的系统钥匙串中，浏览器预览不可用。
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        data-testid="ai-key-input"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      />
                      <button
                        type="button"
                        data-testid="ai-key-save"
                        disabled={keyBusy || keyInput.trim() === ""}
                        onClick={() => void saveKey()}
                        className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        data-testid="ai-key-delete"
                        disabled={keyBusy || keyStatus !== "configured"}
                        onClick={() => void deleteKey()}
                        className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                    <p
                      className="text-xs text-[var(--app-text-3)]"
                      data-testid="ai-key-status"
                    >
                      {keyStatus === "configured"
                        ? "已配置（密钥仅保存在系统钥匙串）"
                        : keyStatus === "empty"
                          ? "未配置"
                          : keyStatus === "loading"
                            ? "读取中…"
                            : "无法读取钥匙串状态"}
                    </p>
                    {keyNotice && (
                      <p className="text-xs text-[var(--app-accent)]">
                        {keyNotice}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {active === "files" && (
            <section>
              <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                新建文档
              </h2>
              <p className="mb-2 text-xs text-[var(--app-text-3)]">
                首次保存新建文档时，保存对话框将以此目录为初始位置。
              </p>
              <div className="flex items-center justify-between gap-2 rounded border border-[var(--app-border)] px-3 py-2">
                <span
                  className="truncate text-sm text-[var(--app-text)]"
                  data-testid="default-save-path"
                  title={defaultSavePath ?? ""}
                >
                  {defaultSavePath || "未设置（使用系统默认位置）"}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    data-testid="default-save-pick"
                    className="rounded border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-sunken)]"
                    onClick={() => void chooseDefaultSavePath()}
                  >
                    选择…
                  </button>
                  <button
                    type="button"
                    data-testid="default-save-clear"
                    className="rounded border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!defaultSavePath}
                    onClick={clearDefaultSavePath}
                  >
                    清除
                  </button>
                </span>
              </div>
            </section>
          )}

          {active === "data" && (
            <section>
              <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
                配置快照
              </h2>
              <p className="mb-2 text-xs text-[var(--app-text-3)]">
                每次保存配置前自动留存一份，可恢复到任一历史状态。
              </p>
              {snapshotsLoading ? (
                <p className="text-sm text-[var(--app-text-3)]">读取中…</p>
              ) : snapshots.length === 0 ? (
                <p
                  className="text-sm text-[var(--app-text-3)]"
                  data-testid="snapshot-empty"
                >
                  暂无快照
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {snapshots.map((name) => (
                    <li
                      key={name}
                      data-testid="snapshot-item"
                      data-snapshot-name={name}
                    >
                      <div className="flex items-center justify-between gap-2 rounded border border-[var(--app-border)] px-3 py-2">
                        <span className="text-sm text-[var(--app-text)]">
                          {formatSnapshotTime(name)}
                        </span>
                        <button
                          type="button"
                          data-testid="snapshot-restore"
                          onClick={() => {
                            setPendingRestore(name);
                            setRestoreNotice("");
                          }}
                          className="rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        >
                          恢复
                        </button>
                      </div>
                      {pendingRestore === name && (
                        <div
                          data-testid="snapshot-confirm"
                          className="mt-1 flex items-center gap-2 rounded border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-3 py-2"
                        >
                          <span className="text-xs text-[var(--app-text)]">
                            确认恢复到此快照？当前配置会先自动留存。
                          </span>
                          <button
                            type="button"
                            data-testid="snapshot-confirm-ok"
                            onClick={() => void confirmRestore()}
                            className="rounded border border-[var(--app-accent)] px-2 py-1 text-xs text-[var(--app-accent)] hover:bg-[var(--app-sunken)]"
                          >
                            确认恢复
                          </button>
                          <button
                            type="button"
                            data-testid="snapshot-cancel"
                            onClick={cancelRestore}
                            className="rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {restoreNotice && (
                <p className="mt-2 text-xs text-[var(--app-accent)]">
                  {restoreNotice}
                </p>
              )}
            </section>
          )}

          {active === "about" && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                关于
              </h2>
              <div className="rounded border border-[var(--app-border)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--app-text-strong)]">
                  标月 Biaoyue
                </p>
                <p className="mt-1 text-xs text-[var(--app-text-3)]">
                  桌面 Markdown 阅读与编辑器，离线优先，数据保存在本机。
                </p>
                <p className="mt-2 text-xs text-[var(--app-text-3)]">
                  版本 <span data-testid="about-version">v{pkg.version}</span>
                </p>
              </div>
            </section>
          )}

          {active === "extensions" && (
            <ExtensionsSection
              tauriEnv={tauriEnv}
              dropActive={dropActive}
              setDropActive={setDropActive}
            />
          )}

          {active === "preview" && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  阅读空间
                </h2>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="preview-rail-hover"
                    checked={previewSettings.railHover}
                    onChange={(e) =>
                      updatePreview({ railHover: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-[var(--app-text)]">
                    悬停行显示预览
                  </span>
                </label>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                  网格预览模式
                </h2>
                <div className="flex flex-wrap gap-2">
                  {GRID_MODES.map((mode) => {
                    const selected = previewSettings.gridMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        data-testid={`grid-mode-${mode.value}`}
                        aria-pressed={selected}
                        onClick={() => updatePreview({ gridMode: mode.value })}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {active === "shortcuts" && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
                核心快捷键
              </h2>
              <ul className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
                {coreShortcuts().map((shortcut) => (
                  <li
                    key={shortcut.id}
                    data-testid="shortcut-core"
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-[var(--app-text)]">
                      {shortcut.label}
                    </span>
                    <kbd className="rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-2 py-0.5 text-xs text-[var(--app-text-2)]">
                      {shortcut.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="shortcuts-full-toggle"
                onClick={() => setShowFullShortcuts((v) => !v)}
                className="mt-3 rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
              >
                {showFullShortcuts ? "收起完整列表" : "查看完整列表"}
              </button>
              {showFullShortcuts && (
                <div data-testid="shortcuts-full" className="mt-4 space-y-4">
                  {SHORTCUT_FAMILY_ORDER.map((family) => {
                    const items = shortcutsByFamily(family);
                    if (items.length === 0) return null;
                    return (
                      <div key={family}>
                        <h3 className="mb-1 text-xs font-medium text-[var(--app-text-3)]">
                          {SHORTCUT_FAMILY_LABELS[family]}
                        </h3>
                        <ul className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
                          {items.map((shortcut) => (
                            <li
                              key={shortcut.id}
                              data-testid="shortcut-full-row"
                              className="flex items-center justify-between py-2"
                            >
                              <span className="text-sm text-[var(--app-text)]">
                                {shortcut.label}
                              </span>
                              <kbd className="rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-2 py-0.5 text-xs text-[var(--app-text-2)]">
                                {shortcut.keys}
                              </kbd>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

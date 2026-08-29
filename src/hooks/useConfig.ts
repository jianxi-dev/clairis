import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { log } from "../utils/log";
import type { AppConfig, ScrollPosition, Theme } from "../types";

/** Snake-case config from Rust, mapped to camelCase in the store. */
interface RustAppConfig {
  fontSize: number | null;
  headingColors: Record<string, string> | null;
  readerFontSize: number | null;
  readerWidth: number | null;
  readerSkin: string | null;
  ollamaEndpoint: string | null;
  openaiEndpoint: string | null;
  openaiModel: string | null;
  translationProvider: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  theme: string | null;
  sidebarLeftVisible: boolean | null;
  sidebarRightVisible: boolean | null;
  sidebarLeftWidth: number | null;
  sidebarRightWidth: number | null;
  horizontalSplitRatio: number | null;
  verticalSplitRatio: number | null;
  recentFiles: Array<{ path: string; title: string; openedAt: string }> | null;
  scrollPositions: Record<string, ScrollPosition> | null;
}

const DEBOUNCE_MS = 500;

/** Apply theme to <html> element. */
export function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (!root) return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/** Apply theme to <html> element. */
export function applyReaderSkin(skin: string): void {
  document.documentElement.dataset.skin = skin || "paper";
}

/** Persist the current editor + app config (module-level, callable outside hooks). */
export async function saveAppConfig(): Promise<void> {
  const es = useEditorStore.getState();
  const config: RustAppConfig = {
    fontSize: es.fontSize,
    headingColors: es.headingColors
      ? ({ ...es.headingColors } as unknown as Record<string, string>)
      : null,
    readerFontSize: es.config.readerFontSize ?? null,
    readerWidth: es.config.readerWidth ?? null,
    readerSkin: es.config.readerSkin ?? null,
    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
    openaiEndpoint: es.config.openaiEndpoint ?? null,
    openaiModel: es.config.openaiModel ?? null,
    translationProvider: es.config.translationProvider ?? null,
    sourceLang: es.config.langPair?.source ?? null,
    targetLang: es.config.langPair?.target ?? null,
    theme: es.config.theme ?? null,
    sidebarLeftVisible: es.config.sidebarLeftVisible ?? null,
    sidebarRightVisible: es.config.sidebarRightVisible ?? null,
    sidebarLeftWidth: es.config.sidebarLeftWidth ?? null,
    sidebarRightWidth: es.config.sidebarRightWidth ?? null,
    horizontalSplitRatio: es.config.horizontalSplitRatio ?? null,
    verticalSplitRatio: es.config.verticalSplitRatio ?? null,
    recentFiles: es.config.recentFiles ?? null,
    scrollPositions: useStore.getState().scrollPositions ?? null,
  };
  try {
    await invoke("save_config", { config });
  } catch (e) {
    log.error("Config", "Failed to save config", e);
  }
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

    invoke<RustAppConfig>("load_config")
      .then((raw) => {
        const config: Partial<AppConfig> = {
          fontSize: raw.fontSize ?? 17,
          headingColors: raw.headingColors
            ? (raw.headingColors as unknown as AppConfig["headingColors"])
            : undefined,
          readerFontSize: raw.readerFontSize ?? 17,
          readerWidth: raw.readerWidth ?? 1080,
          readerSkin: raw.readerSkin ?? "paper",
          ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
          openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
          openaiModel: raw.openaiModel ?? "gpt-4o-mini",
          translationProvider:
            (raw.translationProvider as AppConfig["translationProvider"]) ??
            "ollama",
          langPair: {
            source: raw.sourceLang ?? "en",
            target: raw.targetLang ?? "zh-CN",
          },
          theme: (raw.theme as Theme) ?? "system",
          sidebarLeftVisible: raw.sidebarLeftVisible ?? true,
          sidebarRightVisible: raw.sidebarRightVisible ?? false,
          sidebarLeftWidth: raw.sidebarLeftWidth ?? 220,
          sidebarRightWidth: raw.sidebarRightWidth ?? 320,
          horizontalSplitRatio: raw.horizontalSplitRatio ?? 0.5,
          verticalSplitRatio: raw.verticalSplitRatio ?? 0.5,
          recentFiles: raw.recentFiles ?? [],
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
          useStore
            .getState()
            .setSidebarRightVisible(config.sidebarRightVisible);
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
            config.recentFiles.forEach((f) =>
              useStore.getState().addRecentFile(f.path, f.title),
            );
          }
        }

        applyTheme(config.theme ?? "system");
        applyReaderSkin(config.readerSkin ?? "paper");
      })
      .catch((e) => {
        log.error("Config", "Failed to load config", e);
      })
      .finally(() => {
        useEditorStore.getState().setConfigLoading(false);
      });
  }, []); // Only run once on mount

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

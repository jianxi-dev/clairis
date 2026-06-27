import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../stores/editorStore";
import type { HeadingColors } from "../types";

interface AppConfig {
  font_size: number | null;
  heading_colors: Record<string, string> | null;
  ollama_endpoint: string | null;
  openai_endpoint: string | null;
  openai_model: string | null;
  translation_provider: string | null;
  source_lang: string | null;
  target_lang: string | null;
}

export function useConfig() {
  const store = useEditorStore();

  const loadConfig = useCallback(async () => {
    store.setConfigLoading(true);
    try {
      // Use generic invoke - Rust backend handles
      // This is a placeholder for the actual Rust command
      // const config = await invoke<AppConfig>("load_config");
      // store.setConfig(config);
      // store.setFontSize(config.font_size ?? 16);
      store.setConfigLoaded(true);
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      store.setConfigLoading(false);
    }
  }, [store]);

  const saveConfig = useCallback(async () => {
    try {
      // const config = {
      //   font_size: store.fontSize,
      //   heading_colors: store.headingColors,
      //   ...
      // };
      // await invoke("save_config", { config });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }, [store]);

  const setFontSize = useCallback(
    (size: number) => {
      store.setFontSize(size);
      document.documentElement.style.setProperty(
        "--editor-font-size",
        `${size}px`,
      );
    },
    [store],
  );

  const setHeadingColors = useCallback(
    (colors: HeadingColors) => {
      store.setHeadingColors(colors);
    },
    [store],
  );

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    loadConfig,
    saveConfig,
    setFontSize,
    setHeadingColors,
    configLoaded: store.configLoaded,
    configLoading: store.configLoading,
  };
}

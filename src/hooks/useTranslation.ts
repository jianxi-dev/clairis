import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../stores/index";
import type { TranslationChunk } from "../types";

interface UseTranslationReturn {
  translated: string;
  loading: boolean;
  error: string | null;
  translate: () => Promise<void>;
  stop: () => void;
}

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;

export function useTranslation(
  sourceLang = "en",
  targetLang = "zh-CN",
): UseTranslationReturn {
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const activeTab = useStore((s) =>
    s.activeTabId ? s.tabs[s.activeTabId] : null,
  );

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  // Listen for translation chunks
  const startListening = useCallback(async () => {
    if (!isTauri) return;

    unlistenRef.current?.();
    unlistenRef.current = await listen<TranslationChunk>(
      "translation-chunk",
      (event) => {
        const chunk = event.payload;
        if (chunk.done) {
          setLoading(false);
        } else if (chunk.error) {
          setError(chunk.error);
          setLoading(false);
        } else {
          setTranslated((prev) => prev + chunk.text);
        }
      },
    );
  }, []);

  const translate = useCallback(async () => {
    if (!activeTab || !activeTab.content.trim()) return;
    if (!isTauri) {
      setError("翻译仅在 Tauri 桌面环境中可用");
      return;
    }

    setLoading(true);
    setError(null);
    setTranslated("");
    await startListening();

    try {
      await invoke("translate_text", {
        request: {
          text: activeTab.content,
          source_lang: sourceLang,
          target_lang: targetLang,
          provider: "ollama",
        },
      });
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, [activeTab?.content, sourceLang, targetLang, startListening]);

  const stop = useCallback(() => {
    if (!isTauri) return;
    invoke("stop_translation").catch(() => {});
    setLoading(false);
  }, []);

  return { translated, loading, error, translate, stop };
}

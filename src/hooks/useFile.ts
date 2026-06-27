import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../stores/editorStore";

interface FileResult {
  content: string;
  path: string;
  file_size: number;
}

interface SaveResult {
  path: string;
}

const SOURCE_MODE_LIMIT = 500 * 1024;
const SOURCE_READ_ONLY_LIMIT = 2 * 1024 * 1024;

export function useFile() {
  const store = useEditorStore();

  const openFile = useCallback(async () => {
    try {
      const result = await invoke<FileResult>("open_file");
      const fileName = result.path.split("/").pop() || result.path;

      store.setFilePath(result.path, fileName);
      store.setFileSize(result.file_size);
      store.setContent(result.content);
      store.incContentVersion();

      // Auto-switch editor mode based on file size
      if (result.file_size > SOURCE_READ_ONLY_LIMIT) {
        store.setEditorMode("sourceReadOnly");
      } else if (result.file_size > SOURCE_MODE_LIMIT) {
        store.setEditorMode("source");
      } else {
        store.setEditorMode("wysiwyg");
      }
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        console.error("Failed to open file:", e);
      }
    }
  }, [store]);

  const saveFile = useCallback(async () => {
    if (!store.filePath) {
      return saveAsFile();
    }
    try {
      await invoke<SaveResult>("save_file", {
        path: store.filePath,
        content: store.content,
      });
      store.setDirty(false);
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  }, [store]);

  const saveAsFile = useCallback(async () => {
    try {
      const result = await invoke<SaveResult>("save_as_file", {
        content: store.content,
      });
      const fileName = result.path.split("/").pop() || result.path;
      store.setFilePath(result.path, fileName);
      store.setDirty(false);
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        console.error("Failed to save file as:", e);
      }
    }
  }, [store]);

  const checkDirty = useCallback((): boolean => {
    return store.dirty;
  }, [store.dirty]);

  return {
    openFile,
    saveFile,
    saveAsFile,
    checkDirty,
  };
}

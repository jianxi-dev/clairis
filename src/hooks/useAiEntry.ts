import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "../utils/tauri";
import { useEditorStore } from "../stores/editorStore";
import { reloadAppConfig } from "./useConfig";
import { humanizeAgentError } from "../lib/aiErrors";

export interface AiEntryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  changed?: boolean;
}

export interface AiSnapshotInfo {
  name: string;
  time: Date | null;
}

const UNDO_VISIBLE_MS = 3000;
const SNAPSHOT_LIMIT = 10;

export function parseSnapshotTime(name: string): Date | null {
  const m = /^settings-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(
    name,
  );
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatSnapshotTime(name: string): string {
  const d = parseSnapshotTime(name);
  if (!d) return name;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (sameDay(d, today)) return `今天 ${hm}`;
  if (sameDay(d, yesterday)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

interface AgentReply {
  text: string;
  turns: number;
  tool_calls: string[];
}

interface AiEntryState {
  overlayOpen: boolean;
  input: string;
  submitting: boolean;
  messages: AiEntryMessage[];
  pendingConfirm: string | null;
  undoVisible: boolean;
  undoTarget: string | null;
  undoPreConfig: unknown | null;
  panelOpen: boolean;
  snapshots: AiSnapshotInfo[];
  snapshotsLoading: boolean;

  openOverlay: () => void;
  closeOverlay: () => void;
  toggleOverlay: () => void;
  setInput: (value: string) => void;
  requestSubmit: (text: string) => void;
  confirmPendingSubmit: () => void;
  cancelPendingSubmit: () => void;
  runUndo: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  loadSnapshots: () => Promise<void>;
  restoreSnapshot: (name: string) => Promise<void>;
  reshowUndo: () => void;
  undoFadeLater: () => void;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `ai-${Date.now()}-${_idCounter}`;
}

let undoTimer: ReturnType<typeof setTimeout> | null = null;
function clearUndoTimer(): void {
  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
}

export const useAiEntryStore = create<AiEntryState>()((set, get) => {
  function submitCore(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || get().submitting) return;
    set({
      messages: [
        ...get().messages,
        { id: nextId(), role: "user", content: trimmed },
      ],
      input: "",
      submitting: true,
    });

    if (!isTauriEnv()) {
      set({
        submitting: false,
        messages: [
          ...get().messages,
          {
            id: nextId(),
            role: "assistant",
            content: "AI 功能需要在桌面版中使用。",
            isError: true,
          },
        ],
      });
      return;
    }

    void (async () => {
      try {
        const before = await invoke<string[]>("list_config_snapshots");
        const preConfig = await invoke("load_config");
        const beforeSnapshot =
          before.length > 0 ? before[before.length - 1] : null;

        const reply = await invoke<AgentReply>("run_agent_turn", {
          messages: [{ role: "user", content: trimmed }],
        });

        const after = await invoke<string[]>("list_config_snapshots");
        const changed = after.length > before.length;

        if (changed) {
          reloadAppConfig();
          set({
            undoTarget: beforeSnapshot,
            undoPreConfig: preConfig,
            undoVisible: true,
          });
          clearUndoTimer();
          undoTimer = setTimeout(
            () => set({ undoVisible: false }),
            UNDO_VISIBLE_MS,
          );
        }

        set({
          submitting: false,
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: reply.text || "已完成。",
              changed,
            },
          ],
        });
      } catch (err) {
        set({
          submitting: false,
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: humanizeAgentError(err),
              isError: true,
            },
          ],
        });
      }
    })();
  }

  return {
    overlayOpen: false,
    input: "",
    submitting: false,
    messages: [],
    pendingConfirm: null,
    undoVisible: false,
    undoTarget: null,
    undoPreConfig: null,
    panelOpen: false,
    snapshots: [],
    snapshotsLoading: false,

    openOverlay: () => set({ overlayOpen: true }),
    closeOverlay: () =>
      set({ overlayOpen: false, input: "", pendingConfirm: null }),
    toggleOverlay: () =>
      set((s) => ({
        overlayOpen: !s.overlayOpen,
        input: s.overlayOpen ? "" : s.input,
        pendingConfirm: null,
      })),

    setInput: (value) => set({ input: value }),

    requestSubmit: (text) => {
      const trimmed = text.trim();
      if (!trimmed || get().submitting) return;
      const density =
        useEditorStore.getState().config.aiConfirmDensity ?? "session-silent";
      if (density === "always") {
        set({ pendingConfirm: trimmed });
        return;
      }
      submitCore(trimmed);
    },

    confirmPendingSubmit: () => {
      const pending = get().pendingConfirm;
      if (!pending) return;
      set({ pendingConfirm: null });
      submitCore(pending);
    },

    cancelPendingSubmit: () => set({ pendingConfirm: null }),

    runUndo: async () => {
      const { undoTarget, undoPreConfig } = get();
      if (!undoTarget && !undoPreConfig) return;
      clearUndoTimer();
      set({ undoVisible: false, undoTarget: null, undoPreConfig: null });
      try {
        if (undoTarget) {
          await invoke("restore_config_snapshot", { name: undoTarget });
        } else if (undoPreConfig) {
          await invoke("save_config", { config: undoPreConfig });
        }
        reloadAppConfig();
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: undoTarget ? "已恢复到改动前。" : "已恢复默认。",
            },
          ],
        });
      } catch (err) {
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: humanizeAgentError(err),
              isError: true,
            },
          ],
        });
      }
    },

    openPanel: () => {
      set({ panelOpen: true });
      void get().loadSnapshots();
    },
    closePanel: () => set({ panelOpen: false }),

    loadSnapshots: async () => {
      set({ snapshotsLoading: true });
      try {
        const names = await invoke<string[]>("list_config_snapshots");
        const infos = names
          .slice(-SNAPSHOT_LIMIT)
          .reverse()
          .map((name) => ({ name, time: parseSnapshotTime(name) }));
        set({ snapshots: infos, snapshotsLoading: false });
      } catch {
        set({ snapshotsLoading: false });
      }
    },

    restoreSnapshot: async (name) => {
      try {
        await invoke("restore_config_snapshot", { name });
        reloadAppConfig();
        await get().loadSnapshots();
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: "已恢复到选中的历史状态。",
            },
          ],
        });
      } catch (err) {
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: humanizeAgentError(err),
              isError: true,
            },
          ],
        });
      }
    },

    reshowUndo: () => {
      if (!get().undoTarget && !get().undoPreConfig) return;
      clearUndoTimer();
      set({ undoVisible: true });
    },
    undoFadeLater: () => {
      if (!get().undoVisible) return;
      clearUndoTimer();
      undoTimer = setTimeout(
        () => set({ undoVisible: false }),
        UNDO_VISIBLE_MS,
      );
    },
  };
});

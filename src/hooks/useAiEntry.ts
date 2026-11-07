import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "../utils/tauri";
import { useEditorStore } from "../stores/editorStore";
import { useStore, setAiPaneClosedHandler } from "../stores/index";
import { reloadAppConfig, saveAppConfig } from "./useConfig";
import { humanizeAgentError } from "../lib/aiErrors";
import {
  applySpec,
  humanizeChange,
  presetById,
  viewSpecEquals,
  type ViewSpec,
} from "../lib/aiViewSpec";

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

/** AI 宿主形态：右下角小窗 / 停靠为右侧分栏窗格。 */
export type AiForm = "bubble" | "docked";

export interface BubbleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 待确认的改动。`summary` 是人话描述（预设改动确定可知；自由对话暂为空，
 * 由确认卡给出一句通用说明）。
 */
export interface AiPendingConfirm {
  text: string;
  kind: string;
  summary: string;
}

const UNDO_VISIBLE_MS = 3000;
const SNAPSHOT_LIMIT = 10;

/**
 * session-silent 密度下本会话已确认过的改动类别。同类第二次起静默执行。
 * 模块级、不持久化；只由 `__resetAiSession`（测试/整体重置）清空。
 */
const seenKinds = new Set<string>();

/** 测试与整仓重置用：清空「本会话已确认类别」。 */
export function __resetAiSession(): void {
  seenKinds.clear();
}

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

/** 只保留与 after 不同的字段；供 executeViewChange 应用最小补丁。 */
export function diffViewSpec(
  before: ViewSpec,
  after: ViewSpec,
): Partial<ViewSpec> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after) as Array<keyof ViewSpec>) {
    if (before[key] !== after[key]) patch[key] = after[key];
  }
  return patch as Partial<ViewSpec>;
}

interface AgentReply {
  text: string;
  turns: number;
  tool_calls: string[];
}

interface AiEntryState {
  // 既有：小窗/停靠共用的对话与撤销状态
  overlayOpen: boolean;
  input: string;
  submitting: boolean;
  messages: AiEntryMessage[];
  pendingConfirm: AiPendingConfirm | null;
  undoVisible: boolean;
  undoTarget: string | null;
  undoPreConfig: unknown | null;
  undoPreSpec: ViewSpec | null;
  panelOpen: boolean;
  snapshots: AiSnapshotInfo[];
  snapshotsLoading: boolean;

  // 形态
  form: AiForm;
  bubbleOpen: boolean;
  bubbleRect: BubbleRect | null;

  openOverlay: () => void;
  closeOverlay: () => void;
  toggleOverlay: () => void;
  setInput: (value: string) => void;
  requestSubmit: (text: string, kind?: string) => void;
  confirmPendingSubmit: () => void;
  cancelPendingSubmit: () => void;
  executeViewChange: (
    patch: Partial<ViewSpec>,
    kind: string,
    summary: string,
  ) => void;
  requestApplyPreset: (id: string) => void;
  runUndo: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  loadSnapshots: () => Promise<void>;
  restoreSnapshot: (name: string) => Promise<void>;
  reshowUndo: () => void;
  undoFadeLater: () => void;

  openBubble: () => void;
  closeBubble: () => void;
  dock: () => void;
  undock: () => void;
  toggleForm: () => void;
  setBubbleRect: (rect: BubbleRect) => void;
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

/** 预设待确认时保存其最小补丁；自由对话路径为 null。 */
let pendingViewPatch: Partial<ViewSpec> | null = null;

/**
 * 确认密度判定：
 * - always：永远弹确认卡；
 * - never：从不弹，立即执行；
 * - session-silent（默认）：本会话该类别首次弹，其后静默。
 */
function shouldConfirm(kind: string): boolean {
  const density =
    useEditorStore.getState().config.aiConfirmDensity ?? "session-silent";
  if (density === "always") return true;
  if (density === "never") return false;
  return !seenKinds.has(kind);
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
          reloadAppConfig(true);
          set({
            undoTarget: beforeSnapshot,
            undoPreConfig: preConfig,
            undoPreSpec: null,
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
    undoPreSpec: null,
    panelOpen: false,
    snapshots: [],
    snapshotsLoading: false,
    form: "bubble",
    bubbleOpen: false,
    bubbleRect: null,

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

    requestSubmit: (text, kind = "view") => {
      const trimmed = text.trim();
      if (!trimmed || get().submitting) return;
      if (shouldConfirm(kind)) {
        pendingViewPatch = null;
        set({ pendingConfirm: { text: trimmed, kind, summary: "" } });
        return;
      }
      submitCore(trimmed);
    },

    confirmPendingSubmit: () => {
      const pending = get().pendingConfirm;
      if (!pending) return;
      set({ pendingConfirm: null });
      seenKinds.add(pending.kind);
      const patch = pendingViewPatch;
      pendingViewPatch = null;
      if (patch) {
        get().executeViewChange(patch, pending.kind, pending.summary);
        return;
      }
      submitCore(pending.text);
    },

    cancelPendingSubmit: () => {
      pendingViewPatch = null;
      set({ pendingConfirm: null });
    },

    executeViewChange: (patch, kind, summary) => {
      const preSpec = useStore.getState().captureViewSpec();
      const nextSpec = applySpec(preSpec, patch);
      seenKinds.add(kind);
      if (viewSpecEquals(preSpec, nextSpec)) {
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content: summary || "没有需要调整的地方。",
              changed: false,
            },
          ],
        });
        return;
      }
      useStore.getState().applyViewSpec(patch);
      set({
        undoPreSpec: preSpec,
        undoTarget: null,
        undoPreConfig: null,
        undoVisible: true,
        messages: [
          ...get().messages,
          {
            id: nextId(),
            role: "assistant",
            content: summary || "已调整视图。",
            changed: true,
          },
        ],
      });
      clearUndoTimer();
      undoTimer = setTimeout(
        () => set({ undoVisible: false }),
        UNDO_VISIBLE_MS,
      );
      void saveAppConfig();
    },

    requestApplyPreset: (id) => {
      const preset = presetById(id);
      if (!preset) return;
      const before = useStore.getState().captureViewSpec();
      const after = preset.apply(before);
      const summary = humanizeChange(before, after);
      const patch = diffViewSpec(before, after);
      const kind = "view";
      if (shouldConfirm(kind)) {
        pendingViewPatch = patch;
        set({
          pendingConfirm: {
            text: `预设：${preset.label}`,
            kind,
            summary,
          },
        });
        return;
      }
      pendingViewPatch = null;
      get().executeViewChange(patch, kind, summary);
    },

    runUndo: async () => {
      const { undoTarget, undoPreConfig, undoPreSpec } = get();
      if (!undoTarget && !undoPreConfig && !undoPreSpec) return;
      clearUndoTimer();
      set({
        undoVisible: false,
        undoTarget: null,
        undoPreConfig: null,
        undoPreSpec: null,
      });
      try {
        if (undoTarget) {
          await invoke("restore_config_snapshot", { name: undoTarget });
          reloadAppConfig(true);
        } else if (undoPreConfig) {
          await invoke("save_config", { config: undoPreConfig });
          reloadAppConfig(true);
        }
        if (undoPreSpec) {
          // 同步还原视图规格；reloadAppConfig 为 fire-and-forget，且缺字段不覆盖
          useStore.getState().setViewSpec(undoPreSpec);
          void saveAppConfig();
        }
        set({
          messages: [
            ...get().messages,
            {
              id: nextId(),
              role: "assistant",
              content:
                undoTarget || undoPreSpec ? "已恢复到改动前。" : "已恢复默认。",
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
        reloadAppConfig(true);
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
      if (!get().undoTarget && !get().undoPreConfig && !get().undoPreSpec)
        return;
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

    openBubble: () => {
      // 小窗是唯一宿主：若已停靠则先脱离，幂等
      useStore.getState().undockAiPane();
      set({ form: "bubble", bubbleOpen: true, pendingConfirm: null });
    },
    closeBubble: () => {
      pendingViewPatch = null;
      set({ bubbleOpen: false, pendingConfirm: null });
    },
    dock: () => {
      useStore.getState().dockAiPane();
      set({ form: "docked", bubbleOpen: false, pendingConfirm: null });
    },
    undock: () => {
      useStore.getState().undockAiPane();
      set({ form: "bubble", bubbleOpen: true });
    },
    toggleForm: () => {
      const { form, bubbleOpen } = get();
      if (form === "docked") {
        get().undock();
      } else if (bubbleOpen) {
        get().dock();
      } else {
        get().openBubble();
      }
    },
    setBubbleRect: (rect) => set({ bubbleRect: rect }),
  };
});

// AI 停靠格被关闭（× 或 closePane）→ 宿主回落到小窗形态
setAiPaneClosedHandler(() => {
  useAiEntryStore.getState().undock();
});

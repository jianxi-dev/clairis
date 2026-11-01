import { create } from "zustand";
import type {
  CaptureStatus,
  CapturePrefix,
  InboxEntry,
  UndoState,
} from "../types";

let _idCounter = 0;
function nextEntryId(): string {
  _idCounter += 1;
  const ts = new Date().toISOString().replace(/[:.]/g, "_");
  return `cap-${ts}-${_idCounter}`;
}

const UNDO_MS = 5000;
let _fontSaveTimer: ReturnType<typeof setTimeout> | null = null;

const CAPTURE_FALLBACK_KEY = "biaoyue_capture_fallback";
const LEGACY_CAPTURE_FALLBACK_KEY = "clairis_capture_fallback";

export function migrateLegacyCaptureFallback(): void {
  try {
    if (localStorage.getItem(CAPTURE_FALLBACK_KEY) !== null) return;
    const legacy = localStorage.getItem(LEGACY_CAPTURE_FALLBACK_KEY);
    if (legacy === null) return;
    localStorage.setItem(CAPTURE_FALLBACK_KEY, legacy);
  } catch {
    // localStorage 不可用（隐私模式 / 配额）——忽略，继续使用内存态
  }
}

migrateLegacyCaptureFallback();

const IME_PREFIX_MAP: Record<string, CapturePrefix> = {
  ".": ".",
  "。": ".",
  "．": ".",
  "-": "-",
  "—": "-",
  "–": "-",
  "!": "!",
  "！": "!",
  "?": "?",
  "？": "?",
};

/**
 * 将草稿按行切块为多条 inbox 条目（T4 批量提交）。
 * - 按 `\n` 切行；空行结束当前块（不产出条目），并清空粘滞前缀状态（后续无前缀行作为独立 note）。
 * - prefix 行（第 1 字符命中 IME_PREFIX_MAP 且非空行）：先 push 未闭块，再开新块，prefix=命中字符，content=去除前缀字符后的行。
 * - 无 prefix 行：有未闭块 → `content += "\n" + 行`（append 续行）；无未闭块 → 用 stickyPrefix（D-4 粘滞语义）或空（note）起新块。
 * - 结束 push 非空块；空数组返回 `[]`。
 * - 每条 `captured_at = now() + i`（第 i 条）、`id=nextEntryId()` 增量唯一；全部互异。
 */
export function chunkDraft(
  raw: string,
  stickyPrefix: CapturePrefix | "",
  now: () => Date,
): InboxEntry[] {
  const lines = raw.split("\n");
  const chunks: { prefix: CapturePrefix; content: string }[] = [];
  let current: { prefix: CapturePrefix; content: string } | null = null;
  let stickyActive = stickyPrefix !== "";

  for (const line of lines) {
    if (line === "") {
      // 空行：结束当前块（不产出条目），清空粘滞前缀状态
      if (current) {
        chunks.push(current);
        current = null;
      }
      stickyActive = false;
      continue;
    }
    const detected = IME_PREFIX_MAP[line[0]];
    if (detected) {
      // prefix 行：先 push 未闭块，再开新块
      if (current) {
        chunks.push(current);
        current = null;
      }
      current = { prefix: detected, content: line.slice(1) };
      stickyActive = true;
    } else if (current) {
      // 无 prefix 行 + 未闭块 → append 续行
      current = {
        prefix: current.prefix,
        content: current.content + "\n" + line,
      };
    } else {
      // 无 prefix 行 + 无未闭块 → stickyPrefix 或空（note）起新块
      current = { prefix: stickyActive ? stickyPrefix : "", content: line };
    }
  }
  if (current) chunks.push(current);

  const t = now();
  const entries: InboxEntry[] = [];
  for (const c of chunks) {
    if (c.content === "") continue; // 跳过空块
    entries.push({
      id: nextEntryId(),
      prefix: c.prefix,
      content: c.content,
      capturedAt: new Date(t.getTime() + entries.length).toISOString(),
    });
  }
  return entries;
}

/**
 * 取光标所在行的首字符 prefix（纯展示，不改草稿正文）。
 * - 光标所在行 = `raw` 中光标前后最近 `\n` 之间的整行。
 * - 若该行首字符命中 `IME_PREFIX_MAP` 返回对应 `CapturePrefix`，否则返回 `''`。
 * - 空草稿返回 `''`。无副作用，供组件层实时推导高亮。
 */
export function getLinePrefix(
  raw: string,
  cursorPos: number,
): CapturePrefix | "" {
  if (raw === "") return "";
  const pos = Math.max(0, Math.min(cursorPos, raw.length));
  const beforeCursor = raw.slice(0, pos);
  const lastNewline = beforeCursor.lastIndexOf("\n");
  const lineStart = lastNewline + 1;
  const firstChar = raw[lineStart];
  if (firstChar === undefined) return "";
  return IME_PREFIX_MAP[firstChar] ?? "";
}

export interface CaptureOverlayStore {
  status: CaptureStatus;
  draftContent: string;
  draftPrefix: CapturePrefix;
  history: InboxEntry[];
  displayLimit: number;
  collapsed: boolean;
  selectedIndex: number;
  positionX: number;
  positionY: number;
  undo: UndoState | null;
  savedAckId: string | null;
  fontSize: number;
  editingId: string | null;
  editBuffer: string;
  capsuleX: number;
  capsuleY: number;
  pinned: boolean;
  overlayWidth: number;
  overlayHeight: number;
  panelRatio: number;

  open: () => void;
  toggle: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  // Primary draft setter — handles per-line prefix detection
  setDraftContent: (raw: string, cursorPos?: number) => void;
  // Alias for compatibility
  setDraftInput: (raw: string) => void;
  // Direct prefix setter (used by Enter empty-line clear)
  setDraftPrefix: (prefix: CapturePrefix) => void;
  handleCmdEnter: () => Promise<string | null>;
  handleCmdN: () => Promise<void>;
  archiveEntry: (id: string) => void;
  undoArchive: (id: string) => void;
  tickUndo: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  setSelectedIndex: (i: number) => void;
  setCollapsed: (v: boolean) => void;
  loadMore: () => void;
  setPosition: (x: number, y: number) => void;
  setFontSize: (s: number) => void;
  clampPosition: (overlayW?: number, overlayH?: number) => void;
  loadHistory: () => Promise<void>;
  startEdit: (id: string, content: string) => void;
  setEditBuffer: (v: string) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
  deleteEntry: (id: string) => void;
  openInMainWindow: (dateStr: string) => void;
  loadConfig: () => Promise<void>;
  setCapsulePosition: (x: number, y: number) => void;
  clampCapsulePosition: () => void;
  setPinned: (v: boolean) => void;
  setOverlaySize: (w: number, h: number) => void;
  setPanelRatio: (r: number) => void;
}

export const useCaptureOverlayStore = create<CaptureOverlayStore>(
  (set, get) => ({
    status: "closed",
    draftContent: "",
    draftPrefix: "",
    history: [],
    displayLimit: 5,
    collapsed: true,
    selectedIndex: -1,
    positionX: -1,
    positionY: 60,
    undo: null,
    savedAckId: null,
    fontSize: 15,
    editingId: null,
    editBuffer: "",
    capsuleX: 0,
    capsuleY: 0,
    pinned: false,
    overlayWidth: 420,
    overlayHeight: 500,
    panelRatio: 0.4,

    open: () => {
      const { positionX, overlayWidth } = get();
      // On first open (positionX === -1), position at right-top
      if (positionX === -1) {
        const x = Math.max(20, window.innerWidth - overlayWidth - 24);
        set({ status: "normal", selectedIndex: -1, positionX: x });
      } else {
        set({ status: "normal", selectedIndex: -1 });
      }
      get().loadHistory();
      get().loadConfig();
    },

    toggle: () => {
      const { status, positionX, overlayWidth } = get();
      if (status === "closed" || status === "capsule") {
        const patch: Partial<CaptureOverlayStore> = {
          status: "normal",
          selectedIndex: -1,
        };
        if (positionX === -1) {
          patch.positionX = Math.max(20, window.innerWidth - overlayWidth - 24);
        }
        set(patch);
        get().loadHistory();
      } else {
        set({ status: "closed" });
      }
    },

    close: () =>
      set({
        status: "closed",
        draftContent: "",
        draftPrefix: "",
        selectedIndex: -1,
        editingId: null,
        editBuffer: "",
      }),
    minimize: () => set({ status: "capsule" }),
    restore: () => set({ status: "normal", selectedIndex: -1 }),

    setDraftContent: (raw: string, cursorPos?: number) => {
      const pos = cursorPos ?? raw.length;

      // 清空时的前缀跟随清除（Backspace 空内容 / 提交后由别处处理）
      if (raw === "") {
        set({ draftContent: "", draftPrefix: "" });
        return;
      }

      // Per-line prefix detection: find the line containing the cursor
      const beforeCursor = raw.slice(0, pos);
      const lastNewline = beforeCursor.lastIndexOf("\n");
      const currentLineStart = lastNewline + 1;
      const posInLine = pos - currentLineStart;

      // 若光标在行首第 1 字符（刚输入）且命中前缀 → 从正文消费该字符，进入粘滞 prefix（spec D-4）
      if (posInLine === 1 && raw.length > currentLineStart) {
        const firstChar = raw[currentLineStart];
        const detected = IME_PREFIX_MAP[firstChar];
        if (detected) {
          set({
            draftPrefix: detected,
            draftContent:
              raw.slice(0, currentLineStart) + raw.slice(currentLineStart + 1),
          });
          return;
        }
      }

      // 其余输入：保留粘滞 prefix（空行 Enter 由组件清除），只更新正文
      set({ draftContent: raw });
    },

    setDraftPrefix: (prefix: CapturePrefix) => set({ draftPrefix: prefix }),

    setDraftInput: (raw: string, cursorPos?: number) =>
      get().setDraftContent(raw, cursorPos),

    handleCmdEnter: async (): Promise<string | null> => {
      const { draftContent, draftPrefix, undo } = get();
      if (undo) return null;
      const entries = chunkDraft(draftContent, draftPrefix, () => new Date());
      if (entries.length === 0) return null;

      // Clear draft and visual prefix
      set({ draftContent: "", draftPrefix: "" });

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("append_inbox_batch", {
          entries: entries.map((e) => ({
            id: e.id,
            content: e.content,
            prefix: e.prefix,
            capturedAt: e.capturedAt,
          })),
        });
      } catch {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          for (const entry of entries) {
            await invoke("append_inbox", {
              entry: {
                id: entry.id,
                content: entry.content,
                prefix: entry.prefix,
                capturedAt: entry.capturedAt,
              },
            });
          }
        } catch {
          const fallback = JSON.parse(
            localStorage.getItem(CAPTURE_FALLBACK_KEY) || "[]",
          );
          fallback.push(...entries);
          localStorage.setItem(CAPTURE_FALLBACK_KEY, JSON.stringify(fallback));
        }
      }

      const lastId = entries[entries.length - 1].id;
      set((s) => ({
        history: [...entries, ...s.history],
        selectedIndex: -1,
        savedAckId: lastId,
      }));
      setTimeout(
        () => set((s) => (s.savedAckId === lastId ? { savedAckId: null } : {})),
        600,
      );
      // Restore textarea focus
      requestAnimationFrame(() => {
        const ta = document.querySelector(
          "textarea[data-capture-input]",
        ) as HTMLTextAreaElement | null;
        if (ta) ta.focus();
      });
      return lastId;
    },

    handleCmdN: async () => {
      const { draftContent } = get();
      if (draftContent.trim()) {
        await get().handleCmdEnter();
      } else {
        // No content: just clear content (keep prefix for sticky mode)
        set({ draftContent: "" });
      }
    },

    archiveEntry: (id: string) => {
      const deadline = Date.now() + UNDO_MS;
      const timer = window.setTimeout(() => get().tickUndo(), UNDO_MS + 50);
      set((s) => ({
        undo: { entryId: id, deadline, timer },
        history: s.history.map((e) =>
          e.id === id ? { ...e, archivedAt: new Date().toISOString() } : e,
        ),
      }));
    },

    undoArchive: (id: string) => {
      const { undo } = get();
      if (undo?.timer) window.clearTimeout(undo.timer);
      set((s) => ({
        undo: null,
        history: s.history.map((e) =>
          e.id === id ? { ...e, archivedAt: undefined } : e,
        ),
      }));
    },

    tickUndo: () => {
      const { undo, history } = get();
      if (!undo) return;
      if (Date.now() < undo.deadline) {
        const msLeft = undo.deadline - Date.now();
        const timer = window.setTimeout(() => get().tickUndo(), msLeft + 50);
        set((s) => (s.undo ? { undo: { ...s.undo, timer } } : {}));
        return;
      }
      const entry = history.find((e) => e.id === undo.entryId);
      set((s) => ({
        undo: null,
        history: s.history.filter((e) => e.id !== undo.entryId),
      }));
      if (entry) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("archive_entry", {
            date: entry.capturedAt.slice(0, 10),
            entryId: entry.id,
          }).catch(() => {});
        });
      }
    },

    selectNext: () =>
      set((s) => ({
        selectedIndex: Math.min(s.selectedIndex + 1, s.history.length - 1),
      })),
    selectPrev: () =>
      set((s) => ({ selectedIndex: Math.max(s.selectedIndex - 1, -1) })),
    setSelectedIndex: (i: number) => set({ selectedIndex: i }),
    setCollapsed: (v: boolean) => set({ collapsed: v }),
    loadMore: () => set((s) => ({ displayLimit: s.displayLimit + 20 })),
    setPosition: (x: number, y: number) => set({ positionX: x, positionY: y }),

    clampPosition: (overlayW?: number, overlayH?: number) => {
      const padding = 20;
      const w = overlayW ?? 420;
      const h = overlayH ?? 420;
      const maxX = window.innerWidth - w - padding;
      const maxY = window.innerHeight - h - padding;
      const { positionX, positionY } = get();
      const newX = Math.max(padding, Math.min(positionX, maxX));
      const newY = Math.max(padding, Math.min(positionY, maxY));
      set({ positionX: newX, positionY: newY });
      // Persist position
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("save_config_capture", {
          captureConfig: {
            positionX: Math.round(newX),
            positionY: Math.round(newY),
          },
        }).catch(() => {});
      });
    },

    setFontSize: (s: number) => {
      const clamped = Math.max(12, Math.min(22, s));
      set({ fontSize: clamped });
      if (_fontSaveTimer) clearTimeout(_fontSaveTimer);
      _fontSaveTimer = setTimeout(() => {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("save_config_capture", {
            captureConfig: { fontSize: clamped },
          });
        });
      }, 500);
    },

    loadHistory: async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const today = await invoke<InboxEntry[]>("load_today_inbox");
        const toLocalDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const yesterday = toLocalDate(new Date(Date.now() - 86400000));
        const yesterdayEntries = await invoke<InboxEntry[]>(
          "load_inbox_by_date",
          { date: yesterday },
        );
        const all = [...today, ...yesterdayEntries];
        const seen = new Set<string>();
        const unique = all.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        set({ history: unique });
      } catch {
        const fallback: InboxEntry[] = JSON.parse(
          localStorage.getItem(CAPTURE_FALLBACK_KEY) || "[]",
        );
        set({ history: fallback });
      }
    },

    startEdit: (id: string, content: string) =>
      set({ editingId: id, editBuffer: content }),
    setEditBuffer: (v: string) => set({ editBuffer: v }),

    saveEdit: async () => {
      const { editingId, editBuffer, history } = get();
      if (!editingId) return;
      const entry = history.find((e) => e.id === editingId);
      if (!entry) return;
      const newContent = editBuffer.trim();
      if (!newContent) return;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("edit_inbox_entry", {
          req: {
            date: entry.capturedAt.slice(0, 10),
            entryId: editingId,
            newContent,
          },
        });
      } catch {
        const fallback: InboxEntry[] = JSON.parse(
          localStorage.getItem(CAPTURE_FALLBACK_KEY) || "[]",
        );
        const updated = fallback.map((e) =>
          e.id === editingId ? { ...e, content: newContent } : e,
        );
        localStorage.setItem(CAPTURE_FALLBACK_KEY, JSON.stringify(updated));
      }
      set((s) => ({
        history: s.history.map((e) =>
          e.id === editingId ? { ...e, content: newContent } : e,
        ),
        editingId: null,
        editBuffer: "",
      }));
    },

    cancelEdit: () => set({ editingId: null, editBuffer: "" }),

    deleteEntry: (id: string) => {
      const entry = get().history.find((e) => e.id === id);
      set((s) => ({ history: s.history.filter((e) => e.id !== id) }));
      if (entry) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("delete_inbox_entry", {
            date: entry.capturedAt.slice(0, 10),
            entryId: id,
          }).catch(() => {});
        });
      }
    },

    openInMainWindow: (dateStr: string) => {
      const toLocalDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const date =
        dateStr === "今天"
          ? toLocalDate(new Date())
          : dateStr === "昨天"
            ? toLocalDate(new Date(Date.now() - 86400000))
            : dateStr;
      // Overlay window: always emit event to main window (overlay can't access main store)
      import("@tauri-apps/api/event")
        .then(({ emit }) => {
          emit("open-file-in-main", { dateStr: date });
        })
        .catch(() => {});
    },

    loadConfig: async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const config = await invoke<{
          fontSize?: number;
          positionX?: number;
          positionY?: number;
          capsuleX?: number;
          capsuleY?: number;
          pinned?: boolean;
          overlayWidth?: number;
          overlayHeight?: number;
          panelRatio?: number;
        }>("load_config_capture");
        const patch: Partial<CaptureOverlayStore> = {};
        if (config.fontSize !== undefined && config.fontSize !== null)
          patch.fontSize = config.fontSize;
        if (config.positionX !== undefined && config.positionX !== null)
          patch.positionX = config.positionX;
        if (config.positionY !== undefined && config.positionY !== null)
          patch.positionY = config.positionY;
        if (config.capsuleX !== undefined && config.capsuleX !== null)
          patch.capsuleX = config.capsuleX;
        if (config.capsuleY !== undefined && config.capsuleY !== null)
          patch.capsuleY = config.capsuleY;
        if (config.pinned !== undefined && config.pinned !== null)
          patch.pinned = config.pinned;
        if (config.overlayWidth !== undefined && config.overlayWidth !== null)
          patch.overlayWidth = config.overlayWidth;
        if (config.overlayHeight !== undefined && config.overlayHeight !== null)
          patch.overlayHeight = config.overlayHeight;
        if (config.panelRatio !== undefined && config.panelRatio !== null)
          patch.panelRatio = config.panelRatio;
        if (Object.keys(patch).length > 0) set(patch);
      } catch {
        // config not found or parse error — use defaults
      }
    },

    setCapsulePosition: (x: number, y: number) =>
      set({ capsuleX: x, capsuleY: y }),

    clampCapsulePosition: () => {
      const padding = 20;
      const size = 44;
      const maxX = window.innerWidth - size - padding;
      const maxY = window.innerHeight - size - padding;
      const { capsuleX, capsuleY } = get();
      const newX = Math.max(padding, Math.min(capsuleX, maxX));
      const newY = Math.max(padding, Math.min(capsuleY, maxY));
      set({ capsuleX: newX, capsuleY: newY });
      // Persist capsule position
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("save_config_capture", {
          captureConfig: { capsuleX: newX, capsuleY: newY },
        }).catch(() => {});
      });
    },

    setPinned: (v: boolean) => {
      set({ pinned: v });
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("set_overlay_pinned", { pinned: v }).catch(() => {});
      });
    },

    setOverlaySize: (w: number, h: number) => {
      const clampedW = Math.max(320, Math.min(600, Math.round(w)));
      const clampedH = Math.max(280, Math.min(800, Math.round(h)));
      set({ overlayWidth: clampedW, overlayHeight: clampedH });
      get().clampPosition(clampedW, clampedH);
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("save_config_capture", {
          captureConfig: { overlayWidth: clampedW, overlayHeight: clampedH },
        }).catch(() => {});
      });
    },

    setPanelRatio: (r: number) => {
      const clamped = Math.max(0.2, Math.min(0.8, Math.round(r * 100) / 100));
      set({ panelRatio: clamped });
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("save_config_capture", {
          captureConfig: { panelRatio: clamped },
        }).catch(() => {});
      });
    },
  }),
);

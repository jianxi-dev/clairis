/**
 * 裁剪跳顶诊断探针（仅 DEV 构建启用）。
 *
 * 真机 WKWebView 的跳顶在 Chromium / Playwright WebKit 里都复现不出来。
 * 本探针把关键节点（进入 / 写回 / 清理）与每一次显著滚动跳变记录到
 * `<docPath>.crop-debug.log`，由维护者直接读文件定位机制。
 *
 * 纯观察者：不改任何布局与行为。跳变阈值 30px；真机经 save_file 整体落盘，
 * 浏览器 / mock 环境只入 ring buffer 不写文件。
 */
import { invoke } from "@tauri-apps/api/core";
import { getActiveEditorView } from "../editors/editorRef";
import { useStore } from "../stores/index";
import { isTauriEnv } from "./tauri";

interface JumpRecord {
  t: number;
  from: number;
  to: number;
  scroller: string;
  /** scroller 自身内容高度（塌陷时 ≈ clientHeight）。 */
  docH: number;
  sel: number;
  viewport: [number, number];
  cropFrames: number;
  marks: string[];
}

const lines: string[] = [];
const marks: string[] = [];
let lastTop: number | null = null;
let lastScroller: string | null = null;
let installed = false;
let flushTimer: number | null = null;

function readViewStats(): {
  sel: number;
  viewport: [number, number];
  cropFrames: number;
} {
  const view = getActiveEditorView();
  return {
    sel: view ? view.state.selection.main.anchor : -1,
    viewport: view ? [view.viewport.from, view.viewport.to] : [-1, -1],
    cropFrames: document.querySelectorAll(".cm-image-crop-frame").length,
  };
}

function logPath(): string | null {
  const state = useStore.getState();
  const tabId = state.activeTabId;
  const path = tabId ? state.tabs[tabId]?.path : null;
  return path ? `${path}.crop-debug.log` : null;
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 400);
}

async function flush(): Promise<void> {
  if (!isTauriEnv() || lines.length === 0) return;
  const path = logPath();
  if (!path) return;
  const payload = `${lines.join("\n")}\n`;
  lines.length = 0;
  try {
    // 追加语义：探针自持全文（本会话内），save_file 为整文件覆写。
    const session = sessionText;
    const next = session === "" ? payload : `${session}${payload}`;
    sessionText = next;
    await invoke("save_file", { path, content: next });
  } catch {
    /* 落盘失败静默：探针绝不影响主流程 */
  }
}

let sessionText = "";

export function installCropJumpProbe(): void {
  if (installed || !import.meta.env.DEV) return;
  installed = true;
  document.addEventListener(
    "scroll",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const isScroller =
        target.classList.contains("cm-scroller") ||
        target.classList.contains("content-scroll");
      if (!isScroller) return;
      const top = Math.round(target.scrollTop);
      const which = target.classList.contains("cm-scroller")
        ? "cm-scroller"
        : "content-scroll";
      if (lastTop !== null && lastScroller === which) {
        const delta = Math.abs(top - lastTop);
        if (delta >= 30) {
          const viewStats = readViewStats();
          const record: JumpRecord = {
            t: Math.round(performance.now()),
            from: lastTop,
            to: top,
            scroller: which,
            docH: Math.round(target.scrollHeight || 0),
            sel: viewStats.sel,
            viewport: viewStats.viewport,
            cropFrames: viewStats.cropFrames,
            marks: marks.slice(-6),
          };
          lines.push(`JUMP ${JSON.stringify(record)}`);
          scheduleFlush();
        }
      }
      lastTop = top;
      lastScroller = which;
    },
    true,
  );
}

/** 关键节点打点：进入裁剪 / 写回 / 清理。 */
export function markCropProbe(
  label: string,
  detail?: Record<string, unknown>,
): void {
  if (!installed) return;
  marks.push(`${label}@${Math.round(performance.now())}`);
  if (marks.length > 12) marks.shift();
  const record = {
    t: Math.round(performance.now()),
    label,
    ...(detail ?? {}),
    ...readViewStats(),
  };
  lines.push(`MARK ${JSON.stringify(record)}`);
  scheduleFlush();
}

/** 会话结束后清空本地缓冲（不删落盘文件，由维护者读完手动清理）。 */
export function resetCropProbe(): void {
  sessionText = "";
}

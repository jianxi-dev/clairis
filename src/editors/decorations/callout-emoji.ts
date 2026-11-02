/* 高亮块头部 emoji 取色器（移植自 md-bundle packages/editor/src/decorations/callout-emoji.ts，
 * issue #361 / change editor-fidelity-2 task 2.6）。
 *
 * 持有编辑端 emoji 覆盖表与轻量取色器 DOM（搜索 + 精选网格 + 恢复默认）。从
 * `callout.ts` 拆出，让卡片装饰文件专注解析与行内编辑。
 *
 * 持久化：Markdown 没有放 callout emoji 的属性位，改写源码标题会破坏用户内容，
 * 所以覆盖只在本次会话内有效。`CalloutWidget.toDOM` 在 widget 重建后重新应用，
 * 文档编辑后头部保持稳定；重新加载则回到类型默认 emoji（已知限制，#361）。
 */
import type { EditorView } from "@codemirror/view";
import { CALLOUT_EMOJI_CHOICES } from "../callout-types";

/** 头部 emoji 覆盖，按 view 再按高亮块序号存。 */
const calloutEmojiOverrides = new WeakMap<EditorView, Map<number, string>>();

/** 文档级「按外部关闭」处理器，避免被移除的取色器泄漏监听。 */
const pickerDismissers = new WeakMap<
  HTMLElement,
  (event: MouseEvent) => void
>();

/**
 * 按文档顺序（序号）快照本次会话的覆盖，供在别处渲染同一文档的宿主使用
 * （预览 / 导出）。`undefined` 项表示「用类型默认」（#380）。
 */
export function getCalloutEmojiOverrides(
  view: EditorView,
): (string | undefined)[] {
  const map = calloutEmojiOverrides.get(view);
  if (!map || map.size === 0) return [];
  const highest = Math.max(...map.keys());
  return Array.from({ length: highest + 1 }, (_, i) => map.get(i));
}

/** 通知宿主覆盖快照变了（`mdb:callout-emoji`）。 */
function publishOverrides(view: EditorView): void {
  view.dom.dispatchEvent(
    new CustomEvent("mdb:callout-emoji", {
      bubbles: true,
      detail: getCalloutEmojiOverrides(view),
    }),
  );
}

/** 某个高亮块的展示覆盖；返回 undefined 时回落到类型默认。 */
export function getCalloutEmojiOverride(
  view: EditorView,
  index: number,
): string | undefined {
  return calloutEmojiOverrides.get(view)?.get(index);
}

/** 解析某个序号对应的实时卡片（widget 重建会摘掉旧的）。 */
function liveCard(view: EditorView, index: number): HTMLElement | null {
  const card = view.dom.querySelectorAll(".cm-callout")[index];
  return card instanceof HTMLElement ? card : null;
}

function closeEmojiPicker(picker: HTMLElement): void {
  const onDocDown = pickerDismissers.get(picker);
  if (onDocDown) {
    document.removeEventListener("mousedown", onDocDown, true);
    pickerDismissers.delete(picker);
  }
  picker.remove();
}

/**
 * 存一个 emoji 选项（`null` 表示清除）并刷到实时卡片。重新解析卡片，避免
 * 点击与生效之间 widget 重建导致头部停留旧值。
 */
function applyEmoji(
  view: EditorView,
  index: number,
  emoji: string | null,
  defaultEmoji: string,
): void {
  let overrides = calloutEmojiOverrides.get(view);
  if (emoji === null) {
    overrides?.delete(index);
  } else {
    if (!overrides) {
      overrides = new Map();
      calloutEmojiOverrides.set(view, overrides);
    }
    overrides.set(index, emoji);
  }
  publishOverrides(view);
  const next = emoji ?? defaultEmoji;
  const card = liveCard(view, index);
  if (!card) return;
  card.setAttribute("data-callout-emoji", next);
  const iconEl = card.querySelector<HTMLElement>(".cm-callout-icon");
  if (iconEl) {
    iconEl.textContent = next;
    iconEl.setAttribute("data-callout-emoji", next);
  }
}

function buildEmojiPicker(
  view: EditorView,
  index: number,
  defaultEmoji: string,
): HTMLElement {
  const picker = document.createElement("div");
  picker.className = "cm-callout-emoji-picker";
  picker.setAttribute("data-testid", "cm-callout-emoji-picker");
  // 卡片会在 mousedown 打开行内编辑器；取色器自己接管按下事件。
  picker.addEventListener("mousedown", (event) => event.stopPropagation());

  const search = document.createElement("input");
  search.type = "text";
  search.className = "cm-callout-emoji-search";
  search.setAttribute("data-testid", "cm-callout-emoji-search");
  search.placeholder = "搜索 emoji";
  search.setAttribute("aria-label", "搜索 emoji");
  picker.appendChild(search);

  const grid = document.createElement("div");
  grid.className = "cm-callout-emoji-grid";
  const options: HTMLButtonElement[] = [];
  for (const choice of CALLOUT_EMOJI_CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-callout-emoji-option";
    btn.setAttribute("data-testid", "cm-callout-emoji-option");
    btn.setAttribute("data-emoji", choice.emoji);
    btn.setAttribute("data-name", choice.name);
    btn.title = choice.name;
    btn.textContent = choice.emoji;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      applyEmoji(view, index, choice.emoji, defaultEmoji);
      closeEmojiPicker(picker);
    });
    options.push(btn);
    grid.appendChild(btn);
  }
  picker.appendChild(grid);

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const btn of options) {
      const name = (btn.getAttribute("data-name") ?? "").toLowerCase();
      btn.style.display = query === "" || name.includes(query) ? "" : "none";
    }
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "cm-callout-emoji-reset";
  reset.setAttribute("data-testid", "cm-callout-emoji-reset");
  reset.textContent = "恢复默认";
  reset.addEventListener("click", (event) => {
    event.stopPropagation();
    applyEmoji(view, index, null, defaultEmoji);
    closeEmojiPicker(picker);
  });
  picker.appendChild(reset);

  return picker;
}

/** 在序号 `index` 的高亮块卡片上切换 emoji 取色器。 */
export function openCalloutEmojiPicker(
  view: EditorView,
  index: number,
  defaultEmoji: string,
): void {
  const card = liveCard(view, index);
  if (!card) return;
  const existing = card.querySelector<HTMLElement>(".cm-callout-emoji-picker");
  if (existing) {
    closeEmojiPicker(existing);
    return;
  }
  const picker = buildEmojiPicker(view, index, defaultEmoji);
  const onDocDown = (event: MouseEvent): void => {
    const target = event.target;
    const onIcon =
      target instanceof Element && target.closest(".cm-callout-icon") !== null;
    if (target instanceof Node && (picker.contains(target) || onIcon)) return;
    closeEmojiPicker(picker);
  };
  pickerDismissers.set(picker, onDocDown);
  document.addEventListener("mousedown", onDocDown, true);
  // #468：锚在头部，让面板正好开在 emoji 下方。挂到卡片会让
  // `top: calc(100% + 4px)` 变成「卡片下方」。
  const anchor = card.querySelector(".cm-callout-header") ?? card;
  anchor.appendChild(picker);
}

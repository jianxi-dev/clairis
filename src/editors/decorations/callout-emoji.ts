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
import { setCalloutEmojiSnapshot } from "../callout-emoji-overrides";
import { renderIcon } from "../icons";
import {
  EMOJI_CATEGORY_LABELS,
  EMOJI_TAB_LABELS,
  emojisOfCategory,
  randomEmoji,
  searchEmojis,
  type EmojiEntry,
} from "../emoji-data";
import { pushRecentEmoji, readRecentEmoji } from "../emoji-data/recent";

/** 头部 emoji 覆盖，按 view 再按高亮块序号存；记录类型，转换后自动失效。 */
const calloutEmojiOverrides = new WeakMap<
  EditorView,
  Map<number, { type: string; emoji: string }>
>();

/** 文档级「按外部关闭」处理器，避免被移除的取色器泄漏监听。 */
const pickerDismissers = new WeakMap<
  HTMLElement,
  { down: (event: MouseEvent) => void; key: (event: KeyboardEvent) => void }
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
  return Array.from({ length: highest + 1 }, (_, i) => map.get(i)?.emoji);
}

/** 通知宿主覆盖快照变了（`mdb:callout-emoji`），并写入会话快照供预览读取。 */
function publishOverrides(view: EditorView): void {
  const snapshot = getCalloutEmojiOverrides(view);
  setCalloutEmojiSnapshot(view.state.doc.toString(), snapshot);
  view.dom.dispatchEvent(
    new CustomEvent("mdb:callout-emoji", {
      bubbles: true,
      detail: snapshot,
    }),
  );
}

/** 某个高亮块的展示覆盖；返回 undefined 时回落到类型默认。 */
export function getCalloutEmojiOverride(
  view: EditorView,
  index: number,
  type: string,
): string | undefined {
  const entry = calloutEmojiOverrides.get(view)?.get(index);
  return entry && entry.type === type ? entry.emoji : undefined;
}

/** 解析某个序号对应的实时卡片（widget 重建会摘掉旧的）。 */
function liveCard(view: EditorView, index: number): HTMLElement | null {
  const card = view.dom.querySelectorAll(".cm-callout")[index];
  return card instanceof HTMLElement ? card : null;
}

function closeEmojiPicker(picker: HTMLElement): void {
  const dismissers = pickerDismissers.get(picker);
  if (dismissers) {
    document.removeEventListener("mousedown", dismissers.down, true);
    document.removeEventListener("keydown", dismissers.key, true);
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
  type: string,
): void {
  let overrides = calloutEmojiOverrides.get(view);
  if (emoji === null) {
    overrides?.delete(index);
  } else {
    if (!overrides) {
      overrides = new Map();
      calloutEmojiOverrides.set(view, overrides);
    }
    overrides.set(index, { type, emoji });
  }
  publishOverrides(view);
  const next = emoji ?? defaultEmoji;
  const card = liveCard(view, index);
  if (!card) return;
  if (card.getAttribute("data-callout-type") !== type) return;
  card.setAttribute("data-callout-emoji", next);
  const iconEl = card.querySelector<HTMLElement>(".cm-callout-icon");
  if (iconEl) {
    iconEl.textContent = next;
    iconEl.setAttribute("data-callout-emoji", next);
  }
}

/** 建一个 emoji 选项按钮（网格单元），点击应用并关闭取色器。 */
function buildEmojiOption(
  view: EditorView,
  index: number,
  defaultEmoji: string,
  type: string,
  picker: HTMLElement,
  entry: { char: string; name: string; id: string },
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-callout-emoji-option";
  btn.setAttribute("data-testid", "cm-callout-emoji-option");
  btn.setAttribute("data-emoji", entry.char);
  btn.setAttribute("data-name", entry.name);
  btn.setAttribute("data-emoji-id", entry.id);
  btn.title = entry.name;
  btn.textContent = entry.char;
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    applyEmoji(view, index, entry.char, defaultEmoji, type);
    pushRecentEmoji(entry.char);
    closeEmojiPicker(picker);
  });
  return btn;
}

function buildEmojiPicker(
  view: EditorView,
  index: number,
  defaultEmoji: string,
  type: string,
): HTMLElement {
  const picker = document.createElement("div");
  picker.className = "cm-callout-emoji-picker";
  picker.setAttribute("data-testid", "cm-callout-emoji-picker");
  // 卡片会在 mousedown 打开行内编辑器；取色器自己接管按下事件。
  picker.addEventListener("mousedown", (event) => event.stopPropagation());

  // 顶部：搜索框 + 随机按钮。
  const searchRow = document.createElement("div");
  searchRow.className = "cm-callout-emoji-search-row";
  const search = document.createElement("input");
  search.type = "text";
  search.className = "cm-callout-emoji-search";
  search.setAttribute("data-testid", "cm-callout-emoji-search");
  search.placeholder = "搜索 emoji";
  search.setAttribute("aria-label", "搜索 emoji");
  searchRow.appendChild(search);

  const randomBtn = document.createElement("button");
  randomBtn.type = "button";
  randomBtn.className = "cm-callout-emoji-random";
  randomBtn.setAttribute("data-testid", "cm-callout-emoji-random");
  randomBtn.title = "随机";
  randomBtn.appendChild(renderIcon("RotateOutlined"));
  const randomLabel = document.createElement("span");
  randomLabel.textContent = "随机";
  randomBtn.appendChild(randomLabel);
  randomBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const picked = randomEmoji();
    if (!picked) return;
    applyEmoji(view, index, picked.char, defaultEmoji, type);
    pushRecentEmoji(picked.char);
    // 随机不关闭取色器：连抽是常见用法。
    // 「最近」页签且搜索为空时刷新，让刚抽到的 emoji 立即出现在「最近」段。
    if (activeTab === 0 && search.value.trim() === "") renderBody();
  });
  searchRow.appendChild(randomBtn);
  picker.appendChild(searchRow);

  // 中部滚动区：按当前页签 / 搜索词渲染。
  const body = document.createElement("div");
  body.className = "cm-callout-emoji-body";
  picker.appendChild(body);

  // 底部页签栏：最近 + 7 个分类。
  const tabs = document.createElement("div");
  tabs.className = "cm-callout-emoji-tabs";
  const tabButtons: HTMLButtonElement[] = [];
  let activeTab = 0;
  EMOJI_TAB_LABELS.forEach((label, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "cm-callout-emoji-tab";
    tab.setAttribute("data-testid", "cm-callout-emoji-tab");
    tab.setAttribute("data-cat", i === 0 ? "recent" : String(i - 1));
    tab.textContent = label;
    tab.addEventListener("click", (event) => {
      event.stopPropagation();
      activeTab = i;
      for (const [j, btn] of tabButtons.entries()) {
        btn.classList.toggle("cm-callout-emoji-tab-active", j === i);
      }
      renderBody();
    });
    tabButtons.push(tab);
    tabs.appendChild(tab);
  });
  // 初始选中「最近」。
  tabButtons[0]?.classList.add("cm-callout-emoji-tab-active");
  picker.appendChild(tabs);

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "cm-callout-emoji-reset";
  reset.setAttribute("data-testid", "cm-callout-emoji-reset");
  reset.textContent = "恢复默认";
  reset.addEventListener("click", (event) => {
    event.stopPropagation();
    applyEmoji(view, index, null, defaultEmoji, type);
    closeEmojiPicker(picker);
  });
  picker.appendChild(reset);

  /** 渲染一个 emoji 选项（真实闭包，供 body 复用）。 */
  const optionFor = (entry: EmojiEntry): HTMLButtonElement =>
    buildEmojiOption(view, index, defaultEmoji, type, picker, entry);

  /** 渲染单个网格（不分段）。 */
  const renderGrid = (entries: readonly EmojiEntry[]): void => {
    body.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "cm-callout-emoji-grid";
    for (const entry of entries) grid.appendChild(optionFor(entry));
    body.appendChild(grid);
  };

  /** 渲染空态。 */
  const renderEmpty = (): void => {
    body.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "cm-callout-emoji-empty";
    empty.textContent = "没有匹配的 emoji";
    body.appendChild(empty);
  };

  /** 按当前页签渲染 body（「最近」= 常用 + 最近两段）。 */
  const renderTabBody = (): void => {
    if (activeTab === 0) {
      body.replaceChildren();
      const frequent = document.createElement("div");
      frequent.className = "cm-callout-emoji-section";
      const freqTitle = document.createElement("div");
      freqTitle.className = "cm-callout-emoji-section-title";
      freqTitle.textContent = "常用";
      frequent.appendChild(freqTitle);
      const freqGrid = document.createElement("div");
      freqGrid.className = "cm-callout-emoji-grid";
      for (const choice of CALLOUT_EMOJI_CHOICES) {
        freqGrid.appendChild(
          optionFor({
            id: choice.name,
            char: choice.emoji,
            name: choice.name,
            cat: 0,
            search: choice.name,
          }),
        );
      }
      frequent.appendChild(freqGrid);
      body.appendChild(frequent);

      const recent = readRecentEmoji();
      if (recent.length > 0) {
        const recentSection = document.createElement("div");
        recentSection.className = "cm-callout-emoji-section";
        const recentTitle = document.createElement("div");
        recentTitle.className = "cm-callout-emoji-section-title";
        recentTitle.textContent = "最近";
        recentSection.appendChild(recentTitle);
        const recentGrid = document.createElement("div");
        recentGrid.className = "cm-callout-emoji-grid";
        for (const char of recent) {
          recentGrid.appendChild(
            optionFor({
              id: char,
              char,
              name: char,
              cat: 0,
              search: char,
            }),
          );
        }
        recentSection.appendChild(recentGrid);
        body.appendChild(recentSection);
      }
      return;
    }
    const cat = activeTab - 1;
    const label = EMOJI_CATEGORY_LABELS[cat] ?? "";
    const entries = emojisOfCategory(cat);
    body.replaceChildren();
    const section = document.createElement("div");
    section.className = "cm-callout-emoji-section";
    const title = document.createElement("div");
    title.className = "cm-callout-emoji-section-title";
    title.textContent = label;
    section.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "cm-callout-emoji-grid";
    for (const entry of entries) grid.appendChild(optionFor(entry));
    section.appendChild(grid);
    body.appendChild(section);
  };

  /** 搜索词非空 → 单结果网格；空 → 恢复当前页签。 */
  const renderBody = (): void => {
    const query = search.value.trim();
    if (query !== "") {
      const hits = searchEmojis(query);
      if (hits.length === 0) renderEmpty();
      else renderGrid(hits);
      return;
    }
    renderTabBody();
  };

  search.addEventListener("input", renderBody);
  renderBody();

  return picker;
}

/** 在序号 `index` 的高亮块卡片上切换 emoji 取色器。 */
export function openCalloutEmojiPicker(
  view: EditorView,
  index: number,
  defaultEmoji: string,
  type: string,
): void {
  const card = liveCard(view, index);
  if (!card) return;
  const existing = card.querySelector<HTMLElement>(".cm-callout-emoji-picker");
  if (existing) {
    closeEmojiPicker(existing);
    return;
  }
  const picker = buildEmojiPicker(view, index, defaultEmoji, type);
  const onDocDown = (event: MouseEvent): void => {
    const target = event.target;
    const onIcon =
      target instanceof Element && target.closest(".cm-callout-icon") !== null;
    if (target instanceof Node && (picker.contains(target) || onIcon)) return;
    closeEmojiPicker(picker);
  };
  const onDocKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    closeEmojiPicker(picker);
  };
  pickerDismissers.set(picker, { down: onDocDown, key: onDocKey });
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("keydown", onDocKey, true);
  // #468：锚在头部，让面板正好开在 emoji 下方。挂到卡片会让
  // `top: calc(100% + 4px)` 变成「卡片下方」。
  const anchor = card.querySelector(".cm-callout-header") ?? card;
  anchor.appendChild(picker);
}

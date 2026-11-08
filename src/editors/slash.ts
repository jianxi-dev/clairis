/* 斜杠命令菜单（移植自 md-bundle packages/editor/src/slash.ts）。
 *
 * 结构：
 * - 模块级 `WeakMap<EditorView, SlashMenuState>` 保存每个视图的打开状态，
 *   测试可以直接调用导出的函数驱动菜单，不必模拟 DOM 事件。
 * - 根级行渲染为分类纵向列表；带子项或网格的行在行旁打开浮层（根列表保持
 *   可见），而不是替换它。表格尺寸选择器有自己的网格浮层。
 * - `/` 之后输入的字符就是真实文档文本：`readQuery` 每次文档变更都从
 *   `[slashPos + 1, head]` 推导过滤词，所以过滤不会和「文档变更即关闭」打架，
 *   应用时整段 `/query` 一起替换。
 * - 导出的 keymap `run` 同时就是可测试的命令函数。
 * - `slashKeymap()` 返回 `Prec.high(...)`，所以它的 Enter/Arrow/Escape/`/`
 *   绑定优先于 `defaultKeymap`。
 * - 菜单关闭时每个绑定都返回 false，默认 CM6 行为（换行、移动光标、插入斜杠）
 *   不受影响。
 * - 菜单直接按 `defaultCommands` 渲染（`applyCommand` 调 `cmd.insert`），
 *   不注册进共享命令注册表——注册会重复命令面板行，并遮蔽 commands.ts 里
 *   规范的光标插入命令。
 *
 * 与上游的差异只有一处：上游从 `commandRegistry.getKeyBinding(id)` 取产品
 * 快捷键，本仓库的命令注册表还没移植，所以改由宿主通过
 * `setSlashKeyChordResolver` 注入解析器；未注入时一律不显示快捷键。
 */

import {
  EditorView,
  ViewPlugin,
  keymap,
  type ViewUpdate,
} from "@codemirror/view";
import {
  Annotation,
  Prec,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { CALLOUT_EDIT_TYPES } from "./callout-types";
import { TABLE_SIZE_QUERY, filterSlashCommands } from "./slash-filter";
import { sanitizeCellText } from "./decorations/cell-text";
import { renderIcon } from "./icons";
import { formatKeyChord } from "./key-chord";
import { menuStack, type MenuToken } from "./orchestration/menu-stack";
import {
  PANEL_MAX_HEIGHT,
  rectFromCoords,
  intersectRects,
  type AnchorRect,
} from "./orchestration/anchor";
import { placeMenu } from "./orchestration/placement";
import { MENU_WIDTH } from "./orchestration/menu-metrics";

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  /**
   * 图标注册表名（见 `icons.ts` 的 `ICON_REGISTRY`）。经 `renderIcon` 渲染成
   * SVG，绝不作为文字字形进入 DOM：原始名字不能成为可见文本。
   */
  icon?: string;
  /**
   * 可选的文字字形（emoji），替代 SVG 图标渲染。高亮块类型用各自的 emoji，
   * 让插入菜单和块菜单的类型浮层显示同一个符号。
   */
  emoji?: string;
  /** `/` 之后输入的单键码（如 `r` 任务、`t` 表格、`q` 引用）。 */
  code?: string;
  /** 解析到同一命令的额外键码（如 bullet 列表的 `w`）。 */
  aliases?: readonly string[];
  /** 该行在根级所属的分组标题。 */
  group?: string;
  /** 存在时，激活该行会打开这个二级面板。 */
  children?: SlashCommand[];
  /** 存在时，激活该行会打开 rows×cols 网格选择器。 */
  grid?: { rows: number; cols: number };
  /**
   * 返回替换菜单范围的变更；`text` 是模板文本。调用时文档里 `/`（以及已输入
   * 的过滤词）还在。`applyCommand` 自己替换 `[slashPos, head]`，所以返回的
   * `from`/`to` 只是提示（无过滤词时定位斜杠）。仅叶子行提供；子菜单入口不提供。
   */
  insert?(state: EditorState): { from: number; to: number; text: string };
  /**
   * 为 true 时表示这条命令产出的是**行内**内容，可以放进 GFM 单元格；
   * 块级命令（标题/列表/表格/分栏…）只能落在块层，单元格菜单里不出现。
   */
  inline?: boolean;
  /**
   * 为 true 时，激活该行会让宿主通过注入的 `pickMediaFile` 回调选择媒体文件，
   * 而不是插入静态文本。选中文件的文件名变成可编辑的 `![name](name.ext)`。
   */
  pickMedia?: boolean;
}

/**
 * 行内快捷键解析器。真实命令注册表（含产品键位）尚未移植，宿主在接入时
 * 通过 `setSlashKeyChordResolver` 注入；未注入时所有行都不显示快捷键。
 */
let keyChordResolver: (id: string) => string | null = () => null;

/** 注入「命令 id → CM6 键位和弦」解析器；传 null 恢复为不显示快捷键。 */
export function setSlashKeyChordResolver(
  fn: ((id: string) => string | null) | null,
): void {
  keyChordResolver = fn ?? (() => null);
}

function headingLevel(level: 1 | 2 | 3 | 4 | 5 | 6): SlashCommand {
  const prefix = `${"#".repeat(level)} `;
  return {
    id: `heading-${level}`,
    label: `${level} 级标题`,
    icon: `H${level}Outlined`,
    code: String(level),
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: prefix };
    },
  };
}

/**
 * 高亮块行来自与块菜单类型浮层同一份数据：一个数据源，插入菜单和转换菜单
 * 的标签与图标永远不会漂移。渲染映射仍是解析/渲染的真相源。
 */
const CALLOUT_CODES: Record<string, string> = {
  note: "nn",
  info: "ni",
  tip: "nt",
  success: "ns",
  warning: "nw",
  danger: "nd",
  // 编辑端把这型叫 `failure`（失败）；`error` 是旧键。保留历史和弦 `/ne`，
  // 而不是让它失效。
  failure: "ne",
  question: "nq",
};

function calloutType(entry: (typeof CALLOUT_EDIT_TYPES)[number]): SlashCommand {
  const marker = entry.key.toUpperCase();
  return {
    id: `callout-${entry.key}`,
    label: entry.label,
    icon: "CalloutOutlined",
    emoji: entry.emoji,
    code: CALLOUT_CODES[entry.key],
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: `> [!${marker}]\n> ` };
    },
  };
}

const COLUMN_COUNTS = [1, 2, 3, 4, 5] as const;

function columnCount(count: number): SlashCommand {
  return {
    id: `columns-${count}`,
    label: `${count} 栏`,
    icon: "TextOutlined",
    code: `f${count}`,
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: `::: {.col-${count}}\n\n:::` };
    },
  };
}

/**
 * 斜杠行背后的注册表命令 id，让行显示产品快捷键（斜杠项显示产品和弦，而不是
 * markdown 触发符）。没有绑定命令的行不在表里 → 不显示和弦。
 */
const SLASH_COMMAND_IDS: Record<string, string> = {
  "heading-1": "heading-1",
  "heading-2": "heading-2",
  "heading-3": "heading-3",
  "heading-4": "heading-4",
  "heading-5": "heading-5",
  "heading-6": "heading-6",
  quote: "insert-quote",
  "code-block": "insert-code-block",
  task: "insert-task-list",
};

function slashKeybind(id: string): string {
  const commandId = SLASH_COMMAND_IDS[id];
  if (commandId === undefined) return "";
  const chord = keyChordResolver(commandId);
  return chord === null ? "" : formatKeyChord(chord);
}

export const defaultCommands: SlashCommand[] = [
  {
    id: "heading",
    label: "标题",
    icon: "H1Outlined",
    group: "基础",
    children: ([1, 2, 3, 4, 5, 6] as const).map(headingLevel),
  },
  {
    id: "quote",
    label: "引用",
    icon: "FormatQuoteOutlined",
    code: "q",
    group: "基础",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "> " };
    },
  },
  {
    id: "code-block",
    label: "代码块",
    icon: "CodeblockOutlined",
    code: "c",
    group: "基础",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "```\n\n```" };
    },
  },
  {
    id: "divider",
    label: "分割线",
    icon: "HorizontalRuleOutlined",
    code: "d",
    group: "基础",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "---" };
    },
  },
  {
    id: "task",
    label: "任务",
    icon: "TodoOutlined",
    code: "r",
    group: "常用",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "- [ ] " };
    },
  },
  {
    id: "image-ref",
    label: "图片引用",
    icon: "ImageOutlined",
    code: "p",
    aliases: ["img"],
    group: "常用",
    pickMedia: true,
    inline: true,
  },
  {
    id: "media-ref",
    label: "视频/文件",
    icon: "MediaFileOutlined",
    code: "v",
    aliases: ["media"],
    group: "常用",
    pickMedia: true,
  },
  {
    id: "table",
    label: "表格",
    icon: "TableGridOutlined",
    code: "t",
    group: "常用",
    grid: { rows: 10, cols: 10 },
  },
  {
    id: "columns",
    label: "分栏",
    icon: "ColumnsOutlined",
    code: "f",
    group: "常用",
    children: COLUMN_COUNTS.map(columnCount),
  },
  {
    id: "callout",
    label: "标注",
    icon: "CalloutOutlined",
    code: "n",
    group: "常用",
    children: CALLOUT_EDIT_TYPES.map(calloutType),
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "> [!NOTE]\n> " };
    },
  },
  {
    id: "data-kanban",
    label: "数据看板",
    icon: "KanbanOutlined",
    group: "数据",
  },
  {
    id: "insert-html",
    label: "插入 HTML",
    icon: "CodeOutlined",
    code: "m",
    group: "绘图",
    insert(state) {
      const head = state.selection.main.head;
      return {
        from: head - 1,
        to: head,
        text: '<div align="center">\n\n</div>',
      };
    },
  },
  {
    id: "insert-css",
    label: "插入 CSS",
    icon: "CssOutlined",
    aliases: ["css"],
    group: "绘图",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "<style>\n\n</style>" };
    },
  },
  {
    id: "flowchart",
    label: "流程图",
    icon: "FlowOutlined",
    group: "绘图",
  },
  {
    id: "task-list",
    label: "任务清单",
    icon: "TodoOutlined",
    group: "团队协作",
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: "- [ ] " };
    },
  },
  {
    id: "toc",
    label: "目录导航",
    icon: "ListOutlined",
    group: "进阶",
  },
  {
    id: "embed-web",
    label: "内嵌网页",
    icon: "BrowserOutlined",
    group: "更多小组件",
  },
];

// 用户片段命令（来自 `list_extensions`）。宿主在编辑器创建后加载一次并注册；
// 菜单每次打开都读这份列表，所以后加载的命令下一次打开即出现，无需重建视图。
let userSlashCommands: SlashCommand[] = [];

/** 注册用户片段命令；传空数组回到纯内置命令。 */
export function setUserSlashCommands(commands: SlashCommand[]): void {
  userSlashCommands = [...commands];
}

/** 内置 + 用户命令。菜单每次打开都取这份最新列表，用户命令后加载也生效。 */
export function getSlashCommands(): SlashCommand[] {
  return [...defaultCommands, ...userSlashCommands];
}

/** 第一个 code/alias 等于 `query` 的根行或子行（可叶子应用）。 */
function findCodeMatch(
  commands: SlashCommand[],
  query: string,
): SlashCommand | null {
  const q = query.toLowerCase();
  for (const cmd of commands) {
    if (
      cmd.code?.toLowerCase() === q ||
      (cmd.aliases ?? []).some((a) => a.toLowerCase() === q)
    ) {
      return cmd;
    }
    for (const child of cmd.children ?? []) {
      if (
        child.code?.toLowerCase() === q ||
        (child.aliases ?? []).some((a) => a.toLowerCase() === q)
      ) {
        return child;
      }
    }
  }
  return null;
}

/** 活动网格选择器：边界 + 将被插入的悬停单元格。 */
interface GridState {
  rows: number;
  cols: number;
  hoverR: number;
  hoverC: number;
}

/** `slash`：用户输入 `/`，菜单拥有 `[slashPos, head]`，取消时必须删掉这段。
 * `anchor`：单元格把手在零宽位置请求插入菜单——没有触发文本也没有过滤词，
 * 取消时不能删字符，别处的文档变动也不能关闭它。光标离开所属单元格才关闭
 * （见 `anchorRange`）。`below`：块把手的「在下方添加」在块后零宽位置请求
 * 同一菜单；和 `anchor` 一样不拥有文本，但插入落在块下方新行，而不是行内，
 * 所以永远不做单元格净化。 */
type SlashMenuTrigger = "slash" | "anchor" | "below";

interface SlashMenuState {
  open: boolean;
  slashPos: number;
  trigger: SlashMenuTrigger;
  /**
   * 锚定菜单所属的单元格范围。范围内的文档变动（组件失焦时重写单元格标记）
   * 不能关闭菜单；光标移出才关闭。斜杠菜单为 null，它靠已输入的过滤词判断。
   */
  anchorRange: { from: number; to: number } | null;
  /** `/` 之后输入的过滤词，从文档推导。 */
  query: string;
  selected: number;
  /** 根行（可能含子菜单入口）。 */
  commands: SlashCommand[];
  /** 当前显示的根行（按 `query` 过滤）。 */
  rows: SlashCommand[];
  /** 浮层里展示子项的那一行，或 null。 */
  submenuParent: SlashCommand | null;
  /** 浮层里显示的子行。 */
  flyoutRows: SlashCommand[];
  /** 浮层内的选中下标。 */
  flyoutSelected: number;
  /** 浮层锚定的父单元格。 */
  parentCell: HTMLElement | null;
  /** 当前根渲染的单元格，与 `rows` 下标对齐。 */
  cells: HTMLElement[];
  /** 活动网格选择器；显示行列表时为 null。 */
  grid: GridState | null;
  dom: HTMLDivElement | null;
  flyoutDom: HTMLDivElement | null;
  /** 根面板在菜单栈里的 token；未入栈为 null。 */
  stackToken: MenuToken | null;
  /** 二级浮层（行浮层 / 网格）在栈里的 token。 */
  flyoutToken: MenuToken | null;
}

const menus = new WeakMap<EditorView, SlashMenuState>();

/** 菜单是否在该视图打开（供其它 keymap 让位）。 */
export function isSlashMenuOpen(view: EditorView): boolean {
  return menus.has(view);
}

/**
 * 宿主注入的文件选择器，按视图存放。编辑器包从不直接碰 DOM file input；
 * 宿主注册一个打开原生选择器并返回所选 File（取消返回 null）的回调。
 */
const pickMediaFiles = new WeakMap<
  EditorView,
  () => Promise<{ name: string; href: string } | null>
>();

/** 为一个视图注册文件选择器。 */
export function registerPickMediaFile(
  view: EditorView,
  pickMediaFile: () => Promise<{ name: string; href: string } | null>,
): void {
  pickMediaFiles.set(view, pickMediaFile);
}

/** 指针从单元格把手移到菜单要穿过编辑器，只靠 `mouseleave` 关闭会在点击前
 * 就拆掉菜单。 */
const ANCHOR_CLOSE_DELAY_MS = 150;
const pendingAnchorCloses = new WeakMap<
  EditorView,
  ReturnType<typeof setTimeout>
>();

function cancelAnchorClose(view: EditorView): void {
  const pending = pendingAnchorCloses.get(view);
  if (pending === undefined) return;
  clearTimeout(pending);
  pendingAnchorCloses.delete(view);
}

function scheduleAnchorClose(view: EditorView): void {
  cancelAnchorClose(view);
  pendingAnchorCloses.set(
    view,
    setTimeout(() => {
      pendingAnchorCloses.delete(view);
      const state = menus.get(view);
      if (state && state.open && state.trigger !== "slash") closeMenu(view);
    }, ANCHOR_CLOSE_DELAY_MS),
  );
}

/**
 * keymap 只问栈顶（design D2 规则 4）：该视图的根面板或浮层必须是栈顶才处理
 * 按键，否则返回 false 把事件让给 CodeMirror 默认行为。
 */
function isActiveLayer(view: EditorView, state: SlashMenuState): boolean {
  const top = menuStack.top(view);
  if (!top) return false;
  return top.element === state.dom || top.element === state.flyoutDom;
}

/** 关闭菜单（根面板 + 浮层），不动文档。 */
function closeMenu(view: EditorView): void {
  cancelAnchorClose(view);
  const state = menus.get(view);
  if (!state) return;
  menus.delete(view);
  if (state.dom && state.dom.parentNode) {
    state.dom.parentNode.removeChild(state.dom);
  }
  if (state.flyoutDom && state.flyoutDom.parentNode) {
    state.flyoutDom.parentNode.removeChild(state.flyoutDom);
  }
  // 先删状态再 pop：pop 会回调 onClose，此时菜单已不在表里，递归立即返回。
  if (state.flyoutToken !== null) {
    const token = state.flyoutToken;
    state.flyoutToken = null;
    menuStack.pop(token);
  }
  if (state.stackToken !== null) {
    const token = state.stackToken;
    state.stackToken = null;
    menuStack.pop(token);
  }
}

/**
 * 按用户预期取消菜单——Escape、点外部、光标离开触发点。面板消失，菜单拥有的
 * 文本（`/` 加已输入过滤词）一并删除，取消绝不留下孤立的 `/`。
 *
 * 关闭先于 dispatch，这样文档变更同步插件看到的是「没有打开的菜单」，不会和
 * 这次事务打架。删除范围止于菜单吸收的最后一个字符，而不是光标：光标可能在
 * 另一行或早于菜单的文本之后，切到 head 会吃掉菜单从未拥有的内容。
 */
function dismissMenu(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open) return;
  if (state.trigger !== "slash") {
    // 锚定与下方菜单不拥有文本：位置是零宽的，可能落在以 `/` 开头的单元格
    // 头部或块边界。取消不能删字符。
    closeMenu(view);
    return;
  }
  const { slashPos } = state;
  // 关闭前读触发符：closeMenu 之后状态就没了，而越界的 slashPos（文档被整体
  // 替换）会让 sliceString 返回 ''。
  const hasTrigger = view.state.doc.sliceString(slashPos, slashPos + 1) === "/";
  const to = Math.min(slashPos + 1 + state.query.length, view.state.doc.length);
  closeMenu(view);
  if (!hasTrigger) return;
  view.dispatch({
    changes: { from: slashPos, to },
    selection: { anchor: slashPos },
  });
}

/** 已排队取消的视图，保证一次光标移动只排一次。 */
const pendingDismissals = new WeakSet<EditorView>();

/**
 * 光标驱动的取消必须离开正在进行的 update 再 dispatch：CodeMirror 拒绝嵌套
 * update 并把它当成插件崩溃吞掉，那会拆掉面板并留下它拥有的 `/`。微任务仍在
 * 下一次绘制前落地，延迟不可见。Escape 和外部 mousedown 保持同步——它们在
 * update 之外运行。状态被捕获，所以期间关闭或重开的菜单不会被过期调用取消。
 */
function scheduleDismiss(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || pendingDismissals.has(view)) return;
  pendingDismissals.add(view);
  queueMicrotask(() => {
    pendingDismissals.delete(view);
    if (menus.get(view) !== state) return;
    dismissMenu(view);
  });
}

/**
 * 根列表始终渲染：`state.grid` / `isFlyoutOpen` 只决定浮层显示哪个面板。
 * 回到网格不能拆掉根列表。
 */
function renderMenu(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  renderRootGrid(view, state);
  // 根列表在二级层下保持挂载，所以这次渲染重建了它的单元格——先重新锚定，
  // 否则浮层会挂在已脱离的 0x0 节点上。
  if (state.grid || isFlyoutOpen(state)) {
    state.parentCell = state.cells[state.selected] ?? null;
  }
  if (state.grid) {
    renderGrid(view, state);
    positionFlyout(view, state);
    return;
  }
  if (isFlyoutOpen(state)) {
    renderFlyout(view, state);
    positionFlyout(view, state);
  }
}

/** 二级浮层存在时为 true。 */
function isFlyoutOpen(state: SlashMenuState): boolean {
  return state.submenuParent !== null && state.flyoutRows.length > 0;
}

/**
 * 根行渲染成单列列表：每个命令一整行（图标 + 标签），在整宽分组标题下。
 * 单列是因为列表同时充当过滤结果面；`data-selected` 跟踪选中。
 */
function renderRootGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  state.dom.textContent = "";
  state.cells = [];

  const grid = document.createElement("div");
  grid.className = "mdb-slash-grid-menu";
  state.dom.appendChild(grid);

  // 分组标题描述浏览布局；过滤时它们只会在无关匹配之间添噪，所以去掉。
  const showGroups = state.query.trim() === "";

  let lastGroup: string | undefined;
  state.rows.forEach((cmd, i) => {
    if (showGroups && cmd.group && cmd.group !== lastGroup) {
      const header = document.createElement("div");
      header.className = "mdb-slash-group";
      header.textContent = cmd.group;
      grid.appendChild(header);
      lastGroup = cmd.group;
    }

    const cell = document.createElement("div");
    cell.className = "mdb-slash-item";
    cell.dataset.cmd = cmd.id;
    if (i === state.selected) {
      cell.setAttribute("data-selected", "true");
    }

    const icon = document.createElement("span");
    icon.className = "mdb-slash-item-icon";
    icon.setAttribute("aria-hidden", "true");
    if (cmd.emoji) {
      icon.textContent = cmd.emoji;
      icon.dataset.glyph = "emoji";
    } else if (cmd.icon) {
      icon.appendChild(renderIcon(cmd.icon));
    }
    cell.appendChild(icon);

    const label = document.createElement("span");
    label.className = "mdb-slash-item-label";
    label.textContent = cmd.label;
    cell.appendChild(label);

    const keybind = slashKeybind(cmd.id);
    if (keybind !== "") {
      const kbd = document.createElement("kbd");
      kbd.className = "mdb-slash-item-kbd";
      kbd.textContent = keybind;
      cell.appendChild(kbd);
    }

    const hasSecondLevel =
      Boolean(cmd.children?.length) || cmd.grid !== undefined;
    if (hasSecondLevel || cmd.hint) {
      const hint = document.createElement("span");
      hint.className = "mdb-slash-item-hint";
      hint.textContent = hasSecondLevel ? "\u25B8" : (cmd.hint ?? "");
      cell.appendChild(hint);
    }

    // 悬停带二级层的行立即打开它。网格行走 `enterGrid`（不重建根列表），
    // 否则在停住的指针下替换 DOM 会反复触发处理器形成渲染循环。
    cell.addEventListener("mouseenter", () => {
      state.selected = i;
      if (cmd.grid) {
        enterGrid(view, cmd, cell);
        return;
      }
      if (cmd.children?.length) {
        enterSubmenu(view, cmd);
        return;
      }
      // 没有二级层的行必须收起上一行打开的面板，否则那个面板会留在本行旁边。
      // 同一时刻只存在一个二级层。
      collapseSecondLevel(state);
    });

    cell.addEventListener("mousedown", (e) => {
      e.preventDefault();
      state.selected = i;
      activateRow(view, cmd);
    });

    grid.appendChild(cell);
    state.cells.push(cell);
  });

  if (state.rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mdb-slash-empty";
    empty.textContent = "无匹配项";
    grid.appendChild(empty);
  }
}

/**
 * 构造 `cols` 列、`rows` 行正文的 GFM 管道表格。单元格起始为空——占位文本
 * （A/B/C、1/2/3/4）会被写进文档，逼用户逐个清空。
 */
function buildTable(cols: number, rows: number): string {
  const line = `| ${Array.from({ length: cols }, () => "").join(" | ")} |`;
  const separator = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
  const body = Array.from({ length: rows }, () => line).join("\n");
  return `${line}\n${separator}\n${body}`;
}

/**
 * 打开网格选择器。与 `backToRoot` 不同，这里故意不动 `rows`——根列表在选择器
 * 下方保持可浏览。
 */
function openGrid(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.grid) return;
  enterGrid(view, cmd, state.cells[state.selected] ?? null);
}

/**
 * 在浮层里显示某行的网格选择器，不重建根列表。悬停和点击都走这里：重建会在
 * 停住的指针下替换单元格，可能反复触发悬停处理器形成循环。调用方传入所属
 * 单元格，这样无论点击还是悬停，选择器都锚在正确的行旁。
 */
function enterGrid(
  view: EditorView,
  cmd: SlashCommand,
  parentCell: HTMLElement | null,
): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.grid) return;
  closeFlyout(state);
  state.grid = {
    rows: cmd.grid.rows,
    cols: cmd.grid.cols,
    hoverR: 1,
    hoverC: 1,
  };
  state.submenuParent = cmd;
  state.parentCell = parentCell ?? state.cells[state.selected] ?? null;
  ensureFlyoutDom(view, state);
  renderGrid(view, state);
  positionFlyout(view, state);
}

/** 渲染 rows×cols 网格选择器，带 N × M 读数与悬停预览。 */
function renderGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.grid) return;
  const grid = state.grid;
  const flyout = ensureFlyoutDom(view, state);
  flyout.textContent = "";
  flyout.dataset.kind = "grid";

  const title = document.createElement("div");
  title.className = "mdb-slash-grid-title";
  title.textContent = "插入支持富文本的表格";
  flyout.appendChild(title);

  const label = document.createElement("div");
  label.className = "mdb-slash-grid-label";
  label.textContent = `${grid.hoverR} \u00d7 ${grid.hoverC}`;
  flyout.appendChild(label);

  const wrap = document.createElement("div");
  wrap.className = "mdb-slash-grid";
  wrap.style.gridTemplateColumns = `repeat(${grid.cols}, 18px)`;

  const paint = (r: number, c: number): void => {
    for (const el of Array.from(wrap.children) as HTMLElement[]) {
      const on = Number(el.dataset.r) <= r && Number(el.dataset.c) <= c;
      el.setAttribute("data-on", on ? "true" : "false");
    }
  };

  for (let r = 1; r <= grid.rows; r++) {
    for (let c = 1; c <= grid.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "mdb-slash-grid-cell";
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.setAttribute("data-on", r <= 1 && c <= 1 ? "true" : "false");
      cell.addEventListener("mouseenter", () => {
        grid.hoverR = r;
        grid.hoverC = c;
        label.textContent = `${r} \u00d7 ${c}`;
        paint(r, c);
      });
      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applyTableSize(view, state, c, r);
      });
      wrap.appendChild(cell);
    }
  }
  flyout.appendChild(wrap);
}

function openMenu(
  view: EditorView,
  slashPos: number,
  commands: SlashCommand[],
  trigger: SlashMenuTrigger = "slash",
  anchorRange: { from: number; to: number } | null = null,
  anchorRect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null = null,
): void {
  // 每个视图只允许一个菜单层：先收掉旧的，避免旧 token 留在栈里。
  if (menus.has(view)) closeMenu(view);
  const menu = document.createElement("div");
  menu.className = "mdb-slash-menu";
  menu.dataset.testid = "slash-menu";
  // 与转换菜单同宽（#373）：两个菜单在同一位形互相替换，宽度不同会让人重新找目标。
  menu.style.width = `${MENU_WIDTH}px`;
  menu.addEventListener("mouseenter", () => cancelAnchorClose(view));
  menu.addEventListener("mouseleave", () => {
    const current = menus.get(view);
    if (current && current.trigger !== "slash") scheduleAnchorClose(view);
  });

  const state: SlashMenuState = {
    open: true,
    slashPos,
    trigger,
    anchorRange,
    query: "",
    selected: 0,
    commands,
    rows: commands,
    submenuParent: null,
    flyoutRows: [],
    flyoutSelected: 0,
    parentCell: null,
    cells: [],
    grid: null,
    dom: menu,
    flyoutDom: null,
    stackToken: null,
    flyoutToken: null,
  };
  menus.set(view, state);
  renderMenu(view, state);

  if (view.dom.style.position === "static" || view.dom.style.position === "") {
    view.dom.style.position = "relative";
  }
  view.dom.appendChild(menu);
  state.stackToken = menuStack.push({
    id: `slash:${trigger}:${slashPos}`,
    owner: null,
    element: menu,
    scope: view,
    onClose: () => closeMenu(view),
  });
  if (anchorRect) {
    // 块把手的「在下方添加」向右展开（#456）；表格单元格锚点仍向下开。
    positionMenuAtRect(
      view,
      menu,
      anchorRect,
      trigger === "below" ? "right" : "below",
    );
  } else positionMenu(view, menu, slashPos, trigger);
}

/**
 * `openMenu` 的锚定版，供表格单元格与块把手的「在下方添加」使用。先拆掉任何
 * 已打开的菜单：旧面板会继续绑在这个视图上却已脱离文档。`trigger` 默认
 * `anchor`（表格单元格路径不变）；块把手传 `below`。
 */
export function openInsertMenu(
  view: EditorView,
  at: number,
  commands: SlashCommand[],
  anchorRange: { from: number; to: number },
  trigger: SlashMenuTrigger = "anchor",
  anchorRect?: { left: number; right: number; top: number; bottom: number },
): void {
  cancelAnchorClose(view);
  closeMenu(view);
  // GFM 单元格只有一行：块级模板（标题/列表/表格/分栏…）进了单元格会被压平
  // 成一行文本或直接破坏表格，所以单元格菜单只列行内命令。
  const offered =
    trigger === "anchor"
      ? commands.filter((cmd) => cmd.inline === true)
      : commands;
  openMenu(view, at, offered, trigger, anchorRange, anchorRect);
}

/**
 * 丢掉锚定/下方菜单而不动文档。用于打开它的组件消失（销毁、模式切换）或指针
 * 离开触发点却没进入菜单——等悬停宽限期结束会在另一个视图上留下孤儿面板。
 *
 * `only` 把释放限制在一种触发源：表格单元格菜单是 `anchor`，块把手是
 * `below`，所以块把手的收起不能拆掉指针只是路过的表格单元格菜单。
 */
export function releaseInsertMenu(
  view: EditorView,
  only?: "anchor" | "below",
): void {
  const trigger = menus.get(view)?.trigger;
  if (trigger !== "anchor" && trigger !== "below") return;
  if (only !== undefined && trigger !== only) return;
  closeMenu(view);
}

/**
 * 把锚定面板放在调用方给出的矩形旁（表格单元格把手 / 锚点）。面板裁剪用
 * `overflow:hidden`，所以夹取用 `.cm-editor` 而不是 `view.dom`。
 */
/** 视口矩形（D4 规则 3 的 viewportRect）。 */
function viewportRect(): AnchorRect {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { left: 0, top: 0, right: width, bottom: height, width, height };
}

/** DOM 矩形 → AnchorRect。 */
function boxRect(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}): AnchorRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/** 统一摆放并写回面板样式（相对 view.dom 的绝对定位）。 */
function applyPlacement(
  view: EditorView,
  menu: HTMLDivElement,
  anchor: AnchorRect,
  align: "below" | "right" = "below",
): void {
  const own = view.dom.getBoundingClientRect();
  const bounds = intersectRects(viewportRect(), boxRect(own));
  // 先封顶高度再量：超高菜单按自然高度参与落位，所有候选项都会「放不下」，
  // 结果被夹到视口顶部，看起来像没有跟随锚点。
  menu.style.maxHeight = `${Math.max(
    120,
    Math.min(PANEL_MAX_HEIGHT, bounds.height - 16),
  )}px`;
  const menuRect = menu.getBoundingClientRect();
  const placement = placeMenu(
    anchor,
    {
      width: menuRect.width || menu.offsetWidth || 220,
      height: menuRect.height || menu.offsetHeight || 0,
    },
    bounds,
    8,
    align,
  );
  menu.style.left = `${placement.left - own.left}px`;
  menu.style.top = `${placement.top - own.top}px`;
}

function positionMenuAtRect(
  view: EditorView,
  menu: HTMLDivElement,
  anchor: { left: number; right: number; top: number; bottom: number },
  align: "below" | "right" = "below",
): void {
  try {
    applyPlacement(
      view,
      menu,
      {
        left: anchor.left,
        top: anchor.top,
        right: anchor.right,
        bottom: anchor.bottom,
        width: anchor.right - anchor.left,
        height: anchor.bottom - anchor.top,
      },
      align,
    );
  } catch {
    // 忽略——jsdom / 未测量的内容
  }
}

function positionMenu(
  view: EditorView,
  menu: HTMLDivElement,
  slashPos: number,
  trigger: SlashMenuTrigger,
): void {
  try {
    const coords = view.coordsAtPos(
      trigger === "anchor" ? slashPos : slashPos + 1,
    );
    if (!coords) return;
    applyPlacement(view, menu, rectFromCoords(coords, 0));
  } catch {
    // 忽略——jsdom / 未测量的内容
  }
}

function replaceTrigger(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): void {
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

/**
 * 媒体选择行被取消或没有注入选择器时，移除 `/query` 触发范围。与
 * `dismissMenu` 的斜杠清理一致，但在 `closeMenu` 已拆掉菜单状态之后运行。
 */
function removeSlashTrigger(
  view: EditorView,
  from: number,
  query: string,
): void {
  const to = Math.min(from + 1 + query.length, view.state.doc.length);
  const hasTrigger = view.state.doc.sliceString(from, from + 1) === "/";
  if (!hasTrigger) return;
  replaceTrigger(view, from, to, "");
}

/**
 * markdown 链接目标：含空格或括号时必须用 `<...>` 包住。
 *
 * 文件名里的空格会让 `![x](assets/a b.mp4)` 整段退化成普通文本——预览里
 * 看到的就是一行 markdown 源码（#103 后续）。CommonMark 用尖括号解决。
 */
export function markdownDestination(href: string): string {
  return /[\s()<>]/.test(href) ? `<${href}>` : href;
}

function applyCommand(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  const trigger = state?.trigger ?? "slash";
  // 媒体选择行委托给宿主文件选择器，而不是插入静态占位文本。选中文件名变成
  // 可编辑的 `![name](name.ext)` 引用，宿主同时把它导入为资源。
  if (cmd.pickMedia) {
    const pickMediaFile = pickMediaFiles.get(view);
    const anchored = trigger === "anchor";
    const below = trigger === "below";
    const head = view.state.selection.main.head;
    const from = state ? state.slashPos : head - 1;
    const query = state?.query ?? "";
    // 先关闭，这样选择器异步返回后 dispatch 插入时，文档变更同步插件不会打架。
    closeMenu(view);
    if (!pickMediaFile) {
      // 宿主没接选择器：不留 `/query` 残留，也不插入任何东西。
      if (trigger === "slash") removeSlashTrigger(view, from, query);
      return;
    }
    // 锚定或下方插入是基于位置的（在锚点零宽插入），不能被恰好停在它之前的
    // 光标挡住：表格单元格菜单靠悬停把手打开，从不移动光标。只有斜杠插入
    // （替换 `[slashPos, head]`）是基于光标的。
    if (!anchored && !below && head < from) return;
    void pickMediaFile().then((picked) => {
      if (!picked) {
        if (trigger === "slash") removeSlashTrigger(view, from, query);
        return;
      }
      const ref = `![${picked.name}](${markdownDestination(picked.href)})`;
      if (anchored) {
        // 单元格插入必须保持单行，否则会拆开表格行。
        replaceTrigger(view, from, from, sanitizeCellText(ref));
        return;
      }
      if (below) {
        replaceTrigger(view, from, from, `\n${ref}`);
        return;
      }
      // 斜杠：替换 `[slashPos, head]`——`/` 加上已输入的过滤词。
      replaceTrigger(view, from, head, ref);
    });
    return;
  }
  // 纯保真行没有 insert；收起时不泄漏 `/query`。
  if (!cmd.insert) {
    if (trigger === "slash") dismissMenu(view);
    else closeMenu(view);
    return;
  }
  const anchored = trigger === "anchor";
  const below = trigger === "below";
  const head = view.state.selection.main.head;
  // `/` 加已输入过滤词是一个可替换范围；命令的 `insert` 只给替换文本。
  const from = state ? state.slashPos : head - 1;
  // 先关闭，这样即将 dispatch 的事务不会和文档变更同步插件打架。
  closeMenu(view);
  if (head < from && !below) return;
  if (anchored) {
    // 菜单只会给出 `inline` 命令（见 openInsertMenu），所以这里一定插进单元格。
    // 早前把所有块级模板挪到表格下方，用户点完菜单会看到内容凭空出现在表外。
    const raw = cmd.insert(view.state).text;
    const text = sanitizeCellText(raw);
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    return;
  }
  if (below) {
    // 菜单从「在下方添加」打开：在块后新起一行并保持模板完整（不做单元格
    // 净化，那会剥掉表格或高亮块需要的换行和管道符）。
    const text = `\n${cmd.insert(view.state).text}`;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    return;
  }
  const change = cmd.insert(view.state);
  // `text` 是我们的接口字段；CM6 ChangeSpec 的字段是 `insert`。
  view.dispatch({
    changes: { from, to: head, insert: change.text },
    selection: { anchor: from + change.text.length },
    scrollIntoView: true,
  });
}

/**
 * 在显式位置插入某命令的 markdown，不经过斜杠菜单及其状态。`below` 保持模板
 * 完整并另起一行；否则净化成单行以适配表格单元格锚点。
 */
export function insertCommandTextAt(
  view: EditorView,
  commandId: string,
  at: number,
  mode: "below" | "inline" = "below",
): boolean {
  const cmd = defaultCommands.find((entry) => entry.id === commandId);
  if (!cmd) return false;
  closeMenu(view);
  // 网格/子菜单行没有直接的 `insert`：浮层选一个默认值，而不是什么都不做，
  // 这样「在下方添加」的每一行都有实际效果。
  const raw = cmd.insert
    ? cmd.insert(view.state).text
    : cmd.grid
      ? "|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |"
      : cmd.children?.[0]?.insert?.(view.state).text;
  if (raw === undefined) return false;
  const text = mode === "below" ? `\n${raw}` : sanitizeCellText(raw);
  view.dispatch({
    changes: { from: at, to: at, insert: text },
    selection: { anchor: at + text.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * 包含 `pos` 的表格最后一行 `|` 之后的偏移。只扫描表格自己的行，所以从单元格
 * 发起的块级插入落在表格之后，而不是拆开某一行。
 */
function endOfTableBlock(state: EditorState, pos: number): number {
  const doc = state.doc;
  const isRow = (lineNumber: number): boolean =>
    doc.line(lineNumber).text.trim().startsWith("|");
  let first = doc.lineAt(pos).number;
  while (first > 1 && isRow(first - 1)) first -= 1;
  let last = doc.lineAt(pos).number;
  while (last < doc.lines && isRow(last + 1)) last += 1;
  return doc.line(last).to;
}

/** 激活一行：打开它的浮层或网格，或应用它的插入。 */
function activateRow(view: EditorView, cmd: SlashCommand): void {
  if (cmd.grid) {
    openGrid(view, cmd);
    return;
  }
  if (cmd.children && cmd.children.length > 0) {
    enterSubmenu(view, cmd);
    return;
  }
  applyCommand(view, cmd);
}

/** 在行的单元格旁打开二级浮层；根列表原地不动。 */
function enterSubmenu(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.children?.length) return;
  // 网格选择器也是二级层：显示本行浮层前先收起它，与 ArrowLeft/backToRoot
  // 路径一致。否则网格打开时悬停到另一个二级行会是静默无操作。
  collapseSecondLevel(state);
  state.submenuParent = cmd;
  state.flyoutRows = cmd.children;
  state.flyoutSelected = 0;
  state.parentCell = state.cells[state.selected] ?? null;

  ensureFlyoutDom(view, state);
  renderFlyout(view, state);
  positionFlyout(view, state);
}

function ensureFlyoutDom(
  view: EditorView,
  state: SlashMenuState,
): HTMLDivElement {
  if (!state.flyoutDom) {
    const flyout = document.createElement("div");
    flyout.className = "mdb-slash-flyout";
    // 浮层是同级层而不是根列表的子元素，指针进入时确实离开了根菜单。与根菜单
    // 相同的 mouseenter/mouseleave 宽限让面板在整条「根 → 浮层 → 行」路径上存活。
    flyout.addEventListener("mouseenter", () => cancelAnchorClose(view));
    flyout.addEventListener("mouseleave", () => {
      if (menus.get(view)?.trigger === "anchor") scheduleAnchorClose(view);
    });
    state.flyoutDom = flyout;
  }
  if (state.flyoutDom.parentNode !== view.dom) {
    view.dom.appendChild(state.flyoutDom);
  }
  if (state.flyoutToken === null) {
    state.flyoutToken = menuStack.push({
      id: `slash-flyout:${state.slashPos}`,
      owner: null,
      element: state.flyoutDom,
      scope: view,
      onClose: () => closeFlyout(state),
    });
  }
  return state.flyoutDom;
}

/** 关闭二级浮层；根列表和过滤词保持原样。 */
function closeFlyout(state: SlashMenuState): void {
  if (state.flyoutDom?.parentNode) {
    state.flyoutDom.parentNode.removeChild(state.flyoutDom);
  }
  if (state.flyoutToken !== null) {
    const token = state.flyoutToken;
    state.flyoutToken = null;
    menuStack.pop(token);
  }
  state.submenuParent = null;
  state.flyoutRows = [];
  state.flyoutSelected = 0;
  state.parentCell = null;
}

/**
 * 拆掉当前打开的二级层（行浮层或网格选择器），根列表保持挂载。悬停路径共用：
 * 没有二级层的行，或另一个二级行，都不会留下上一个面板。
 */
function collapseSecondLevel(state: SlashMenuState): void {
  closeFlyout(state);
  state.grid = null;
}

/** 渲染浮层行，标记键盘选中。 */
function renderFlyout(view: EditorView, state: SlashMenuState): void {
  if (!state.flyoutDom) return;
  state.flyoutDom.textContent = "";
  delete state.flyoutDom.dataset.kind;
  state.flyoutRows.forEach((cmd, i) => {
    const row = document.createElement("div");
    row.className = "mdb-slash-flyout-item";
    row.dataset.cmd = cmd.id;
    if (i === state.flyoutSelected) {
      row.setAttribute("data-selected", "true");
    }

    const icon = document.createElement("span");
    icon.className = "mdb-slash-flyout-icon";
    icon.setAttribute("aria-hidden", "true");
    if (cmd.emoji) {
      icon.textContent = cmd.emoji;
      icon.dataset.glyph = "emoji";
    } else if (cmd.icon) {
      icon.appendChild(renderIcon(cmd.icon));
    }
    row.appendChild(icon);

    const label = document.createElement("span");
    label.className = "mdb-slash-flyout-label";
    label.textContent = cmd.label;
    row.appendChild(label);

    const keybind = slashKeybind(cmd.id);
    if (keybind !== "") {
      const kbd = document.createElement("kbd");
      kbd.className = "mdb-slash-flyout-kbd";
      kbd.textContent = keybind;
      row.appendChild(kbd);
    }

    const hint = document.createElement("span");
    hint.className = "mdb-slash-flyout-hint";
    hint.textContent = cmd.hint ?? "";
    row.appendChild(hint);

    row.addEventListener("mouseenter", () => {
      if (state.flyoutSelected === i) return;
      state.flyoutSelected = i;
      highlightFlyout(state);
    });

    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      state.flyoutSelected = i;
      activateRow(view, cmd);
    });

    state.flyoutDom!.appendChild(row);
  });
}

/** 原地移动浮层高亮；悬停时重建行会抖动。 */
function highlightFlyout(state: SlashMenuState): void {
  if (!state.flyoutDom) return;
  const rows = state.flyoutDom.querySelectorAll<HTMLElement>(
    ".mdb-slash-flyout-item",
  );
  rows.forEach((row, index) => {
    const active = index === state.flyoutSelected;
    if (active) row.setAttribute("data-selected", "true");
    else row.removeAttribute("data-selected");
  });
}

/**
 * 把浮层放在父单元格旁：到编辑器窗格右缘时翻到单元格左侧，到视口底部时夹取
 * 上下位置。坐标配方与 `positionMenu` 相同（视口坐标减编辑器原点）。
 */
function positionFlyout(view: EditorView, state: SlashMenuState): void {
  const flyout = state.flyoutDom;
  const anchor = state.parentCell;
  if (!flyout || !anchor) return;
  try {
    const cellRect = anchor.getBoundingClientRect();
    const editorRect = view.dom.getBoundingClientRect();
    const flyoutRect = flyout.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let leftV = cellRect.right + 4;
    if (leftV + flyoutRect.width > editorRect.right - 8) {
      leftV = Math.max(
        editorRect.left + 8,
        cellRect.left - flyoutRect.width - 4,
      );
    }
    let topV = cellRect.top;
    if (topV + flyoutRect.height > viewportH - 8) {
      topV = Math.max(8, viewportH - 8 - flyoutRect.height);
    }

    flyout.style.left = `${leftV - editorRect.left}px`;
    flyout.style.top = `${topV - editorRect.top}px`;
    flyout.style.maxHeight = `${Math.max(120, viewportH - 8 - topV)}px`;
  } catch {
    // 忽略——jsdom / 未测量的内容
  }
}

/**
 * 离开网格选择器。根列表在下面保持挂载，所以这里只拆浮层。在此重建根列表会
 * 替换停住指针下的行并触发合成重悬停，立刻又打开网格。
 */
function backToRoot(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !state.grid) return;
  closeFlyout(state);
  state.grid = null;
}

/**
 * 模块级 IME 组合守卫。由 slashKeymap 的 ViewPlugin 事件处理器写入，
 * insertSlashChar 读取以在组合期跳过。
 */
let slashComposing = false;

/**
 * 事务注解：请求在指定位置打开斜杠菜单。
 *
 * 全角标点归一（`／` / `、` → `/`）在 transactionFilter 里挂上，smart-input
 * 的 ViewPlugin 读取后调用 `openSlashMenuAt`。用注解而不是在过滤器里直接开
 * 菜单：transactionFilter 拿不到 view，且菜单必须在事务落地后打开才能按 `/`
 * 的位置测量坐标。
 */
export const slashMenuRequest = Annotation.define<number>();

/**
 * 处理输入 `/`。在光标处打开命令菜单。菜单已打开时（连续第二个斜杠）
 * 关闭它并返回 false，让 keymap 落到默认行为——不重复开菜单，不重复插入。
 *
 * 只在以下条件触发：
 * - 光标在词首（行内它之前没有内容，或紧邻的前一个字符是空白）。
 * - IME 不在组合中（直接 keymap 路径；compositionend 路径单独处理已提交的斜杠）。
 *
 * 全角 `／` 与顿号 `、` 不经过这里：它们由 `smart-input` 的
 * `fullwidthPunctuation` 先归一成 `/`，再经 `slashMenuRequest` 打开菜单。
 */
export function insertSlashChar(
  view: EditorView,
  commands?: SlashCommand[],
): boolean {
  if (slashComposing) return false;

  const current = menus.get(view);
  if (current?.open) {
    closeMenu(view);
    return false;
  }

  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const textBeforeCursor = line.text.slice(0, head - line.from);

  // 词首触发：行首到光标必须为空或以空白结尾。紧跟在非空白字符后输入斜杠
  // （词中）绝不能打开菜单。
  if (textBeforeCursor.length > 0 && !/\s$/.test(textBeforeCursor))
    return false;

  view.dispatch({
    changes: { from: head, insert: "/" },
    selection: { anchor: head + 1 },
  });
  // dispatch 之后再打开，避免 ViewPlugin 的文档变更关闭器立刻把它关掉。
  openMenu(view, head, commands ?? getSlashCommands());
  return true;
}

/**
 * 在当前光标处打开斜杠菜单，不插入斜杠。用于 IME 组合已经插入斜杠的情形。
 */
export function openSlashMenuAtCursor(
  view: EditorView,
  commands?: SlashCommand[],
): void {
  const head = view.state.selection.main.head;
  openMenu(view, head, commands ?? getSlashCommands());
}

/**
 * 在已经存在的 `/` 位置打开斜杠菜单（不插入字符）。供全角标点归一
 * （`／` / `、` → `/`）在事务落地后调用。
 */
export function openSlashMenuAt(
  view: EditorView,
  slashPos: number,
  commands?: SlashCommand[],
): void {
  openMenu(view, slashPos, commands ?? getSlashCommands());
}

/** ArrowDown：移动浮层选中，或根列表选中，向下。 */
export function slashMenuSelectNext(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !isActiveLayer(view, state)) return false;
  if (state.grid) return true;
  if (isFlyoutOpen(state)) {
    state.flyoutSelected = Math.min(
      state.flyoutSelected + 1,
      state.flyoutRows.length - 1,
    );
    renderFlyout(view, state);
    return true;
  }
  state.selected = Math.min(state.selected + 1, state.rows.length - 1);
  renderRootGrid(view, state);
  return true;
}

/** ArrowUp：移动浮层选中，或根列表选中，向上。 */
export function slashMenuSelectPrev(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !isActiveLayer(view, state)) return false;
  if (state.grid) return true;
  if (isFlyoutOpen(state)) {
    state.flyoutSelected = Math.max(state.flyoutSelected - 1, 0);
    renderFlyout(view, state);
    return true;
  }
  state.selected = Math.max(state.selected - 1, 0);
  renderRootGrid(view, state);
  return true;
}

/**
 * 插入悬停的尺寸（网格选择器打开时），否则激活选中行——浮层打开就是选中的
 * 子项，否则是选中的根行（它本身可能再开浮层或网格）。
 */
function applyTableSize(
  view: EditorView,
  state: SlashMenuState,
  cols: number,
  rows: number,
): void {
  const head = view.state.selection.main.head;
  const from = state.slashPos;
  const anchored = state.trigger === "anchor";
  const below = state.trigger === "below";
  const table = buildTable(cols, rows);
  // 单元格内锚定：表格保持单行，不能拆开行。块下方：完整保留在独立新行。
  const text = anchored
    ? sanitizeCellText(table)
    : below
      ? `\n${table}`
      : table;
  closeMenu(view);
  if (head < from && !below) return;
  view.dispatch({
    changes: { from, to: anchored || below ? from : head, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

/** Enter：应用选中行（网格打开时插入悬停尺寸）。 */
export function slashMenuApply(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !isActiveLayer(view, state)) return false;
  if (state.grid) {
    applyTableSize(view, state, state.grid.hoverC, state.grid.hoverR);
    return true;
  }
  const tableSize = TABLE_SIZE_QUERY.exec(state.query);
  if (!isFlyoutOpen(state) && tableSize) {
    const rows = tableSize[2] !== undefined ? Number(tableSize[2]) : 1;
    applyTableSize(view, state, Number(tableSize[1]), rows);
    return true;
  }
  if (!isFlyoutOpen(state) && state.query !== "") {
    const codeMatch = findCodeMatch(state.commands, state.query);
    if (codeMatch && !codeMatch.children?.length && !codeMatch.grid) {
      applyCommand(view, codeMatch);
      return true;
    }
  }
  const cmd = isFlyoutOpen(state)
    ? state.flyoutRows[state.flyoutSelected]
    : state.rows[state.selected];
  if (!cmd) return false;
  activateRow(view, cmd);
  return true;
}

/** ArrowRight：选中行有子项时打开它的浮层。 */
export function slashMenuSubmenuEnter(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !isActiveLayer(view, state)) return false;
  if (isFlyoutOpen(state)) return false;
  const cmd = state.rows[state.selected];
  if (cmd?.grid) {
    openGrid(view, cmd);
    return true;
  }
  // `enterSubmenu` 先收起已打开的网格，所以从网格行按 ArrowRight 到有子项的
  // 兄弟行会切到那个浮层，而不是无操作。
  if (!cmd?.children?.length) return false;
  enterSubmenu(view, cmd);
  return true;
}

/** ArrowLeft：关闭打开的浮层，或离开网格选择器。 */
export function slashMenuSubmenuBack(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !isActiveLayer(view, state)) return false;
  if (isFlyoutOpen(state)) {
    closeFlyout(state);
    return true;
  }
  if (state.grid) {
    backToRoot(view);
    return true;
  }
  return false;
}

/** Escape：收起菜单，触发文本一并带走（无残留）。 */
export function slashMenuClose(view: EditorView): boolean {
  // 块菜单也可能是栈顶：Esc 先收它，再轮到斜杠菜单。
  const top = menuStack.top(view);
  if (top !== null && top.id.startsWith("block:")) {
    menuStack.closeAll(
      "escape",
      (entry) => entry.scope === view && entry.id.startsWith("block:"),
    );
    return true;
  }
  const state = menus.get(view);
  if (!state?.open || !isActiveLayer(view, state)) return false;
  dismissMenu(view);
  return true;
}

/**
 * 读取 `/` 之后输入的过滤词：`slashPos + 1` 到光标之间的字符。文档不再像
 * 打开的菜单时（斜杠被删、光标移到它之前、输入了换行）返回 null，调用方
 * 随即关闭菜单。
 */
function readQuery(
  state: SlashMenuState,
  editorState: EditorState,
): string | null {
  const head = editorState.selection.main.head;
  if (head < state.slashPos + 1) return null;
  const text = editorState.doc.sliceString(state.slashPos, head);
  if (!text.startsWith("/")) return null;
  const query = text.slice(1);
  if (query.includes("\n")) return null;
  return query;
}

/** 应用文档推导的过滤词；输入会关闭已打开的浮层。 */
function applyQuery(
  view: EditorView,
  state: SlashMenuState,
  query: string,
): void {
  closeFlyout(state);
  state.query = query;
  state.rows = filterSlashCommands(state.commands, query);
  state.selected = Math.min(state.selected, Math.max(0, state.rows.length - 1));
  renderMenu(view, state);
}

/** 光标仍停在 `/${state.query}` 末尾时为 true。 */
function isCaretAtQueryEnd(
  state: SlashMenuState,
  editorState: EditorState,
): boolean {
  return (
    editorState.selection.main.head === state.slashPos + 1 + state.query.length
  );
}

/**
 * 让打开的菜单与文档保持同步：
 * - 过滤词输入（`/` 之后、光标之前的字符）更新过滤，而不是关闭菜单——那些
 *   字符就是查询缓冲，不能触发旧的「任何文档变更都关闭」规则。
 * - 其他文档变更（换行、斜杠被删、别处编辑）关闭菜单。
 * - 光标离开触发点时菜单随之收起，放弃触发点绝不留下孤立的 `/`。
 * - IME 组合期间菜单保持不动：组合既不能关闭菜单，也不能选中命令。
 */
/**
 * 滚动即收（design D4 规则 4）：编辑器滚动容器一滚，收起本视图作用域内的
 * 全部浮层。按作用域收，分栏的另一个面板不受影响。
 */
const resizeReposition = ViewPlugin.define((view) => {
  const reposition = (): void => {
    const state = menus.get(view);
    if (!state?.open || !state.dom) return;
    positionMenu(view, state.dom, state.slashPos, state.trigger);
    if (state.flyoutDom && isFlyoutOpen(state)) positionFlyout(view, state);
  };
  window.addEventListener("resize", reposition);
  window.visualViewport?.addEventListener("resize", reposition);
  return {
    destroy(): void {
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
    },
  };
});

const scrollDismiss = ViewPlugin.define((view) => {
  const onScroll = (): void => {
    if (menuStack.top(view) === null) return;
    menuStack.closeScope(view, "scroll");
  };
  view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
  return {
    destroy(): void {
      view.scrollDOM.removeEventListener("scroll", onScroll);
    },
  };
});

const menuSyncPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    const state = menus.get(u.view);
    if (!state?.open || slashComposing) return;
    // 锚定与下方菜单没有输入触发符也没有过滤词。表格组件失焦时重写自己的
    // 单元格标记，块把手菜单由文档外部驱动，所以文档变更一律忽略。光标离开
    // 所属范围才关闭面板，这样焦点移走后它不会滞留。
    if (state.trigger !== "slash") {
      if (u.selectionSet && state.anchorRange) {
        const caret = u.state.selection.main.head;
        if (caret < state.anchorRange.from || caret > state.anchorRange.to) {
          closeMenu(u.view);
        }
      }
      return;
    }
    if (u.docChanged) {
      if (!state.grid) {
        const query = readQuery(state, u.state);
        if (query !== null) {
          applyQuery(u.view, state, query);
          return;
        }
      }
      // 文档驱动的失效：那些按键是用户自己的文本，不是我们的取消，所以菜单
      // 关闭但文档不动。
      closeMenu(u.view);
      return;
    }
    if (u.selectionSet && !isCaretAtQueryEnd(state, u.state))
      scheduleDismiss(u.view);
  },
  destroy(): void {
    closeMenu(view);
  },
}));

/**
 * 跟踪斜杠菜单的 IME 组合状态。写入 slashComposing，让 insertSlashChar 在
 * 组合期跳过（避免全角 `/` 触发菜单）。compositionend 时若提交的文本是斜杠
 * （ASCII 或全角），触发菜单。用 document 上的捕获阶段监听，即使事件派发在
 * document 而不是 contentDOM 上也能捕获。
 */
const slashCompositionGuard = ViewPlugin.define((view) => {
  const onCompositionStart = (): void => {
    slashComposing = true;
  };
  const onCompositionEnd = (event: CompositionEvent): void => {
    const data = event.data ?? "";
    slashComposing = false;
    // 只响应提交在「本」编辑器内的组合。真实 IME 在 contentDOM（view.dom 内）
    // 派发；无关输入（例如分享昵称框）提交的斜杠不能弹出本编辑器的菜单。
    const target = event.target as Node | null;
    if (target !== null && target !== document && !view.dom.contains(target))
      return;
    // 提交文本是 ASCII 斜杠时触发菜单：斜杠已由浏览器/输入法插入，这里只在
    // 当前光标处打开菜单。全角 `／` 与顿号 `、` 不走这里——它们由 smart-input
    // 的 fullwidthPunctuation 归一成 `/` 后经 slashMenuRequest 开菜单，
    // 两条路径同时开会重复打开。
    if (data === "/") {
      openSlashMenuAtCursor(view);
    }
  };
  document.addEventListener("compositionstart", onCompositionStart, true);
  document.addEventListener("compositionend", onCompositionEnd, true);
  return {
    destroy(): void {
      document.removeEventListener(
        "compositionstart",
        onCompositionStart,
        true,
      );
      document.removeEventListener("compositionend", onCompositionEnd, true);
    },
  };
});

/**
 * 菜单外的 mousedown 收起菜单，触发文本一并带走。捕获阶段，让收起先于 CM6
 * 自己的 mousedown 处理；包含判断保证落在面板本身的按压照常工作。
 */
const outsideClickDismiss = ViewPlugin.define((view) => {
  const onMouseDown = (event: MouseEvent): void => {
    const target = event.target;
    const inRegisteredLayer =
      target instanceof Node && menuStack.containsElement(target);
    const inTriggerChrome =
      target instanceof Element &&
      target.closest(
        ".cm-table-cell-handle, .mdb-block-handle-menu, .mdb-block-handle",
      ) !== null;

    // 块菜单可能是唯一打开的层：即使没有斜杠菜单，外部点击也要收起。
    if (!inRegisteredLayer && !inTriggerChrome) {
      menuStack.closeAll(
        "outside",
        (entry) => entry.scope === view && entry.id.startsWith("block:"),
      );
    }

    const state = menus.get(view);
    if (!state?.open) return;
    if (
      target instanceof Node &&
      (state.dom?.contains(target) ||
        state.flyoutDom?.contains(target) ||
        inTriggerChrome)
    ) {
      return;
    }
    if (state.trigger !== "slash") {
      closeMenu(view);
      return;
    }
    dismissMenu(view);
  };
  document.addEventListener("mousedown", onMouseDown, true);
  return {
    destroy(): void {
      document.removeEventListener("mousedown", onMouseDown, true);
    },
  };
});

/**
 * 接线斜杠菜单的 keymap 扩展。返回 `Prec.high(...)`，绑定优先于
 * `defaultKeymap`；菜单关闭时每个绑定都返回 false，保留 CodeMirror 默认行为。
 */
export function slashKeymap(
  options: { commands?: SlashCommand[] } = {},
): Extension {
  return [
    Prec.high(
      keymap.of([
        {
          key: "/",
          // 不设 `scope`——CM6 默认 keydown 处理器只跑 "editor" 作用域；自定义
          // 作用域（如 "typing"）会让这个绑定不可达。默认作用域在编辑器聚焦时生效。
          // `options.commands` 原样下传：打开菜单时才解析，用户命令后加载无需重建视图。
          run: (view) => insertSlashChar(view, options.commands),
        },
        { key: "ArrowDown", run: (view) => slashMenuSelectNext(view) },
        { key: "ArrowUp", run: (view) => slashMenuSelectPrev(view) },
        { key: "ArrowRight", run: (view) => slashMenuSubmenuEnter(view) },
        { key: "ArrowLeft", run: (view) => slashMenuSubmenuBack(view) },
        { key: "Enter", run: (view) => slashMenuApply(view) },
        { key: "Escape", run: (view) => slashMenuClose(view) },
      ]),
    ),
    menuSyncPlugin,
    resizeReposition,
    scrollDismiss,
    slashCompositionGuard,
    outsideClickDismiss,
  ];
}

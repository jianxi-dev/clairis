/* 高亮块内的插入菜单（移植自 md-bundle packages/editor/src/decorations/callout-insert.ts，
 * #468）。
 *
 * 高亮块正文是 `<textarea>`，不是 CM6 文档文本，所以编辑器自己的斜杠菜单打不开：
 * 按 `/` 会落到文档、把内容插到卡片上方。本模块给卡片一个同款命令词表的小菜单，
 * 把对应 Markdown 片段插到 textarea 光标处，而不是派发到文档。
 */
import { renderIcon } from "../icons";

/** 菜单里一行：插到光标处的 Markdown 片段。 */
export interface CalloutInsertSnippet {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** 替换已输入 `/query` 的文本。 */
  readonly snippet: string;
}

export const CALLOUT_SNIPPETS: readonly CalloutInsertSnippet[] = [
  {
    id: "paragraph",
    label: "正文",
    icon: "FormatParagraphOutlined",
    snippet: "",
  },
  { id: "heading", label: "标题", icon: "H2Outlined", snippet: "## " },
  { id: "task", label: "任务", icon: "TodoOutlined", snippet: "- [ ] " },
  { id: "list", label: "列表", icon: "DisorderListOutlined", snippet: "- " },
  {
    id: "ordered",
    label: "有序列表",
    icon: "OrderListOutlined",
    snippet: "1. ",
  },
  { id: "quote", label: "引用", icon: "FormatQuoteOutlined", snippet: "> " },
  {
    id: "divider",
    label: "分割线",
    icon: "HorizontalRuleOutlined",
    snippet: "\n---\n",
  },
  {
    id: "code",
    label: "代码",
    icon: "CodeblockOutlined",
    snippet: "\n```\n\n```\n",
  },
  {
    id: "table",
    label: "表格",
    icon: "TableChartOutlined",
    snippet: "\n| A | B |\n| --- | --- |\n|   |   |\n",
  },
  { id: "link", label: "链接", icon: "GlobalLinkOutlined", snippet: "[](url)" },
  { id: "image", label: "图片", icon: "ImageOutlined", snippet: "![](url)" },
  {
    id: "callout",
    label: "标注",
    icon: "CalloutOutlined",
    snippet: "> [!NOTE]\n> ",
  },
  {
    id: "columns",
    label: "分栏",
    icon: "DocColumnsOutlined",
    snippet: "\n::: {.col-2}\n左\n\n右\n:::\n",
  },
];

export interface CalloutInsertMenuOptions {
  /** 菜单编辑的 textarea。 */
  readonly editor: HTMLTextAreaElement;
  /** 菜单所属卡片（定位 + 拆除用）。 */
  readonly card: HTMLElement;
}

interface OpenMenu {
  readonly el: HTMLDivElement;
  query: string;
  readonly start: number;
  dispose: () => void;
}

/**
 * 在高亮块正文挂上 `/` 菜单。返回拆除函数，让调用方随 textarea 一起拆。
 */
export function attachCalloutInsertMenu(
  options: CalloutInsertMenuOptions,
): () => void {
  const { editor, card } = options;
  let open: OpenMenu | null = null;

  const close = (): void => {
    if (!open) return;
    open.dispose();
    open = null;
  };

  const rowsFor = (query: string): CalloutInsertSnippet[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [...CALLOUT_SNIPPETS];
    return CALLOUT_SNIPPETS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.id.includes(q),
    );
  };

  const paint = (state: OpenMenu): void => {
    state.el.replaceChildren();
    const rows = rowsFor(state.query);
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cm-callout-insert-empty";
      empty.textContent = "无匹配项";
      state.el.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cm-callout-insert-item";
      btn.setAttribute("data-insert-id", row.id);
      const icon = document.createElement("span");
      icon.className = "cm-callout-insert-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.appendChild(renderIcon(row.icon));
      const label = document.createElement("span");
      label.className = "cm-callout-insert-label";
      label.textContent = row.label;
      btn.append(icon, label);
      btn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        insert(row);
      });
      state.el.appendChild(btn);
    }
  };

  /** 用片段替换已输入的 `/query`，光标留在片段之后。 */
  const insert = (row: CalloutInsertSnippet): void => {
    if (!open) return;
    const end = editor.selectionStart ?? editor.value.length;
    const start = open.start;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(Math.max(end, start));
    editor.value = `${before}${row.snippet}${after}`;
    const caret = start + row.snippet.length;
    close();
    editor.focus();
    editor.setSelectionRange(caret, caret);
    // 卡片在 `input` 上暂存编辑；程序化改值需要手动派发一次。
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const openAt = (start: number): void => {
    close();
    const el = document.createElement("div");
    el.className = "cm-callout-insert-menu";
    el.setAttribute("data-testid", "cm-callout-insert-menu");
    el.addEventListener("mousedown", (event) => event.stopPropagation());
    const menuHost = card.querySelector(".cm-callout-header") ?? card;
    menuHost.appendChild(el);
    el.style.top = `${editor.offsetTop + editor.offsetHeight + 4}px`;
    el.style.left = `${editor.offsetLeft}px`;

    const state: OpenMenu = {
      el,
      query: "",
      start,
      dispose: () => el.remove(),
    };
    open = state;
    paint(state);
  };

  const onInput = (): void => {
    if (!open) return;
    const caret = editor.selectionStart ?? 0;
    if (caret <= open.start) {
      close();
      return;
    }
    // 菜单只占有 `/query` 这一段；空格或换行就按普通文本提交。
    const typed = editor.value.slice(open.start, caret);
    if (/[\s\n]/.test(typed)) {
      close();
      return;
    }
    open.query = typed.slice(1);
    paint(open);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (open && event.key === "Enter") {
      const first = open.el.querySelector<HTMLButtonElement>(
        ".cm-callout-insert-item",
      );
      if (first) {
        event.preventDefault();
        first.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
        );
      }
      return;
    }
    if (
      event.key === "/" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      // 在光标处 `/` 打开：`start` 是斜杠落下的位置。
      const start = editor.selectionStart ?? 0;
      if (editor.selectionEnd !== start) return;
      if (start > 0 && !/[\s]/.test(editor.value[start - 1] ?? "")) return;
      openAt(start);
    }
  };

  const onBlur = (): void => {
    // 按在菜单里时 textarea 保持 blur，只有真正离开才关（卡片自己的 commit 处理其余）。
    window.setTimeout(() => {
      if (!open) return;
      const active = document.activeElement;
      if (active && open.el.contains(active)) return;
      close();
    }, 0);
  };

  editor.addEventListener("input", onInput);
  editor.addEventListener("keydown", onKeyDown);
  editor.addEventListener("blur", onBlur);

  return () => {
    close();
    editor.removeEventListener("input", onInput);
    editor.removeEventListener("keydown", onKeyDown);
    editor.removeEventListener("blur", onBlur);
  };
}

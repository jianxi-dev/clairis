/* 高亮块内的插入片段（移植自 md-bundle packages/editor/src/decorations/callout-insert.ts，
 * #468；#743 起并入统一斜杠菜单）。
 *
 * 高亮块正文是 `<textarea>`，不是 CM6 文档文本，所以编辑器自己的斜杠菜单到不了。
 * #743 之前本模块给卡片一个独立的小菜单；现在片段表映射成统一斜杠命令
 * （`getCalloutSlashCommands`），由 callout.ts 的 openCalloutContextMenu 写回
 * textarea，独立菜单 DOM 已退役。
 */
import type { SlashCommand } from "../slash";

/** 片段定义：id/label/icon 供菜单行渲染，snippet 是写回 textarea 的文本。 */
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

/**
 * 把片段表映射成统一斜杠命令（#743 A-4.4）。
 *
 * `insert` 只提供文本：context 触发（高亮块正文）由宿主写回 textarea，`from`/`to`
 * 不被使用；片段 body 原样作为写回内容。
 */
export function getCalloutSlashCommands(): SlashCommand[] {
  return CALLOUT_SNIPPETS.map((item) => ({
    id: `callout-snippet-${item.id}`,
    label: item.label,
    icon: item.icon,
    insert: () => ({ from: 0, to: 0, text: item.snippet }),
  }));
}

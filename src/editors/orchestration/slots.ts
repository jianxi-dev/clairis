import type { IconName } from "../../ui/icons";

export interface ToolbarSlotItem {
  id: string;
  label: string;
  icon: IconName;
  group: "ai" | "format" | "align";
}

export const HTML_TOOLBAR_ITEMS: readonly ToolbarSlotItem[] = [
  { id: "ai-rewrite", label: "改写", icon: "edit", group: "ai" },
  { id: "ai-translate", label: "翻译", icon: "globe", group: "ai" },
  { id: "ai-polish", label: "润色", icon: "sparkle", group: "ai" },
  { id: "format-bold", label: "粗体", icon: "bold", group: "format" },
  { id: "format-italic", label: "斜体", icon: "italic", group: "format" },
  {
    id: "format-underline",
    label: "下划线",
    icon: "underline",
    group: "format",
  },
  { id: "format-strike", label: "删除线", icon: "strike", group: "format" },
  { id: "format-code", label: "行内代码", icon: "code", group: "format" },
  { id: "format-link", label: "链接", icon: "link", group: "format" },
  { id: "align-left", label: "左对齐", icon: "alignLeft", group: "align" },
  { id: "align-center", label: "居中", icon: "alignCenter", group: "align" },
  { id: "align-right", label: "右对齐", icon: "alignRight", group: "align" },
];

export const HTML_TOOLBAR_DEFAULT_ORDER: readonly string[] =
  HTML_TOOLBAR_ITEMS.map((item) => item.id);

const KNOWN_IDS = new Set(HTML_TOOLBAR_DEFAULT_ORDER);

export function resolveToolbarOrder(
  configured: string[] | null | undefined,
): string[] {
  if (!Array.isArray(configured) || configured.length === 0) {
    return [...HTML_TOOLBAR_DEFAULT_ORDER];
  }
  const out: string[] = [];
  for (const id of configured) {
    if (!KNOWN_IDS.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out.length > 0 ? out : [...HTML_TOOLBAR_DEFAULT_ORDER];
}

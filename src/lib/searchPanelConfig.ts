import type { SearchPanelConfig, SearchPanelDefaultPos } from "../types";

export const DEFAULT_SEARCH_PANEL: SearchPanelConfig = {
  defaultPos: "center",
};

const DEFAULT_POSITIONS: readonly SearchPanelDefaultPos[] = [
  "left",
  "center",
  "right",
];

interface RawSearchPanel {
  defaultPos?: string | null;
}

export function normalizeSearchPanel(raw?: RawSearchPanel | null): {
  config: SearchPanelConfig;
  warnings: string[];
} {
  const warnings: string[] = [];
  const value = raw?.defaultPos;
  if (
    value != null &&
    !DEFAULT_POSITIONS.includes(value as SearchPanelDefaultPos)
  ) {
    warnings.push(`忽略未知搜索浮窗默认位置: ${value}`);
  }
  const defaultPos = DEFAULT_POSITIONS.includes(value as SearchPanelDefaultPos)
    ? (value as SearchPanelDefaultPos)
    : DEFAULT_SEARCH_PANEL.defaultPos;
  return { config: { defaultPos }, warnings };
}

import type {
  PropertyBarConfig,
  PropertyBarDefaultMode,
  PropertyBarDisplayStyle,
} from "../types";

export const DEFAULT_PROPERTY_BAR: PropertyBarConfig = {
  displayStyle: "list",
  displayDefault: { preview: "show", edit: "show" },
  newDocVisible: true,
};

const DISPLAY_STYLES: readonly PropertyBarDisplayStyle[] = ["list", "dual"];
const DEFAULT_MODES: readonly PropertyBarDefaultMode[] = [
  "show",
  "collapse",
  "hide",
];

export interface RawPropertyBar {
  displayStyle?: string | null;
  displayDefault?: {
    preview?: string | null;
    edit?: string | null;
  } | null;
  newDocVisible?: boolean | null;
}

function pickEnum<T extends string>(
  field: string,
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
  warnings: string[],
): T {
  if (value == null) return fallback;
  if (allowed.includes(value as T)) return value as T;
  warnings.push(`忽略未知${field}: ${value}`);
  return fallback;
}

export function normalizePropertyBar(raw?: RawPropertyBar | null): {
  config: PropertyBarConfig;
  warnings: string[];
} {
  const warnings: string[] = [];
  const displayStyle = pickEnum(
    "显示样式",
    raw?.displayStyle,
    DISPLAY_STYLES,
    DEFAULT_PROPERTY_BAR.displayStyle,
    warnings,
  );
  const preview = pickEnum(
    "预览默认显隐",
    raw?.displayDefault?.preview,
    DEFAULT_MODES,
    DEFAULT_PROPERTY_BAR.displayDefault.preview,
    warnings,
  );
  const edit = pickEnum(
    "编辑默认显隐",
    raw?.displayDefault?.edit,
    DEFAULT_MODES,
    DEFAULT_PROPERTY_BAR.displayDefault.edit,
    warnings,
  );
  const newDocVisible =
    typeof raw?.newDocVisible === "boolean"
      ? raw.newDocVisible
      : DEFAULT_PROPERTY_BAR.newDocVisible;
  return {
    config: {
      displayStyle,
      displayDefault: { preview, edit },
      newDocVisible,
    },
    warnings,
  };
}

export function modeDefault(
  config: Pick<PropertyBarConfig, "displayDefault"> | undefined,
  mode: "preview" | "edit",
): PropertyBarDefaultMode {
  return (
    config?.displayDefault?.[mode] ?? DEFAULT_PROPERTY_BAR.displayDefault[mode]
  );
}

export type EditorMode = "preview" | "edit" | "source";

import type { ViewSpec } from "../lib/aiViewSpec";
import type { FrontmatterType } from "../lib/frontmatter";

export type FileKind =
  | "markdown"
  | "html"
  | "text"
  | "css"
  | "python"
  | "json"
  | "javascript"
  | "yaml"
  | "csv"
  | "image"
  | "video"
  | "audio"
  | "pdf";

export type TranslationProvider = "ollama" | "openai";

export type LangPair = {
  source: string;
  target: string;
};

export interface HeadingColors {
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
}

/** 标题逐级字体（C1 / #853）：值 = CSS font-family 列表。 */
export interface HeadingFonts {
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
}

/** 文档属性面板显示样式：list = A 一行条，dual = B 精排双列。 */
export type PropertyBarDisplayStyle = "list" | "dual";

/** 文档属性面板默认显示档：展开 / 折叠 / 隐藏。 */
export type PropertyBarDefaultMode = "show" | "collapse" | "hide";

/** 文档属性面板配置（doc-property-panel P-2）。 */
export interface PropertyBarConfig {
  displayStyle: PropertyBarDisplayStyle;
  displayDefault: {
    preview: PropertyBarDefaultMode;
    edit: PropertyBarDefaultMode;
  };
  /** 新建文档的默认显隐（全局，不做模板级 / 文件级覆盖）。 */
  newDocVisible: boolean;
}

/** 属性模板字段（doc-property-panel P-7）：键 + 类型 + 可选预设值。 */
export interface PropTemplateFieldConfig {
  key: string;
  type: FrontmatterType;
  value?: unknown;
}

/** 属性模板（doc-property-panel P-7）：应用级配置，名称 + 字段集。 */
export interface PropTemplateConfig {
  name: string;
  fields: PropTemplateFieldConfig[];
}

/** 搜索浮窗默认位置（#981 / S-1）。 */
export type SearchPanelDefaultPos = "left" | "center" | "right";

/** 搜索浮窗配置（#981 / S-1）。 */
export interface SearchPanelConfig {
  defaultPos: SearchPanelDefaultPos;
}

export interface AppConfig {
  fontSize: number;
  headingColors: HeadingColors;
  /** 标题逐级字体（H1–H6）显式配置的部分映射；缺键 = 未配置，回落 `--type-font-sans`。 */
  headingFonts?: Partial<HeadingFonts>;
  /** 阅读区字号，与编辑器字号解耦 */
  readerFontSize: number;
  /** 阅读区正文行宽（px） */
  readerWidth: number;
  /** 新建文档首次保存的默认目录；空 = 沿用系统默认 */
  defaultSavePath?: string | null;
  /** 选区工具条形态：轮盘（默认）/ 胶囊 */
  selectionToolbar?: "roulette" | "capsule";
  /** 阅读皮肤：paper / modern … */
  readerSkin: string;
  ollamaEndpoint: string;
  openaiEndpoint: string;
  openaiModel: string;
  translationProvider: TranslationProvider;
  langPair: LangPair;
  theme: Theme;
  /** AI 改动前的确认密度：always 每次确认 / session-silent 本会话静默 / never 只靠撤销 */
  aiConfirmDensity?: "always" | "session-silent" | "never";
  sidebarLeftVisible: boolean;
  sidebarRightVisible: boolean;
  sidebarLeftWidth: number;
  sidebarRightWidth: number;
  horizontalSplitRatio: number;
  verticalSplitRatio: number;
  recentFiles: RecentFile[];
  scrollPositions: Record<string, ScrollPosition>;
  /**
   * 内嵌文件滚动定格（D10 / B5b）：文档级 view-state，键 = `文档路径\u0000内嵌路径`。
   * 与 `scrollPositions` 同类结构，持久化在 state 层；不含用户可配置项。
   */
  embedScrollPositions: Record<string, ScrollPosition>;
  /** 核心能力开关：只存被关闭的项，缺省全开（spec X-3） */
  capabilities?: Record<string, boolean>;
  /** 图标标签级别（Layout Portal §10）：自动 / 始终文字 / 仅图标 */
  iconLabel?: "auto" | "text" | "icon";
  /** 轮盘根扇区集合与顺序；null/缺省 = 内置 8 项（ui-command-registry 2.1） */
  rouletteSectors?: string[] | null;
  /** 轮盘开关快捷键；null/缺省 = Mod+Shift+Space（ui-polish-batch15 2.1） */
  rouletteHotkey?: string | null;
  /** 轮盘默认形态：hub 圆心 / disk 整盘；null/缺省 = hub（ui-polish-batch15 2.1） */
  rouletteForm?: "hub" | "disk" | null;
  /** 轮盘圆心位置（px）；null/缺省 = 跟在选区旁（ui-polish-batch15 2.1） */
  roulettePosition?: { x: number; y: number } | null;
  /** 提示信息显示时长（秒，0.1–10，1 位小数）；null/缺省 = 3 秒（ui-polish-batch15 4.1） */
  noticeDuration?: number | null;
  /** 横向工具条动作集合与顺序；null/缺省 = 内置 12 项（ui-toolbar-slots 1.1） */
  htmlToolbarItems?: string[] | null;
  /** 工作区 pane 递归树（layout-portal 3.1）：序列化 JSON，跨重启恢复 */
  paneLayout?: string | null;
  /** 左边栏固定隐藏（C3 / D14）：隐藏后箭头热区收起、滑入不唤出；缺省 false */
  railPinHidden?: boolean | null;
  /** AI 视图改写规格（layout-portal 9.1）：持久化到 Rust `aiViewSpec` */
  aiViewSpec?: ViewSpec | null;
  /** 文档属性面板（doc-property-panel P-2） */
  propertyBar?: PropertyBarConfig;
  /** 属性模板（doc-property-panel P-7）：内置三套 + 用户自定义，按名合并 */
  propTemplates?: PropTemplateConfig[];
  /** 字段别称映射（doc-property-panel P-6 / #1024）：键名 → 八类类型，缺省回落内置 */
  propAliasMap?: Record<string, FrontmatterType>;
  /** 搜索浮窗（#981 / S-1） */
  searchPanel?: SearchPanelConfig;
}

export type Theme = "system" | "light" | "dark" | "warm";

export type CaptureStatus = "closed" | "normal" | "pinned" | "capsule";
export type CapturePrefix = "" | "." | "-" | "!" | "?";

export type EntryType = "problem" | "todo" | "idea" | "wonder" | "note";

export interface InboxEntry {
  id: string;
  type?: EntryType;
  prefix: CapturePrefix;
  content: string;
  capturedAt: string;
  archivedAt?: string;
}

export interface UndoState {
  entryId: string;
  deadline: number;
  timer?: number;
}

export interface CapturePosition {
  x: number;
  y: number;
}

export interface RecentFile {
  path: string;
  title: string;
  openedAt: string;
  /** 打开时截下的前 160 字，门户卡片用它显示真摘要（不是占位文案） */
  excerpt?: string;
}

/** 本机全文检索命中（search_documents 返回，Rust 侧 serde camelCase）。 */
export interface SearchHit {
  path: string;
  /** frontmatter title 优先，缺省为文件名 */
  title: string;
  openedAt: string;
  /** 命中片段（含命中词上下文），供前端高亮 */
  excerpt: string;
  /** 命中字段：filename / title / h1 / content */
  matchedIn: string;
}

/** 应用场景（Layout Portal §1） */
export type Scene = "portal" | "workspace" | "grid" | "settings";

export interface ScrollPosition {
  scrollPos: number;
  contentHeight: number;
}

export interface Tab {
  id: string;
  title: string;
  path: string | null;
  fileKind: FileKind;
  content: string;
  dirty: boolean;
  editorMode: EditorMode;
  scrollPos: number;
  contentHeight: number;
}

export type RawMarkdown = string;

export interface TranslationState {
  active: boolean;
  requestId: string | null;
  text: string;
  loading: boolean;
  error: string | null;
}

export interface TranslationChunk {
  requestId: string;
  text: string;
  done: boolean;
  error?: string;
}

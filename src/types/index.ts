export type EditorMode = "preview" | "edit" | "source";

import type { ViewSpec } from "../lib/aiViewSpec";

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

export interface AppConfig {
  fontSize: number;
  headingColors: HeadingColors;
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
  /** 核心能力开关：只存被关闭的项，缺省全开（spec X-3） */
  capabilities?: Record<string, boolean>;
  /** 图标标签级别（Layout Portal §10）：自动 / 始终文字 / 仅图标 */
  iconLabel?: "auto" | "text" | "icon";
  /** 轮盘根扇区集合与顺序；null/缺省 = 内置 8 项（ui-command-registry 2.1） */
  rouletteSectors?: string[] | null;
  /** 工作区 pane 递归树（layout-portal 3.1）：序列化 JSON，跨重启恢复 */
  paneLayout?: string | null;
  /** AI 视图改写规格（layout-portal 9.1）：持久化到 Rust `aiViewSpec` */
  aiViewSpec?: ViewSpec | null;
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

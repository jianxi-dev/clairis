export type EditorMode = "preview" | "edit" | "source";

export type FileKind = "markdown" | "html" | "text";

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
  ollamaEndpoint: string;
  openaiEndpoint: string;
  openaiModel: string;
  translationProvider: TranslationProvider;
  langPair: LangPair;
  theme: Theme;
  sidebarLeftVisible: boolean;
  sidebarRightVisible: boolean;
  sidebarLeftWidth: number;
  sidebarRightWidth: number;
  horizontalSplitRatio: number;
  verticalSplitRatio: number;
  recentFiles: RecentFile[];
}

export type Theme = "system" | "light" | "dark";

export interface RecentFile {
  path: string;
  title: string;
  openedAt: string;
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

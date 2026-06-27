export type EditorMode = "wysiwyg" | "source" | "sourceReadOnly";

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

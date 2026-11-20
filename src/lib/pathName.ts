/**
 * 文件名主名 / 扩展名拆分（#1263）。
 *
 * 规则：以最后一个 `.` 为界；点开头（`.env`）与无点名视为「无扩展名」，
 * 避免把隐藏文件或带点项目名误拆。改名时扩展名固定，由调用方只让用户改主名。
 */
export interface StemExt {
  stem: string;
  ext: string;
}

export function splitStemExt(name: string): StemExt {
  const i = name.lastIndexOf(".");
  if (i <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, i), ext: name.slice(i) };
}

/** 主名 + 固定扩展名；用户输入已带同扩展名时不重复拼。 */
export function joinStemExt(stem: string, ext: string): string {
  const s = stem.trim();
  if (!s) return s;
  if (ext && s.toLowerCase().endsWith(ext.toLowerCase())) return s;
  return s + ext;
}

/** 文档扩展名白名单：面板标题字段只对这些扩展名做隐藏（`v1.2` 这类不被拆）。 */
const DOC_EXTS = new Set([".md", ".markdown", ".txt"]);

export function stripDocExt(name: string): string {
  const { stem, ext } = splitStemExt(name);
  return ext && DOC_EXTS.has(ext.toLowerCase()) ? stem : name;
}

/** 新建文档另存为的预填文件名：先剥文档扩展名再拼 `.md`，避免 `x.md.md`。 */
export function defaultSaveName(name: string): string {
  return `${splitStemExt(name || "未命名").stem}.md`;
}

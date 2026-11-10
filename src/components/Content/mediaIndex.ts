const MEDIA_INDEX_KEY = "biaoyue.media.lastIndex";

export function mediaDirOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

export function readSavedMediaIndex(): { dir: string; path: string } | null {
  try {
    const raw = localStorage.getItem(MEDIA_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dir?: string; path?: string };
    if (!parsed.dir || !parsed.path) return null;
    return { dir: parsed.dir, path: parsed.path };
  } catch {
    return null;
  }
}

export function saveMediaIndex(path: string): void {
  try {
    localStorage.setItem(
      MEDIA_INDEX_KEY,
      JSON.stringify({ dir: mediaDirOf(path), path }),
    );
  } catch {
    // 忽略配额/隐私模式失败：记忆是增强，不是正确性依赖
  }
}

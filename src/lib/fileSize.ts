/** 字节数 → 附件卡大小文本：`512 B` / `1.50KB` / `12.30MB` / `1.00GB`。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)}KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)}MB`;
  return `${(mb / 1024).toFixed(2)}GB`;
}

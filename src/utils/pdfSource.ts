import { isTauriEnv } from "./tauri";

/**
 * 在 Tauri 桌面环境中以 base64 读取 PDF 文件字节。
 */

export async function loadPdfBytes(
  path: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  if (!isTauriEnv()) {
    return {
      ok: false,
      error: "无法预览 PDF：需在 Tauri 桌面环境中运行",
    };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const base64 = await invoke<string>("read_file_base64", { path });
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return { ok: true, bytes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

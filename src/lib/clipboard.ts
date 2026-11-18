import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "../utils/tauri";

/** 「复制文件」只在 macOS 有实现：其余平台不渲染入口，而不是渲染后失败。 */
export function canCopyFile(): boolean {
  if (!isTauriEnv()) return false;
  return /Mac/i.test(navigator.userAgent);
}

/** 把文件本身写入系统剪贴板（macOS 文件引用）。失败时抛错，由调用方提示。 */
export async function copyFileToClipboard(path: string): Promise<void> {
  await invoke("copy_file_to_clipboard", { path });
}

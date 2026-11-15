import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "../utils/tauri";
import { log } from "../utils/log";

/**
 * 取文件元信息（复用 Rust `get_file_info`）。
 *
 * 页签名信息窗用 `modified`（Unix 秒）显示「最近保存」；浏览器直跑（无 Tauri）
 * 或读不到文件时返回 null，调用方退回打开时间 / 未知文案。
 */
export async function getFileModified(path: string): Promise<number | null> {
  if (!isTauriEnv()) return null;
  try {
    const info = await invoke<{ modified?: number }>("get_file_info", { path });
    return typeof info.modified === "number" ? info.modified : null;
  } catch (e) {
    log.warn("FileInfo", "读取文件元信息失败", e);
    return null;
  }
}

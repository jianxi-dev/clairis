import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "../utils/tauri";
import { log } from "../utils/log";

/** 在系统文件管理器中显示路径；浏览器直跑（无 Tauri）时静默。 */
export function revealInFinder(path: string): void {
  if (!isTauriEnv()) return;
  invoke("reveal_in_finder", { path }).catch((e) =>
    log.warn("Finder", "在 Finder 中显示失败", e),
  );
}

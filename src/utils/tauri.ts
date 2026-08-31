/**
 * 判断当前是否运行在 Tauri 桌面环境（window.__TAURI_INTERNALS__ 存在）。
 *
 * 浏览器 dev server（:1420）与无 Tauri mock 的 e2e 均无此全局，
 * 此时调用 @tauri-apps/api 的 invoke / convertFileSrc 会同步抛 TypeError，
 * 直接击穿渲染树导致整页白屏。所有 Tauri API 调用点必须先经此守卫。
 */
export function isTauriEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
      undefined
  );
}

/* 快捷键和弦显示格式化（移植自 md-bundle packages/editor/src/keybindings.ts）。
 *
 * 纯函数，不碰 DOM：平台判定可注入，测试因此是确定性的。
 */

/**
 * 判定当前平台是否 macOS。
 *
 * 非浏览器环境（jsdom、Node）里 `navigator.platform` 可能为空，
 * 此时按非 mac 处理，保证测试输出稳定。
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent);
}

/**
 * 把 CM6 键位和弦格式化成展示文本。
 *
 * 规则：
 * - 按 `-` 切分 token。
 * - `Mod` → mac `⌘` / 非 mac `Ctrl`
 * - `Shift` → mac `⇧` / 非 mac `Shift`
 * - `Alt` → mac `⌥` / 非 mac `Alt`
 * - 字母/数字 token 转大写。
 * - mac 无分隔符拼接：`⌘B`、`⌘⇧X`、`⌘⌥1`
 * - 非 mac 用 `+` 拼接：`Ctrl+B`、`Ctrl+Shift+X`、`Ctrl+Alt+1`
 * - 空串/未知 token 不抛错。
 *
 * `isMac` 参数让测试可注入平台；省略时用 `isMacPlatform()`。
 */
export function formatKeyChord(chord: string, isMac?: boolean): string {
  if (!chord) return "";
  const mac = isMac ?? isMacPlatform();
  const tokens = chord.split("-");
  const formatted = tokens.map((token) => {
    const t = token.trim();
    if (!t) return "";
    const lower = t.toLowerCase();
    if (lower === "mod") return mac ? "⌘" : "Ctrl";
    if (lower === "shift") return mac ? "⇧" : "Shift";
    if (lower === "alt") return mac ? "⌥" : "Alt";
    // 字母/数字 token：转大写（'b' → 'B'，'1' → '1'）
    return t.toUpperCase();
  });
  const filtered = formatted.filter((t) => t !== "");
  return mac ? filtered.join("") : filtered.join("+");
}

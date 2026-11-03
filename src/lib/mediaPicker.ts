/**
 * 媒体选择（图片 / 视频 / 附件）——只走 Tauri 原生对话框。
 *
 * 编辑器包只拿到一个 `() => Promise<PickedMedia | null>`，不碰 DOM 也不碰
 * 系统对话框：去哪儿取文件、取到之后放哪儿，都由宿主决定。
 *
 * 为什么没有浏览器 `<input type="file">` 兜底：
 * 选择器是在 `await import()` 之后才触发的，用户激活已经丢失，Chromium 会
 * 立刻把它判成取消——`filechooser` 事件永远不出现。留着它只是给「点了没
 * 反应」再套一层伪装（#103 的原始症状）。浏览器里没有这个能力，就明说没有。
 *
 * 文件落点：文档同级 `assets/`，markdown 里只写相对名。文档搬走、换台机器
 * 都不裂图；写绝对路径则只有本机能看。
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface PickedMedia {
  /** 用作 `![alt]` 的展示名（不含路径）。 */
  name: string;
  /** 写进 markdown 的 href：`assets/xxx`。 */
  href: string;
}

interface ImportedMedia {
  path: string;
  name: string;
}

function inTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
      undefined
  );
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * 选一个媒体文件并导入到文档同级 `assets/`。
 *
 * @param docPath 当前文档的绝对路径。为 null（未保存的新文档）时没有落点，
 *   只返回文件名让用户自己放——总比什么都不发生强，但要注意此时引用可能裂图。
 */
export async function pickMediaForDocument(
  docPath: string | null,
): Promise<PickedMedia | null> {
  if (!inTauri()) {
    // 明确不支持，不假装支持。
    console.warn("[media] 浏览器环境没有文件选择能力，媒体插入仅在桌面端可用");
    return null;
  }

  const picked = await open({
    multiple: false,
    directory: false,
    title: "选择图片、视频或附件",
  });

  // 原生对话框只会给 string（路径）或 null（用户取消）。拿到别的东西说明
  // plugin-dialog 没真正接上（例如 e2e 的 Tauri mock 只实现了 invoke）。
  if (picked === null) return null;
  if (typeof picked !== "string") return null;

  if (!docPath) {
    return { name: baseName(picked), href: baseName(picked) };
  }

  const imported = await invoke<ImportedMedia>("import_media_file", {
    docPath,
    srcPath: picked,
  });
  return { name: baseName(imported.name), href: imported.name };
}

import { buildAssetUrl } from "../renderers/html";
import { isTauriEnv } from "../utils/tauri";

/** 本地图片路径 → asset:// URL；浏览器直跑（无 Tauri）时保持原路径。 */
export function assetSrc(src: string): string {
  if (!src) return "";
  if (/^(data:|blob:|asset:|https?:)/i.test(src)) return src;
  return isTauriEnv() ? buildAssetUrl(src) : src;
}

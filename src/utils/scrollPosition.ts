import type { ScrollPosition } from "../types";

export function computeProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const max = scrollHeight - clientHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
}

export function resolveScrollTarget(
  record: ScrollPosition | undefined,
  currentScrollHeight: number,
  clientHeight: number,
): number | null {
  if (!record || record.contentHeight <= 0) return null;
  const max = currentScrollHeight - clientHeight;
  if (max <= 0) return null;
  const pixelExact = Math.abs(record.contentHeight - currentScrollHeight) <= 1;
  const target = pixelExact
    ? record.scrollPos
    : (record.scrollPos / record.contentHeight) * currentScrollHeight;
  return Math.min(target, max);
}

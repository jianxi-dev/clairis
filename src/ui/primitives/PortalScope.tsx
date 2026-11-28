import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

let hostEl: HTMLDivElement | null = null;
let refCount = 0;
/** 延迟回收句柄：StrictMode 的卸载/挂载发生在同一批，立刻删会把宿主打掉 */
let pendingRemoval: ReturnType<typeof setTimeout> | null = null;

/**
 * 共享 portal 宿主（ui-quality-primitives-v1 / 2.2）。
 *
 * 首次挂载时往 `document.body` append 一个带 `data-portal-root` 的 div，
 * 所有 PortalScope 的 children 经 `createPortal` 挂进去：浮层统一挂载点，
 * 避免各自 createPortal 到 body 后层叠顺序不可控，并让 e2e 可稳定定位。
 *
 * 宿主为什么必须容忍「卸载后立刻重挂」：`src/main.tsx` 用 `<React.StrictMode>`，
 * dev 下组件会「挂载 → 模拟卸载 → 再挂载」；若在卸载回调里同步移除宿主，
 * 再挂载时 `useState` 拿到的仍是那个**已脱离文档**的节点，`createPortal` 会把
 * 浮层渲染进游离 DOM——页面上既看不到也查不到（#1709 实测 8 条 e2e 全红）。
 * 故回收延迟一拍，并在挂载时用 `isConnected` 自检、必要时补建。
 */
function ensureHost(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!hostEl || !hostEl.isConnected) {
    hostEl = document.createElement("div");
    hostEl.setAttribute("data-portal-root", "");
    document.body.appendChild(hostEl);
  }
  return hostEl;
}

export function PortalScope({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}): JSX.Element {
  // 惰性初始化：首次渲染即建宿主，children 一次挂载，定位 hook 不会因延迟挂载漏掉首帧。
  const [host, setHost] = useState<HTMLDivElement | null>(() => ensureHost());

  useEffect(() => {
    refCount += 1;
    if (pendingRemoval) {
      clearTimeout(pendingRemoval);
      pendingRemoval = null;
    }
    // 宿主可能被上一轮延迟回收移除，或被外部清掉：补建并与 state 同步。
    if (!host || !host.isConnected) {
      const fresh = ensureHost();
      if (fresh && fresh !== host) setHost(fresh);
    }
    return () => {
      refCount -= 1;
      if (refCount > 0) return;
      pendingRemoval = setTimeout(() => {
        pendingRemoval = null;
        if (refCount <= 0 && hostEl) {
          hostEl.remove();
          hostEl = null;
        }
      }, 0);
    };
  }, [host]);

  if (!host) return <></>;
  return createPortal(
    <div data-portal-scope={id ?? ""}>{children}</div>,
    host,
  );
}

export default PortalScope;

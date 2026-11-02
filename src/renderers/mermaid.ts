/** Mermaid 图：懒加载，渲染成 SVG 覆盖到源码块旁。 */
type MermaidApi = typeof import("mermaid").default;

import { isCapabilityEnabled, subscribeCapability } from "../lib/capabilities";

let pending: Promise<MermaidApi | null> | null = null;

function loadMermaid(): Promise<MermaidApi | null> {
  pending ??= import("mermaid")
    .then((m) => m.default)
    // 离线/打包异常时不阻断阅读，退化成展示源码
    .catch(() => null);
  return pending;
}

let seq = 0;

/** 渲染过的容器：关闭能力时要按这些根清掉已挂的 SVG。 */
const renderedRoots = new Set<ParentNode>();

/** 清掉水合产物，把源码块重新显示出来（不删文档内容）。 */
export function clearMermaid(root: ParentNode): void {
  for (const view of Array.from(
    root.querySelectorAll<HTMLElement>(".mermaid-view"),
  )) {
    view.remove();
  }
  for (const src of Array.from(
    root.querySelectorAll<HTMLElement>("pre.mermaid"),
  )) {
    src.hidden = false;
  }
}

subscribeCapability((id, enabled) => {
  if (id !== "mermaid") return;
  for (const root of Array.from(renderedRoots)) {
    const node = root as unknown as Node;
    if (node.isConnected === false) {
      renderedRoots.delete(root);
      continue;
    }
    if (enabled) void renderMermaid(root);
    else clearMermaid(root);
  }
});

/**
 * 渲染 root 下所有未渲染的 `pre.mermaid`。
 * 源码块保留在 DOM 中（成功渲染后隐藏），主题切换时可原样重渲。
 */
export async function renderMermaid(root: ParentNode | null): Promise<void> {
  if (!root) return;
  renderedRoots.add(root);
  if (!isCapabilityEnabled("mermaid")) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("pre.mermaid"));
  if (!blocks.length) return;

  const mermaid = await loadMermaid();
  if (!mermaid) return;

  const dark = document.documentElement.classList.contains("dark");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
  });

  for (const src of blocks) {
    const block = src.parentElement;
    if (!block) continue;
    let view = block.querySelector<HTMLElement>(".mermaid-view");
    if (!view) {
      view = document.createElement("div");
      view.className = "mermaid-view";
      block.appendChild(view);
    }
    try {
      const { svg } = await mermaid.render(
        `mermaid-${(seq += 1)}`,
        src.textContent ?? "",
      );
      view.innerHTML = svg;
      src.hidden = true;
    } catch {
      // 语法错误：留着源码文本，便于改正
      view.innerHTML = "";
      src.hidden = false;
    }
  }
}

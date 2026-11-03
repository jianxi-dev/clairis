/** 图表引擎编排：能力开关、整包懒加载、错误归一与批量渲染（design D2/D3/D5/D6/D8）。
 *
 * 引擎就绪后单块出图是同步的（D3）：适配层一次加载并注册全部图类型，
 * 之后每块在同一次调用栈内画出 SVG。能力 id 保持 `mermaid`（D8）。
 *
 * 本文件**不得**静态 import `pele` 或 `./pele`：适配层必须留在独立 chunk 里，
 * 否则整包会被打进主 chunk（Vite 会告警 "dynamically imported but also statically
 * imported"）。类型用 `typeof import("./pele")`，运行时只走 `import("./pele")`。
 */
import {
  isCapabilityEnabled,
  subscribeCapability,
} from "../../lib/capabilities";

/** 适配层模块类型（仅类型位置使用，编译后擦除，不产生静态依赖）。 */
type DiagramAdapter = typeof import("./pele");

let pending: Promise<DiagramAdapter | null> | null = null;
let adapter: DiagramAdapter | null = null;
let loadCount = 0;

/** 整包懒加载：离线/打包异常时退化成展示源码，不阻断阅读。 */
export function ensureDiagramEngine(): Promise<DiagramAdapter | null> {
  if (!pending) {
    loadCount += 1;
    pending = import("./pele")
      .then((loaded) => {
        adapter = loaded;
        return loaded;
      })
      .catch(() => null);
  }
  return pending;
}

/** 已发起的引擎加载次数；同一页面无论多少图块都应为 1（spec D-1 多块共用引擎）。 */
export function engineLoadCount(): number {
  return loadCount;
}

/** 把渲染错误归一成可展示文本；适配层未加载时给兜底文案（spec D-4）。 */
export function describeDiagramError(error: unknown): string {
  return (
    adapter?.describeDiagramError(error) ?? String(error ?? "图表渲染失败")
  );
}

/** 渲染过的容器：能力关闭时要按这些根清掉已挂的 SVG，重新开启时恢复出图。 */
const renderedRoots = new Set<ParentNode>();

/** 清掉水合产物，把源码块重新显示出来（不删文档内容）。 */
export function clearAll(root: ParentNode): void {
  for (const view of Array.from(
    root.querySelectorAll<HTMLElement>(".mermaid-view"),
  )) {
    // 适配层未加载时不可能有视图；有视图时 adapter 必然已就绪
    adapter?.unmountDiagram(view);
    view.remove();
  }
  for (const src of Array.from(
    root.querySelectorAll<HTMLElement>("pre.mermaid"),
  )) {
    src.hidden = false;
  }
}

/**
 * 渲染 root 下所有 `pre.mermaid`。源码块保留在 DOM 中（成功渲染后隐藏）；
 * 单块失败只影响该块：源码可见 + 错误提示，不阻断同文档其它块（spec D-4）。
 */
export async function renderAll(root: ParentNode | null): Promise<void> {
  if (!root) return;
  renderedRoots.add(root);
  if (!isCapabilityEnabled("mermaid")) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("pre.mermaid"));
  if (!blocks.length) return;

  const engine = await ensureDiagramEngine();
  if (!engine) return;
  // 首次加载期间用户可能关闭能力：订阅回调先于视图创建，clearAll 清不到东西，
  // 这里再确认一次，避免"开关关了但图还在"（review: TOCTOU）
  if (!isCapabilityEnabled("mermaid")) return;

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
      const mounted = engine.mountDiagram(view, src.textContent ?? "");
      // 源码无法绘制时 Pele 已把错误提示画进容器，源码保持可见便于改正
      src.hidden = mounted.error === undefined;
    } catch (error) {
      // mount() 只在宿主回调抛错时上抛；归一成文本兜底，保证不抛出 renderAll
      view.textContent = engine.describeDiagramError(error);
      src.hidden = false;
    }
  }
}

/**
 * 编辑态静态渲染（design D4）：不走 `mount()`——CM6 widget 没有可靠的卸载钩子，
 * 会留下 ResizeObserver 残留。这里用适配层的纯函数 `render()`，同步写出 SVG；
 * 单块失败只影响该块，源码保持可见（spec D-4/D-6）。引擎只等一次；await 期间
 * 能力可能被关闭，与 renderAll 相同地复检一次（review: TOCTOU）。
 */
export async function renderAllStatic(root: ParentNode | null): Promise<void> {
  if (!root) return;
  if (!isCapabilityEnabled("mermaid")) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("pre.mermaid"));
  if (!blocks.length) return;

  const engine = await ensureDiagramEngine();
  if (!engine) return;
  if (!isCapabilityEnabled("mermaid")) return;

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
      view.innerHTML = engine.renderToString(src.textContent ?? "");
      src.hidden = true;
    } catch (error) {
      view.textContent = engine.describeDiagramError(error);
      src.hidden = false;
    }
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
    if (enabled) void renderAll(root);
    else clearAll(root);
  }
});

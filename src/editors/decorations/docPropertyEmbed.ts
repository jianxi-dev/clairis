/* 属性块嵌入正文流（doc-property-embed / #1157，方案 1）。
 *
 * 编辑态：含 frontmatter 的文档里，frontmatter-hide 的 replace 装饰改为
 * 「replace 型块 widget」——CM6 会测量其高度并计入高度图（math / mermaid 同款
 * 机制），因此 posAtCoords / 块手柄坐标不再偏移。React 通过 portal 把
 * `DocPropertyBar` 渲染进 widget 宿主，属性块随正文滚动、位于正文首块。
 *
 * 无 frontmatter 的文档不装本 widget：属性块维持内容区上方的固定宿主。
 * 折叠态与展开态共用同一 widget 宿主，折叠呈现（折叠条）由 `DocPropertyBar`
 * 依面板 store 决定，正文不再另渲染摘要标签。
 *
 * 宿主解析：分屏下每格 `ContentArea` 在装饰重配后（rAF）查询**本格**
 * `EditorView.dom` 内的 `.cm-dpb-embed` 作为 portal 宿主；不走模块级单槽——
 * 多格各自 effect 注册会互相覆盖，导致其中一格宿主为 null 不渲染（#1226）。
 *
 * 事件：`ignoreEvent` / `ignoreMutation` 均放行——面板内的点击、输入、菜单由
 * React 处理，不进编辑器事务，也不触发 CM6 的文档变更检测。
 */
import { WidgetType } from "@codemirror/view";

/** 块宿主 class（CSS manifest 要求 `cm-` 前缀并在 src/styles 落规则）。 */
export const DPB_EMBED_CLASS = "cm-dpb-embed";

export class DocPropertyEmbedWidget extends WidgetType {
  eq(): boolean {
    // 内容由 React 管理；widget 只在「有无」之间变化，位置随 replace 区间。
    return true;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = DPB_EMBED_CLASS;
    el.dataset.testid = "doc-property-host";
    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }
}

/** 每次装饰重建新建 widget 实例；`eq` 恒真让 CM6 复用既有 DOM 与 portal。 */
export function docPropertyEmbedWidget(): DocPropertyEmbedWidget {
  return new DocPropertyEmbedWidget();
}

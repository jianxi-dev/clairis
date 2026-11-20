/* 属性块嵌入正文流（doc-property-embed / #1157）。
 *
 * 属性块此前渲染在 `content-scroll` 之外的固定宿主里，不随正文滚动。本模块
 * 在编辑态把属性块作为**正文流首块**呈现：文档位置 0 的块级 widget 提供 DOM
 * 宿主，React 通过 portal 把 `DocPropertyBar` 渲染进来，于是它随 CM6 的滚动
 * 一起移动、位于正文标题之前。
 *
 * 为什么不用「外层容器滚动 + 关闭 CM6 内部滚动」：那会让 CM6 视口等于全文
 * 高度，长文档失去虚拟化。块 widget 参与 CM6 自身的滚动与视口裁剪。
 *
 * 事件：`ignoreEvent` / `ignoreMutation` 均放行，面板内的点击、输入、菜单由
 * React 处理，不进编辑器事务，也不触发 CM6 的视口重算误导。
 */
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { StateField } from "@codemirror/state";

/** 块宿主 class（CSS manifest 要求 `cm-` 前缀并在 src/styles 落规则）。 */
export const DPB_EMBED_CLASS = "cm-dpb-embed";

/** 宿主交接：widget 创建/销毁时把 DOM 交给 React portal。 */
type HostListener = (el: HTMLElement | null) => void;
let hostListener: HostListener | null = null;
/** 当前存活宿主：reconfigure 时新旧 widget 交替，只允许「当前那个」清空。 */
let currentHost: HTMLElement | null = null;

export function setDocPropertyEmbedHostListener(fn: HostListener | null): void {
  hostListener = fn;
}

/** 当前已存在的宿主（editor 先于 React effect 创建时补发一次）。 */
export function getDocPropertyEmbedHost(): HTMLElement | null {
  return currentHost;
}

class DocPropertyEmbedWidget extends WidgetType {
  eq(): boolean {
    // 内容由 React 管理；widget 只在「有无」之间变化，位置恒定。
    return true;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = DPB_EMBED_CLASS;
    el.dataset.testid = "doc-property-host";
    currentHost = el;
    hostListener?.(el);
    return el;
  }

  destroy(dom: HTMLElement): void {
    if (currentHost !== dom) return;
    currentHost = null;
    hostListener?.(null);
  }

  ignoreEvent(): boolean {
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }
}

function embedDecoration(): DecorationSet {
  const widget = new DocPropertyEmbedWidget();
  // side: -1 让块落在文档内容之前（首块），而不是与首行并列。
  return Decoration.set([
    Decoration.widget({ widget, block: true, side: -1 }).range(0),
  ]);
}

/**
 * 编辑态：属性块作为正文流首块的装饰扩展。
 *
 * 必须走 StateField：CM6 禁止插件提供 block decoration（会抛
 * `Block decorations may not be specified via plugins`）。
 */
const embedField = StateField.define<DecorationSet>({
  create: () => embedDecoration(),
  update: (deco) => deco,
  provide: (field) => EditorView.decorations.from(field),
});

export function docPropertyEmbed() {
  return embedField;
}

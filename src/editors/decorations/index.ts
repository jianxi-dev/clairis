/* 活源码装饰装配（移植自 md-bundle packages/editor/src/decorations/index.ts）。
 *
 * 把五个基础装饰模块（标题 / 加粗斜体 / 列表 / 引用 / 代码）合成一个 CM6
 * Extension，由 StateField 统一维护。替代旧 `setup.ts` 里「每次文档变更整篇
 * 重建、且不区分活跃块」的 `buildDecorationSet`。
 *
 * 语义编辑两态：
 * - 非活跃块（光标不在块内）：完全渲染，零语法标记可见。
 * - 活跃块（光标在块内）：结构标记以低透明度显示，行内标记仍隐藏。
 *
 * IME 守卫：伴生 ViewPlugin 监听 compositionstart/compositionend 写模块级
 * `composing` 标志；组合期间文档变更时 StateField 跳过重算（否则中间态会让
 * 装饰反复增删、闪烁），compositionend 再派发 `rebuildAfterComposition` 补建。
 *
 * 冻结机制：pointerdown 后冻结约 100ms，避免「点击移动光标 → 活跃块揭示 →
 * 重排」造成的视觉跳动；解冻时派发 `unfreezeRebuild` 补建。
 *
 * 多实例安全：`composing` / `frozen` 是模块级标志，IME 组合与指针事件都是
 * 浏览器单例，多编辑器实例共用安全。
 *
 * 本批装配五个基础模块（标题 / 加粗斜体 / 列表 / 引用 / 代码）、四个简型
 * 块级模块（分割线 / 链接 / 图片 / mermaid）、表格模块（`table` +
 * `cell-selection` + `cell-toolbar`）与两个容器模块（`callout` + `columns`）。
 * `EditorDecorationsOptions` 已留出扩展位，后续加字段不需要改函数签名。
 */
import type { Extension, EditorState, Range } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
} from "@codemirror/view";
import { createHeadingDecorations } from "./heading";
import { createBoldItalicDecorations } from "./boldItalic";
import { createListDecorations } from "./list";
import { createQuoteDecorations } from "./quote";
import { createCodeDecorations } from "./code";
import { createHrDecorations } from "./hr";
import { createLinkDecorations } from "./link";
import { createImageDecorations, type ImageResolver } from "./image";
import {
  createMermaidDecorations,
  type MermaidHydrator,
  type MermaidTheme,
} from "./mermaid";
import {
  createTableDecorations,
  scheduleTableFlush,
  tableCellSelectionPainter,
} from "./table";
import { createCalloutDecorations, scheduleCalloutFlush } from "./callout";
import { createColumnsDecorations } from "./columns";
import { createStructuralTagDecorations } from "./structuralTags";
import { editorDecorationsThemeExt } from "./theme";
import { getBlocks, getBlockAt } from "../block-model";

/**
 * `editorDecorations()` 的选项，全部可选。
 *
 * 图片解析器与悬停回调、mermaid 水合器都从这里注入：装饰层不依赖应用层
 * 资源，缺省时图片退化成 alt 文字回退、mermaid 不出图。
 */
export interface EditorDecorationsOptions {
  /** 图片路径解析器；返回 null 时走 `[图片: path]` 文字回退。 */
  resolveImage?: ImageResolver;
  /** 点击图片「替换」按钮。 */
  onImageReplace?: (path: string) => void;
  /** 拖拽图片宽度松手后持久化（`from` 是图片 markdown 起点）。 */
  onImageResize?: (from: number, width: number) => void;
  /** 点击图片「删除」按钮。 */
  onImageDelete?: (path: string) => void;
  /** 点击图片「定位」按钮。 */
  onImageLocate?: (path: string) => void;
  /** mermaid 水合器；缺省时 mermaid 块不出图，源码保持可见。 */
  hydrateMermaid?: MermaidHydrator;
  /** 交给 mermaid 水合器的主题；缺省读文档根的 `data-theme`。 */
  mermaidTheme?: MermaidTheme;
}

// --- IME 组合守卫 -------------------------------------------------------------

/**
 * 模块级组合标志。由 ViewPlugin 的事件处理器写入，由 StateField 的 update 读取。
 *
 * 多编辑器实例安全：IME 组合是浏览器单例。
 */
let composing = false;

/**
 * compositionend 时派发的 effect，强制 StateField 按最终组合文本补建装饰。
 */
const rebuildAfterComposition = StateEffect.define<void>();

// --- 冻结机制 ----------------------------------------------------------------

/**
 * 模块级冻结标志。pointerdown 时置位，短延时后清除。避免点击引起光标移动 +
 * 装饰揭示时的重排。
 */
let frozen = false;

/**
 * 冻结解除时派发的 effect，强制补建。
 */
const unfreezeRebuild = StateEffect.define<void>();

// --- 装饰构建 ----------------------------------------------------------------

/**
 * 光标所在的活跃块范围。
 *
 * `getBlockAt` 用 `[from, to)` 判定，光标停在块末尾（标题行末、行内代码之后、
 * 空标题 `# ` 的结尾）时不算命中。但用户此刻显然就在这个块里编辑，所以末尾
 * 位置回退到「包含该位置的块」（`from <= pos <= to`）。上游没有这一步，
 * 结果是行尾光标永远看不到结构标记。
 */
function findActiveBlock(
  state: EditorState,
  cursorPos: number,
): { from: number; to: number } | null {
  const blocks = getBlocks(state);
  const block =
    getBlockAt(cursorPos, blocks) ??
    blocks.find((b) => cursorPos >= b.from && cursorPos <= b.to) ??
    null;
  return block ? { from: block.from, to: block.to } : null;
}

/**
 * 按当前 state 构建 DecorationSet。
 *
 * 块模型（getBlocks/getBlockAt）决定光标落在哪个块：活跃块里的装饰带
 * `cm-block-active`（语义揭示），其余块带 `cm-block-inactive`（完全渲染）。
 */
function buildDecorationSet(
  state: EditorState,
  options?: EditorDecorationsOptions,
): DecorationSet {
  const docText = state.doc.toString();
  const cursorPos = state.selection.main.head;

  const activeBlock = findActiveBlock(state, cursorPos);
  const activeFrom = activeBlock?.from ?? -1;
  const activeTo = activeBlock?.to ?? -1;

  const all: Range<Decoration>[] = [
    ...createHeadingDecorations(docText, activeFrom, activeTo),
    ...createBoldItalicDecorations(docText, activeFrom, activeTo),
    ...createListDecorations(docText, activeFrom, activeTo),
    ...createQuoteDecorations(docText, activeFrom, activeTo),
    ...createCodeDecorations(docText, activeFrom, activeTo),
    ...createHrDecorations(docText, activeFrom, activeTo),
    ...createLinkDecorations(docText, activeFrom, activeTo),
    ...createImageDecorations(docText, options?.resolveImage, {
      onImageReplace: options?.onImageReplace,
      onImageResize: options?.onImageResize,
      onImageDelete: options?.onImageDelete,
      onImageLocate: options?.onImageLocate,
    }),
    ...createMermaidDecorations(
      docText,
      activeFrom,
      activeTo,
      options?.hydrateMermaid,
      options?.mermaidTheme,
    ),
    ...createCalloutDecorations(docText, activeFrom, activeTo),
    ...createTableDecorations(docText, activeFrom, activeTo),
    ...createColumnsDecorations(docText),
    ...createStructuralTagDecorations(docText),
  ];

  // 按起点排序（CM6 要求）
  all.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  return Decoration.set(all, true);
}

// --- StateField --------------------------------------------------------------

/**
 * 按选项创建 StateField。每次 `editorDecorations()` 调用得到独立实例，
 * 不同编辑器可以带不同选项。
 */
function createDecorationField(options?: EditorDecorationsOptions) {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorationSet(state, options);
    },
    update(decos, tr) {
      // IME 组合期间文档变更跳过重算：中间组合文本会让装饰反复增删、闪烁。
      if (composing && tr.docChanged) return decos;

      // 冻结（pointerdown）只跳过「纯选区」事务：延迟重建正是避免点击移动
      // 光标时活跃块揭示重排的手段。文档变更绝不能返回旧 DecorationSet——
      // 它的范围是按旧文档算的，套到新文本上会让可见层落后于源码
      // （「格式删不掉」，#226）。
      if (frozen && tr.selection && !tr.docChanged) return decos;

      // 文档/选区变化、组合结束、冻结解除时重建。
      if (
        tr.docChanged ||
        tr.selection ||
        tr.effects.some((e) => e.is(rebuildAfterComposition)) ||
        tr.effects.some((e) => e.is(unfreezeRebuild))
      ) {
        return buildDecorationSet(tr.state, options);
      }
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

// --- ViewPlugin（IME 守卫 + 冻结的伴生插件） ----------------------------------

/**
 * 跟踪 IME 组合与冻结状态的 ViewPlugin。
 *
 * `StateField.update(value, tr)` 拿不到 `EditorView.composing`（Transaction 没有
 * view），所以由这个伴生插件桥接：写模块级 `composing` 标志，compositionend
 * 时派发 `rebuildAfterComposition`。
 *
 * 冻结：pointerdown 时置 `frozen = true` 并在 100ms 后清除，避免点击引起光标
 * 移动 + 装饰揭示时的重排。
 */
const compositionGuard = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      composing = true;
    },
    compositionend(_e, view) {
      composing = false;
      view.dispatch({ effects: rebuildAfterComposition.of(undefined) });
    },
    pointerdown(_e, view) {
      if (frozen) return;
      frozen = true;
      // 100ms 后解冻并派发重建 effect，StateField 的 update 会据此补建。
      setTimeout(() => {
        frozen = false;
        view.dispatch({ effects: unfreezeRebuild.of(undefined) });
      }, 100);
    },
  },
});

/**
 * 在插件离开配置时 flush 暂存的表格单元格文本——模式切换与拆除这两条没有
 * blur 可以落定的路径。
 *
 * 用 `fromClass` 是因为 PluginSpec 没有 `destroy` 钩子；只有类插件值会收到一个。
 */
class tableFlushGuard {
  constructor(private readonly view: EditorView) {}

  destroy(): void {
    // 在 CM6 update 内调用，同步派发非法，所以延后。
    scheduleTableFlush(this.view);
    scheduleCalloutFlush(this.view);
  }
}

const tableFlush = ViewPlugin.fromClass(tableFlushGuard);

/**
 * 活源码装饰扩展。
 *
 * ```ts
 * decorCompartment.of(editorDecorations())
 * ```
 */
export function editorDecorations(
  options?: EditorDecorationsOptions,
): Extension {
  return [
    createDecorationField(options),
    compositionGuard.extension,
    tableFlush.extension,
    tableCellSelectionPainter(),
    editorDecorationsThemeExt,
  ];
}

/** 测试用：重置模块级守卫标志，避免用例之间互相污染。 */
export function resetDecorationGuards(): void {
  composing = false;
  frozen = false;
}

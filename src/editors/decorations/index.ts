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
import type {
  Extension,
  EditorState,
  Range,
  Transaction,
} from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { createHeadingDecorations } from "./heading";
import { createBoldItalicDecorations } from "./boldItalic";
import { createListDecorations } from "./list";
import { createQuoteDecorations } from "./quote";
import { createCodeDecorations } from "./code";
import { createHrDecorations } from "./hr";
import { createLinkDecorations } from "./link";
import { createImageDecorations, type ImageResolver } from "./image";
import type { FileEmbedResolver } from "./fileEmbed";
import {
  getSelectedImageFrom,
  moveImageSelection,
  scheduleImageToolbarReposition,
  setImageToolbarActions,
} from "./imageToolbar";
import {
  createMermaidDecorations,
  type MermaidHydrator,
  type MermaidTheme,
} from "./mermaid";
import { createMathDecorations } from "./math";
import { mathEditor } from "../orchestration/math-editor";
import {
  createTableDecorations,
  scheduleTableFlush,
  tableCellSelectionPainter,
} from "./table";
import { createCalloutDecorations, scheduleCalloutFlush } from "./callout";
import {
  columnsRebuildFrozen,
  columnsRefresh,
  createColumnsDecorations,
  noteColumnDocChanged,
} from "./columns";
import { createStructuralTagDecorations } from "./structuralTags";
import { createAlignFenceDecorations } from "./alignFence";
import { createFoldDecorations, foldState } from "./fold";
import {
  createFrontmatterHideDecorations,
  type FrontmatterHideOptions,
} from "./frontmatterHide";
import { editorDecorationsThemeExt } from "./theme";
import { getBlocks, getBlockAt } from "../block-model";

export type { FrontmatterHideOptions } from "./frontmatterHide";

/**
 * `editorDecorations()` 的选项，全部可选。
 *
 * 图片解析器与悬停回调、mermaid 水合器都从这里注入：装饰层不依赖应用层
 * 资源，缺省时图片退化成 alt 文字回退、mermaid 不出图。
 */
export interface EditorDecorationsOptions {
  /** 图片路径解析器；返回 null 时走 `[图片: path]` 文字回退。 */
  resolveImage?: ImageResolver;
  /** 内嵌文件解析器；返回可加载 URL 与本地绝对路径，缺省不出内嵌内容。 */
  resolveEmbed?: FileEmbedResolver;
  /** 工具条「AI 编辑」：prompt 引用图片路径与 alt。 */
  onImageAi?: (path: string, alt: string) => void;
  /** 工具条「裁剪」；缺省时按钮禁用。 */
  onImageCrop?: (from: number) => void;
  /** 工具条「重置图片」：清除 crop 并还原整图显示尺寸。 */
  onImageReset?: (from: number) => void;
  /** 工具条「描述」：让选中图片的描述行进入编辑态。 */
  onImageComment?: (from: number) => void;
  /** 描述行提交：把标题写回图片 markdown 的引号段。 */
  onImageSetTitle?: (from: number, title: string) => void;
  /** 工具条对齐：left/right 写 align，center 清除。 */
  onImageAlign?: (from: number, align: "left" | "center" | "right") => void;
  /** 工具条「剪切」：复制图片 markdown 后删除块。 */
  onImageCut?: (from: number) => void;
  /** 工具条「复制」：图片 markdown（含属性块）写入剪贴板。 */
  onImageCopy?: (from: number) => void;
  /** 工具条「删除」：删除图片所在块。 */
  onImageDelete?: (from: number) => void;
  /** mermaid 水合器；缺省时 mermaid 块不出图，源码保持可见。 */
  hydrateMermaid?: MermaidHydrator;
  /** 交给 mermaid 水合器的主题；缺省读文档根的 `data-theme`。 */
  mermaidTheme?: MermaidTheme;
  /**
   * 面板可见且编辑态时隐藏文档开头 frontmatter 源码块；null/缺省不隐藏。
   * 由 ContentArea 按属性面板显隐档 + 折叠态注入，随 `decorCompartment`
   * 热重配（不重建 EditorView）。
   */
  frontmatterHide?: FrontmatterHideOptions | null;
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

/** 全量构建次数——性能门禁的机读指标（仅测试消费）。 */
let decorationBuildCount = 0;

export function getDecorationBuildCount(): number {
  return decorationBuildCount;
}

/**
 * 全量构建的累计主线程耗时（ms）——性能门禁的机读指标（仅测试消费）。
 *
 * 与 `decorationBuildCount` 配套：次数说明「重建了几次」，耗时说明
 * 「每次多贵」。#1556 的根因诊断靠这两个数区分「阈值断层」与「每键全量重建」。
 */
let decorationBuildMs = 0;

export function getDecorationBuildMs(): number {
  return decorationBuildMs;
}

/**
 * 冻结解除时派发的 effect，强制补建。
 */
const unfreezeRebuild = StateEffect.define<void>();

// --- 大文档键入快路径 ---------------------------------------------------------

/**
 * 超过该字符数的文档，逐字键入走「映射 + 延迟重建」而非每键全量重算。
 *
 * 分级而非单一阈值：实测 14KB 文档每键全量重建 47ms（p50 56.9ms），已远超
 * 16ms 一帧预算，而 50K 阈值让它享受不到快路径（#1556）。阈值取 8K——
 * 该量级下全量重建仍在 16ms 内，快路径收益不抵复杂度；8K 以上重建成本
 * 开始吃掉帧预算，交给快路径。
 */
const LARGE_DOC_CHARS = 8_000;

/** 最后一次键入后补一次全量重建的延迟（ms）。 */
const LAZY_REBUILD_MS = 180;

/**
 * 走了快路径的事务。伴生 ViewPlugin 据此判断该不该安排一次延迟重建；
 * 用 WeakSet 按事务实例登记，多编辑器实例互不干扰。
 */
const lazyTypedTransactions = new WeakSet<Transaction>();

/**
 * 普通逐字键入：行数不变，用户事件是 `input.type`。
 *
 * 行数/结构变化必须立即全量重建（标题、列表、围栏、callout 的范围都可能变），
 * 只有同一行内的打字可以安全地用映射保持装饰有效。
 */
function isPlainTyping(tr: Transaction): boolean {
  return (
    tr.docChanged &&
    tr.newDoc.lines === tr.startState.doc.lines &&
    tr.isUserEvent("input.type")
  );
}

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
  columnsRanges?: Range<Decoration>[],
): DecorationSet {
  const startedAt = performance.now();
  const docText = state.doc.toString();
  const cursorPos = state.selection.main.head;
  const selFrom = state.selection.main.from;
  const selTo = state.selection.main.to;

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
    ...createImageDecorations(
      docText,
      options?.resolveImage,
      {
        onImageAi: options?.onImageAi,
        onImageCrop: options?.onImageCrop,
        onImageReset: options?.onImageReset,
        onImageComment: options?.onImageComment,
        onImageSetTitle: options?.onImageSetTitle,
        onImageAlign: options?.onImageAlign,
        onImageCut: options?.onImageCut,
        onImageCopy: options?.onImageCopy,
        onImageDelete: options?.onImageDelete,
      },
      options?.resolveEmbed,
    ),
    ...createMermaidDecorations(
      docText,
      activeFrom,
      activeTo,
      options?.hydrateMermaid,
      options?.mermaidTheme,
    ),
    ...createMathDecorations(docText, selFrom, selTo),
    ...createCalloutDecorations(docText, activeFrom, activeTo),
    ...createTableDecorations(docText, activeFrom, activeTo),
    ...(columnsRanges ?? createColumnsDecorations(docText)),
    ...createStructuralTagDecorations(docText),
    ...createAlignFenceDecorations(docText),
    ...createFoldDecorations(state, state.field(foldState)),
  ];

  // frontmatter 隐藏是替换装饰：区间内既有装饰（如 hr 把 `---` 当分割线）
  // 必须剔除，否则孤立的行样式会落到正文首行。
  const fmh = createFrontmatterHideDecorations(state, options?.frontmatterHide);
  if (fmh) {
    const intersectsHidden = (d: Range<Decoration>): boolean =>
      d.from === d.to
        ? d.from >= fmh.from && d.from < fmh.to
        : d.from < fmh.to && d.to > fmh.from;
    const kept = all.filter((d) => !intersectsHidden(d));
    all.length = 0;
    all.push(...kept, ...fmh.decorations);
  }

  // 按起点排序（CM6 要求）
  all.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  decorationBuildCount += 1;
  decorationBuildMs += performance.now() - startedAt;
  return Decoration.set(all, true);
}

// --- StateField --------------------------------------------------------------

/**
 * 按选项创建 StateField。每次 `editorDecorations()` 调用得到独立实例，
 * 不同编辑器可以带不同选项。
 */
function createDecorationField(options?: EditorDecorationsOptions) {
  let lastColumns: Range<Decoration>[] = [];
  return StateField.define<DecorationSet>({
    create(state) {
      lastColumns = createColumnsDecorations(state.doc.toString());
      return buildDecorationSet(state, options, lastColumns);
    },
    update(decos, tr) {
      // IME 组合期间文档变更不做全量重建（中间态会让装饰反复增删、闪烁），
      // 但必须按 changes 映射：返回旧范围会让视图 tile 树与文档错位并崩溃。
      if (composing && tr.docChanged) return decos.map(tr.changes);

      // 冻结（pointerdown）只跳过「纯选区」事务：延迟重建正是避免点击移动
      // 光标时活跃块揭示重排的手段。文档变更绝不能返回旧 DecorationSet——
      // 它的范围是按旧文档算的，套到新文本上会让可见层落后于源码
      // （「格式删不掉」，#226）。
      if (frozen && tr.selection && !tr.docChanged) return decos;

      // 大文档逐字键入：映射保持装饰有效，由伴生插件延迟补一次全量重建。
      if (tr.startState.doc.length >= LARGE_DOC_CHARS && isPlainTyping(tr)) {
        lazyTypedTransactions.add(tr);
        return decos.map(tr.changes);
      }

      // 文档/选区变化、折叠切换、组合结束、冻结解除时重建。
      const foldChanged =
        tr.startState.field(foldState, false) !==
        tr.state.field(foldState, false);
      if (
        tr.docChanged ||
        tr.selection ||
        foldChanged ||
        tr.effects.some((e) => e.is(rebuildAfterComposition)) ||
        tr.effects.some((e) => e.is(unfreezeRebuild)) ||
        tr.effects.some((e) => e.is(columnsRefresh))
      ) {
        // 文档改动后选中的图片可能已消失（删除/剪切）：下一帧检查并收掉工具条。
        // 但纯文本输入每键都重定位会让工具条与图片抖动（#1320）——先按变更把
        // 选中偏移映射到新文档，只有偏移真的动了才重定位。
        if (tr.docChanged) {
          const selectedFrom = getSelectedImageFrom();
          if (selectedFrom !== null) {
            moveImageSelection(
              tr.changes.mapPos(selectedFrom, 1),
              tr.state.doc,
            );
          } else {
            scheduleImageToolbarReposition();
          }
        }
        // 分栏编辑器打开期间：沿用同一批 widget 实例（仅映射范围），保住持有
        // 输入框的 DOM；否则位移引发的重建会摘掉 textarea。
        if (tr.docChanged && columnsRebuildFrozen()) {
          noteColumnDocChanged();
          lastColumns = lastColumns
            .map((range) => ({
              ...range,
              from: tr.changes.mapPos(range.from, 1),
              to: tr.changes.mapPos(range.to, 1),
            }))
            // 整块被删/折叠时映射会塌成 from >= to：丢弃该冻结范围，避免空区间
            // widget 与 blur 吞掉导致的静默丢字。
            .filter((range) => range.from < range.to);
          return buildDecorationSet(tr.state, options, lastColumns);
        }
        lastColumns = createColumnsDecorations(tr.state.doc.toString());
        return buildDecorationSet(tr.state, options, lastColumns);
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
class CompositionGuard {
  private timer = 0;

  constructor(private readonly view: EditorView) {}

  update(u: ViewUpdate): void {
    if (!u.docChanged) return;
    if (!u.transactions.some((tr) => lazyTypedTransactions.has(tr))) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.view.dispatch({ effects: rebuildAfterComposition.of(undefined) });
    }, LAZY_REBUILD_MS);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
  }
}

const compositionGuard = ViewPlugin.fromClass(CompositionGuard, {
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
  setImageToolbarActions({
    onImageAi: options?.onImageAi,
    onImageCrop: options?.onImageCrop,
    onImageReset: options?.onImageReset,
    onImageComment: options?.onImageComment,
    onImageSetTitle: options?.onImageSetTitle,
    onImageAlign: options?.onImageAlign,
    onImageCut: options?.onImageCut,
    onImageCopy: options?.onImageCopy,
    onImageDelete: options?.onImageDelete,
  });
  return [
    foldState,
    createDecorationField(options),
    mathEditor(),
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
  decorationBuildCount = 0;
  decorationBuildMs = 0;
}

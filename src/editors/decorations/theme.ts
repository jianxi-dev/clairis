/* 活源码装饰主题（精简自 md-bundle packages/editor/src/decorations/theme.ts）。
 *
 * 装饰模块只输出 DOM 类名（`.cm-strong`、`.cm-quote`、…），真正让它们在编辑态
 * 看起来像渲染后的 Markdown 的是这个主题。外观规则落在 `src/styles/editor.css`
 * （可被 CSS manifest 检查），这里只补两条 CSS 表达不了的东西：
 *
 * 1. 行高稳定：装饰揭示只改透明度，行高必须固定，否则光标进出块会跳。
 * 2. 标记过渡：透明度 120ms 淡入淡出，状态切换不突兀。
 *
 * 上游 1085 行版本里的块级装饰（表格 / 分栏 / 高亮块 / 图片 / mermaid）与
 * reader CSS 变量桥接属块级装饰批次，这里不搬。
 */
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * 五个基础装饰模块共用的基础主题。
 */
export const editorDecorationsTheme: Extension = EditorView.baseTheme({
  // 所有被装饰的行固定行高：标记揭示只改透明度，不改布局。
  ".cm-content .cm-line": {
    lineHeight: "1.7em",
    transition: "opacity 100ms ease-out",
  },
  // 结构标记（标题 `#`、有序列表序号、引用 `>`、行内代码反引号）淡入淡出。
  ".cm-content .cm-heading-marker, .cm-content .cm-list-marker, .cm-content .cm-quote-marker-active, .cm-content .cm-code-marker-active":
    {
      transition: "opacity 120ms ease-out",
    },
});

/** 组合后的装饰主题扩展。 */
export const editorDecorationsThemeExt: Extension = editorDecorationsTheme;

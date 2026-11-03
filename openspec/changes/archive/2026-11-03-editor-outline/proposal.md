# Proposal: 编辑器大纲浮层（移植 md-bundle OutlineMenu）

## Why

用户实测：**大纲按钮没移植过来**。当前只有侧栏「目录」面板，编辑器内容区右上角没有大纲入口；md-bundle 在内容面板右上角有一个 ghost 图标，悬停/点击弹出大纲浮层，点击标题直接跳转。

侧栏大纲也有两个问题：解析器是简化版（只处理成对的 ```，不认 `~~~` 与未闭合围栏，缩进围栏也不认），点击靠「全文搜标题文本」定位，同名标题会跳错。

## What Changes

1. 新增 `src/lib/outline.ts`：code-fence aware 的 `extractHeadings`（```/~~~、未闭合吃到文末、0-based 行号），以及预览 DOM 的 `headingsFromDom`。
2. 新增 `src/components/Content/OutlineMenu.tsx`：内容区右上角按钮 + 浮层；悬停展开、点击钉住、Esc/点外部收起；编辑/源码走 CM6 行号滚动，预览走 DOM `scrollIntoView`；高亮当前可见标题。
3. `ContentArea` 在 markdown 页签挂载该组件（读同一份页签内容与编辑器实例）。
4. 侧栏 `Outline.tsx` 改用同一个解析器，点击改为按行号定位（去掉全文搜文本）。

## Capabilities

### New Capabilities

- `editing`：新增 E-10「编辑器大纲浮层」。

## Impact

- `src/lib/outline.ts`（新）、`src/components/Content/OutlineMenu.tsx`（新）、`ContentArea.tsx`、`Sidebar/Outline.tsx`、`src/styles/editor.css`
- 测试：`src/__tests__/components/Sidebar/Outline.test.ts`（改为直接测共享解析器）、`e2e/outline-menu.spec.ts`（4 条）
- 无 Rust 改动。

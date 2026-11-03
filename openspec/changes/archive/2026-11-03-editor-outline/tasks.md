# Tasks: 编辑器大纲浮层

## 1. 解析

- [x] 1.1 `src/lib/outline.ts`：`extractHeadings`（```/~~~、未闭合、0-based 行号）+ `headingsFromDom`。
- [x] 1.2 侧栏 `Outline.tsx` 改用共享解析器，点击按行号定位。

## 2. 浮层

- [x] 2.1 `OutlineMenu.tsx`：悬停展开 / 点击钉住 / Esc / 点外部收起；`aria-expanded`、`role=menu`。
- [x] 2.2 编辑/源码按 CM6 viewport 高亮当前标题，预览按 DOM 位置；切页签重置。
- [x] 2.3 `ContentArea` 挂载（markdown 页签），位置让开预览的 Aa 钮。
- [x] 2.4 `editor.css` 大纲按钮/浮层样式（语义色，无硬编码）。

## 3. 验证

- [x] 3.1 单测：`Outline.test.ts` 8 条（改为直接测真实解析器）。
- [x] 3.2 e2e：`outline-menu.spec.ts` 4 条（列表跳过代码块 / 点击滚动 / Esc / 预览 DOM / 切页签）。
- [x] 3.3 `bash scripts/verify.sh` 全绿。

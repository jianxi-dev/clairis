# Proposal: 工具条按节点类型分化（H5）

## Why

E-19 的工具条对**所有**元素显示同一套控件。对照 WorkBuddy 的实际形态（截图确认）：

- **文字块**：字号、粗体/斜体/下划线/删除线、链接、对齐、文字颜色、删除
- **底层区块**：布局、背景、边框、删除

两者明显不是一套东西。现在选中一个 `<section>` 也会看到「字号」「粗体」——给容器加粗体没有意义；选中一个 `<p>` 又看不到背景/边框。控件挤在一行里，多数时候一半用不上。

## What Changes

1. **按节点类型给两套控件**：
   - 文本块（p / h1–h6 / li / blockquote / span / a / strong / em / code / td …）：标签、字号、粗体、斜体、下划线、删除线、链接（`<a>` 才有）、对齐、文字颜色
   - 区块容器（div / section / article / header / footer / nav / ul / ol / table / figure …）：标签、对齐、背景色、边框
2. **两者共有**：class / id、截图、删除元素、关闭。
3. **新增删除元素**（`applyNodeRemove`）：WorkBuddy 两个工具条都有；不可删 `html`/`body`（等于清空整篇）。

## Capabilities

### New Requirements

- **E-22 HTML 可视化编辑：工具条按节点类型分化**

### Modified Requirements

- **E-19**（工具条）：不再是单一控件集，改为按节点类型两套；新增删除元素。

## Impact

- 前端：`src/editors/html/edit.ts`（`TEXT_TAGS` / `BLOCK_TAGS` / `nodeKindOf` / `toggleDecoration` / `applyNodeRemove`）、`src/components/Content/HtmlEditToolbar.tsx`（两套渲染）、`src/components/Content/HtmlVisualEditor.tsx`（样式改动改为基于最新文档求值）、`src/styles/editor.css`（分组分隔线）
- 规格：`openspec/specs/editing/spec.md` 增 E-22、改 E-19

## Non-goals

- 不做字符级选区格式（选中几个字加粗）。当前 B/I/U/S 作用于**整个元素**；字符级需要 iframe 内上报 Range 与按 Range 改写 DOM，是另一个量级，另立 change。
- 不做 WorkBuddy 的「AI 编辑」按钮（本仓库没有该链路）。
- 不做区块的布局/栅格控件（WorkBuddy 那个图标对应它自己的页面栅格能力，我们没有同类模型）。

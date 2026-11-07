# Proposal: HTML 可视化编辑工具条（H3）

## Why

E-16（change `html-visual-editing`）交付了 HTML 可视化编辑的骨架：点选高亮、双击改字、Enter 拆块、保存零残留。但「选中一个元素之后能做什么」只有**改文本**一项。

用户实际要的下一层操作——把 `h2` 换成 `h3`、调段落对齐、改字号、给元素加 class——仍得切到源码模式手改 HTML。这正是逆向报告 §3.4 里 WorkBuddy 那套 iframe 内交互清单中的三类：`replaceTag` / `patchStyle` / `patchAttr`。本仓库对应「点选 + 改字 + 拆块」的部分已落地，工具条整块缺失。

## What Changes

1. **工具条**：选中元素后浮出工具条，跟随高亮框定位，不遮挡被选中区域。
2. **三类操作**：替换标签（`replaceTag`）、改样式（字号 / 文字颜色 / 对齐）、改属性（`class` / `id`）。
3. **落回 content**：全部改动折算回 `content` 文本（inline `style` + 属性），沿用 E-16 的「content 是唯一真相」。
4. **保存零残留**：仍走 E-16 的 `cleanSnapshot` 链路，工具条不引入新的编辑期属性。

## Capabilities

### New Requirements

- **E-19 HTML 可视化编辑工具条**：选中元素后 SHALL 提供改标签 / 改样式 / 改属性的工具条，改动 SHALL 反映到 `content` 且保存后不留编辑痕迹。

### Modified Requirements

- **E-16**（HTML 可视化编辑）：新增「选中后可改标签、样式、属性」的场景，与既有「改文本」并列。

## Impact

- 前端（editing 域）：
  - `src/editors/html/edit.ts`：新增三个纯函数（标签替换 / 样式合并 / 属性写入）
  - `src/editors/html/bridge.ts`、`runtime.ts`：选区几何上报（工具条定位用）
  - `src/components/Content/HtmlVisualEditor.tsx`、新增 `HtmlEditToolbar.tsx`
  - `src/styles/editor.css`：工具条样式
- 规格：`openspec/specs/editing/spec.md` 增 E-19、改 E-16
- 不触碰：CM6 三模式不 remount 机制、预览态 CSP、保存命令（Rust 侧无改动）

## Non-goals

- 不做拖拽移动节点、区域截图（报告 §3.4 的另两项，另立 change）。
- 不做任意 CSS / 任意属性的自由编辑——工具条只给固定档位，否则它会退化成又一个代码输入框。
- 不做工具条内的撤销栈（撤销仍由 `content` 派生的既有链路负责）。
- 不提供 `style` 之外的内联样式机制（不生成 `<style>` 块、不改用户样式表）。

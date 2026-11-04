# Proposal: HTML 编辑闭环（源码 + 预览，H1）

## Why

`editing` 域已有 E-4「HTML 源码编辑」（`html()` 模式 + 高亮），代码也接了（`ContentArea.tsx` 的 `case "html"`）。但那只是「能敲字」，不构成闭环：预览、相对资源、模式切换的验收都没定义。

`/Users/mason/ToHighs/clairis/.omo/wayfinder/implementation-sequence.md` 把 HTML 编辑拆成两步：

- **H1 `html-edit-loop`（S）** ← 本 change：源码 + 预览最小闭环
- **H2 `html-visual-editing`（XL）**：WorkBuddy 等价的可视化编辑

H2 依赖 H1 与 C8。先把 H1 做掉，H2 的底座（iframe srcdoc、相对资源、三模式不 remount）才有东西可站。

## What Changes

1. `.html` 文件的预览走 iframe（`srcdoc` + sandbox），而不是当纯文本渲染。
2. 相对路径资源（CSS/图片）在预览里可加载：注入 `<base>` 或走 asset protocol。
3. 三模式（预览/编辑/源码）切换不 remount EditorView，编辑内容实时同步到预览。
4. 保存写回保持字节不变（除用户编辑外）。

## Capabilities

### New Requirements

- E-15 HTML 编辑闭环

## Impact

`ContentArea.tsx`（模式装配）、`PreviewView`/`HtmlPreview`（iframe 渲染与 base 注入）、`src/renderers/html.ts`（相对路径重写已有基础）。无 Rust 改动。

## 不在本 change

- H2 的节点模型 / Bridge / 全量快照（等逆向报告补回：`docs/research/technical/workbuddy-html-visual-editing-逆向报告.md` 目前是断链）
- contentweave 生成物仍是只读编译产物（#27 裁定）

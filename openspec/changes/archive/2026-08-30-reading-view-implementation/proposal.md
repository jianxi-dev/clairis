# Proposal: reading 域规格落地（Markdown 查看功能实现与完善）

## Why

`openspec/specs/reading/spec.md`（A-1~A-9）已批准，但代码实现与规格存在重大差距：A-5 沉浸阅读只有进入按钮（无 `Cmd+\`、无 0.3s 过渡、侧栏/Tab 栏不隐藏）；A-9 墨线进度指示与滚动位置恢复完全未实现（`scrollPos` 为空壳字段）；A-6 字号缩放存在默认值偏离（实现 16px vs 规格 17px）与 HTML 预览 rem 注入缺失；A-2 任务列表 checkbox 被消毒白名单剥除。本次把 Markdown 查看功能按已批准规格补齐，使阅读体验达到可验收标准。

## What Changes

- **A-5 沉浸阅读完整落地**：`Cmd+\` 进入/退出（`Esc` 退出已有）；进入/退出各 0.3s chrome 淡出/淡入过渡（主文档区不动）；沉浸态隐藏工具栏、侧栏、Tab 栏与分割线；屏幕上边缘 2px 悬停 ≥400ms 浮出 chrome，移出 2s 后淡出；`Shift+Cmd+T` 切换 chrome 显隐；沉浸态不触发任何文件操作；分屏下分割线隐藏、双文档并排、共享全局字号。
- **A-9 墨线 + 滚动位置恢复**：阅读模式右边缘 2px 墨线进度指示（rAF 约 16ms 节流，已读深/未读浅自然过渡，无额外标记）；沉浸态与编辑态隐藏（分屏时仅预览 pane 显示）；滚动停止 200ms debounce 写入 `tabs[].scrollPos`，切换/关闭 tab 与关闭窗口时立即写入；重开文档按像素（高度未变）/百分比（高度变化）恢复，无记录跳顶部。
- **A-6 字号缩放对齐**：默认字号 16px → 17px（前后端默认值与加载回退同步）；预览渲染按固定倍率层级缩放（正文 1.0x、H1 1.85x、H2 1.6x、H3 1.4x、H4 1.25x、H5 1.15x、H6 1.1x、代码 0.9x）；HTML 预览 iframe 注入根字号（仅同源可注入，rem/em/% 跟随、px 不变）。
- **A-2 任务列表修正**：DOMPurify 白名单放行任务列表 checkbox（`input[type=checkbox][disabled]`），任务列表以勾选框 + 已完成划线样式渲染。
- **A-1 冷启动 / A-8 滚动性能**：作为验收项纳入 verify 手动清单，无代码改动（大文件 guard 已存在）。

## Capabilities

### New Capabilities

<!-- 无新能力：本变更全部为落实现有 reading 规格（A-1~A-9） -->

### Modified Capabilities

<!-- 无规格行为变更：reading 规格 A-1~A-9 的 requirement/scenario 保持原样，本变更仅把已批准行为落到代码；实现偏差（字号默认值、任务列表 checkbox、HTML rem 注入）属实现缺陷修复，不改规格 -->

- `reading`：(无 requirement 变更，仅实现落地)

## Impact

- **前端（主要）**：
  - `src/App.tsx` — `Cmd+\` 沉浸快捷键、沉浸态 chrome 层挂接
  - `src/components/Content/ContentSplitView.tsx` / `src/components/Layout.tsx` — 沉浸态隐藏 Tab 栏/侧栏/分割线的 class 联动
  - `src/components/Content/PreviewView.tsx` — 墨线组件挂接、任务列表样式生效
  - 新增墨线组件（右边缘进度条，rAF 节流）
  - `src/stores/index.ts` — `scrollPos` 读写动作（保存/恢复/清空时机）
  - `src/renderers/markdown.ts` — DOMPurify 白名单放行任务列表 checkbox
  - `src/components/Content/HtmlPreview.tsx` — 同源 iframe 根字号注入
  - `src/styles/` — 沉浸过渡动画、墨线样式、预览倍率层级（editor.css / theme-light.css / theme-dark.css）
  - `src/hooks/useConfig.ts` / `src/stores/editorStore.ts` / `src-tauri/src/config.rs` — 默认字号 17px 对齐
- **测试**：`src/__tests__/` 新增 scrollPos 保存/恢复、墨线节流、沉浸快捷键映射、任务列表 sanitize 测试；E2E（`e2e/tauri/`）沉浸进出 + 位置恢复路径
- **无新依赖、无后端命令新增**

## 验收门槛

- `bash scripts/verify.sh` 全绿（tsc / eslint / vitest / CSS manifest / cargo check / Playwright）
- 手动验收：`npm run tauri dev` 下按 reading 规格逐 scenario 走查（沉浸进出、墨线显隐、位置恢复、字号倍率、任务列表勾选渲染）
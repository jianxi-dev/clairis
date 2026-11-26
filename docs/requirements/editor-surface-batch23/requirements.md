# editor-surface-batch23 — 图片工具第三批

**Spec issue**: https://github.com/jianxi-dev/clairis/issues/1558
**日期**: 2026-11-26
**输入源**: 用户对话反馈 7 条 + 截图 2 张（`.artifacts/editor-surface-batch23/`：裁剪遗留标示线.png、图片查看工具条.png）

## What

图片工具第三轮打磨，四个面：

1. **裁剪稳定性修复**（对账 #1 #2 #3 #5）：多轮裁剪零残留（裁剪框/边柄/蒙层清除同步化）；首次裁剪确认零可感知跳动（探针定位来源后消除）；「重置图片」按钮仅在有 crop 属性时出现（对齐 E-39 既有规格）；裁剪标识线在图片已加载时必现、加载中显式提示。
2. **选中态工具条滚动抖动根治**（对账 #4a，方案A已确认）：滚动期间隐藏工具条（passive scroll + 40ms 防抖），停止滚动后一次定位显示；scroll 监听从 document 收窄到编辑器滚动容器；滚出视口判定改用 IntersectionObserver。
3. **放大层能力对齐 quiet**（对账 #6）：自定义 tooltip（深灰气泡，替代 WKWebView 不渲染的原生 title）；± 缩放按钮 + 当前缩放百分比显示；多图切换（prev/next + 「1/2」索引 + 键盘方向键）；既有 1:1/旋转/下载/重置/关闭保留。
4. **预览态图片双击查看**（对账 #7）：预览模式图片双击打开放大层，复用现有 maximize 实现；补主规格条款。

## Why

用户报告的多轮反馈均为实际使用障碍：裁剪残留标示线污染文档视觉、工具条抖动干扰滚动阅读、放大层缺基础缩放操作与多图浏览能力、预览态与编辑态交互不一致。既有规格（E-39 重置按钮条件、E-44 无残留裁剪框）已明文但实现未达标——属规格内缺陷清偿，非新方向探索。

## Scope

- 新 change：proposal + design + tasks.md，垂直切片，每票可独立在页面上看到变化（QG-7）
- 修复 + 新增全部落在图片工具域（decorations/imageToolbar.ts、image.ts、imageCrop.ts、preview 渲染管线、配套 CSS）
- e2e 全覆盖：残留计数归零、按钮条件显示、滚动期隐藏、放大层新控件、预览态双击
- QG-5 证据：state-coverage.json ≥4 态 + 抖动类 before/after 成对探针测量

## Non-goals

- 大文件录入性能（#1556）：已建缺陷票，走缺陷线独立修复，本 change 不触碰渲染管线性能路径
- editor-surface-batch20 未开工票（B5 媒体渲染等）：本批完成后协调，不并入
- 裁剪交互重设计：quiet 式整图+蒙层已在 batch22 落地，本批只修残量缺陷
- 放大层未涉及的新按钮（旋转/翻转等）：不在本批

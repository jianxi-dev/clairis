# Proposal: 同步 PDF 查看器能力与文本选择规格

## Why

pdf-viewer-upgrade 交付已实现（提交链 5354fff 依赖+wasm → badc411 PdfViewer → 97eb81d 接入 → b307ea9 disabledCategories 裁剪 → 29b07ee 文本选择更正），但 file-management 规格 C-1 的 PDF 表述仍停留在 iframe 时代（"PDF 内嵌查看"），与实现漂移：实际实现为功能完整的 PDF 阅读器（分页/缩放/搜索/缩略图/大纲/打印/旋转，中文界面），并裁剪了批注/导出等未启用功能。此外 2026-08-31 用户实测发现文字型 PDF 正文在 macOS 真机上可选中复制，与初版记录"文本选择受位图渲染限制暂不可用"不符，结论已调查确认（详见 `.omo/evidence/pdf-viewer-upgrade/textsel-investigation/conclusion.md`）。本变更将实现能力与实测结论同步进规格。

## What Changes

- **C-1 PDF 表述更新**（整体替换"PDF 内嵌查看"与 PDF 字符流）：
  - 媒体类 `.pdf` 文件 SHALL 以预览模式打开，渲染为功能完整的阅读器：分页滚动与页码导航、缩放与平移、全文搜索与结果高亮、缩略图与大纲侧栏、打印、旋转，界面文案为中文
  - PDF 查看器 SHALL 隐藏批注、导出、全屏、签名、表单、图章等未启用功能（界面不出现相关入口）
  - PDF 正文 SHALL 按位图渲染；SHALL 在 macOS 真机上支持文字型 PDF 正文文字选中与复制（实测确认 2026-08-31），扫描件/图片型 PDF 与无头自动化环境 SHALL 不可选
  - 保持既有不变量：媒体类文件 SHALL 禁止切换到编辑/源码模式、SHALL 禁止保存或自动保存回写
- **场景补充**：新增「PDF 查看器常用功能」「PDF 隐藏未启用功能」「文字型 PDF 正文可选中复制」「扫描件 PDF 正文不可选」四个场景
- **本变更不伴随新实现**：实现已完成（pdf-viewer-upgrade 14/14），tasks 全部标记完成，仅规格同步

## Capabilities

### New Capabilities

<!-- 无新能力：全部为 file-management 现有规格 C-1 的表述同步 -->

### Modified Capabilities

- `file-management`：C-1 PDF 相关——媒体类 `.pdf` SHALL 以预览模式打开并渲染为功能完整的阅读器（分页/缩放/搜索/缩略图/大纲/打印/旋转，中文界面）；查看器 SHALL 隐藏批注/导出/全屏/签名/表单/图章等未启用功能；PDF 正文 SHALL 按位图渲染，macOS 真机文字型 PDF 正文 SHALL 可选中复制（实测确认 2026-08-31），扫描件/图片型 PDF 与无头自动化环境 SHALL 不可选；媒体类文件 SHALL 禁止编辑与保存回写（不变量保持）。

## Impact

- **规格**：主规格文件 `openspec/specs/file-management/spec.md`（C-1 及场景）
- **代码**：无代码影响（纯规格与文档同步，不触碰产品代码/测试）
- **测试**：无（不引入新实现，无新测试）

## 验收门槛

- `openspec validate` 通过
- 主规格 `openspec/specs/file-management/spec.md` C-1 通读语义准确、无格式破损
- 变更归档：delta 合入主规格后变更目录移入 `openspec/changes/archive/2026-08-31-pdf-viewer-text-selection/`

# Tasks: 同步 PDF 查看器能力与文本选择规格

## 1. 修改 C-1 PDF 表述

- [x] 1.1 `openspec/changes/2026-08-31-pdf-viewer-text-selection/specs/file-management/spec.md`：整体替换"PDF 内嵌查看"——媒体类 `.pdf` SHALL 以预览模式打开并渲染为功能完整的阅读器（分页滚动与页码导航、缩放与平移、全文搜索与结果高亮、缩略图与大纲侧栏、打印、旋转，界面文案为中文）；查看器 SHALL 隐藏批注/导出/全屏/签名/表单/图章等未启用功能；PDF 正文 SHALL 按位图渲染，macOS 真机文字型 PDF 正文 SHALL 可选中复制（实测确认 2026-08-31），扫描件/图片型 PDF 与无头自动化环境 SHALL 不可选；媒体类文件禁止编辑与保存回写不变量保持

## 2. 补充 PDF 查看器场景

- [x] 2.1 新增场景：「PDF 查看器常用功能」（打开 `.pdf` 提供分页/缩放/搜索/缩略图/大纲/打印/旋转且界面中文）、「PDF 隐藏未启用功能」（批注/导出等入口不出现）、「文字型 PDF 正文可选中复制」（macOS 真机拖选可选中复制）、「扫描件 PDF 正文不可选」（扫描件/图片型拖选无法选中）

## 3. 校验

- [x] 3.1 `openspec validate` 通过；`openspec list` 显示 active change

## 4. 归档与交付

- [x] 4.1 归档：delta 合入主规格 `openspec/specs/file-management/spec.md`，变更目录移入 `openspec/changes/archive/2026-08-31-pdf-viewer-text-selection/`
- [x] 4.2 主规格 C-1 通读确认语义准确、无格式破损；证据存 `.omo/evidence/pdf-viewer-upgrade/task-11-openspec.txt`
- [x] 4.3 提交：`chore(openspec): 同步 PDF 查看器能力与文本选择规格`（仅 add openspec/ 下新增与修改）

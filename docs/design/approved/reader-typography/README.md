---
title: "已批准的 Markdown 预览排版设计（reader typography）。纸墨配色 + 卡片块边界，可插拔皮肤架构。"
type: design
status: accepted
last_updated: 2026-08-29
source_of_truth: supporting
---

# reader-typography

已批准的 Markdown 预览排版设计：解决预览"丑"的根因（排版系统缺失），以易读性 + 美感为核心。

| 文件 | 内容 |
|---|---|
| [spec.md](./spec.md) | 完整设计：现状诊断、token 体系、排版尺度、元素细则、代码高亮配色、公式 / Callout / 内嵌 HTML、实施清单与定案结论 |

探索过程（比稿与多轮反馈记录）保留在 `docs/design/explorations/reader-typography/`。

落地文件：

- `src/styles/tokens.css` — 全局语义色层（`--app-*`，强调色沿用 D7 indigo）
- `src/styles/reader.css` — 阅读排版系统（`--reader-*` 外观 + `--type-*` 尺度）
- `src/renderers/markdown.ts` — 渲染管线（高亮 / 公式 / Callout / 内嵌 HTML / 中西文间距）
- `src/renderers/highlight.ts`、`src/renderers/math.ts`
- `src/components/Content/PreviewView.tsx`、`src/components/Content/ReaderSettingsPopover.tsx`

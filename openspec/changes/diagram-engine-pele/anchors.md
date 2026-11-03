# 验收锚点 — diagram-engine-pele

锚点来源：本 change `design.md` D1–D9、`specs/diagram-rendering/spec.md` D-1–D-7、`specs/export/spec.md` EX-1、Obsidian 1.15 变更日志（2026-11-02，一手）、Pele 官方 Compatibility / Security 文档（一手）、仓库现状实测（`dist/assets` 分块体积、`mermaid@11.17.2`）。

## R-1 图表同步出图

引擎就绪后单次调用内出图；同文档多块共用同一引擎实例。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 单个合法图块渲染后 `.mermaid-view svg` 数量 | 1 | design D3/D4 |
| A-1.2 | exact | 同文档三个图块共用引擎的模块加载次数 | 1 | design D3 |
| A-1.3 | exact | 出图后可见的 `pre.mermaid` 数量 | 0 | 现状契约 renderers/mermaid.ts |

## R-2 主题跟随变量

图从 CSS 变量取色；深浅色切换不重渲。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 深色切换后现有 svg 被替换的次数 | 0 | design D5 |
| A-2.2 | exact | `--pele-bg` 与 `--app-surface` 解析值差异的字符数 | 0 | design D5 |
| A-2.3 | exact | 监听根节点 class 的 MutationObserver 数量 | 0 | design D5 |

## R-3 能力开关语义

关闭移除图、保留源码；重开恢复且不重复挂载。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 关闭能力后预览区 `.mermaid-view svg` 数量 | 0 | spec D-3 |
| A-3.2 | exact | 关闭能力后可见 `pre.mermaid` 数量 | 1 | spec D-3 |
| A-3.3 | exact | 关闭再开启后每个块内图表容器数量 | 1 | spec D-3 |

## R-4 错误降级

坏图只影响自身，保留源码与提示。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 非法语法块的可见源码数量 | 1 | spec D-4 |
| A-4.2 | exact | 同文档合法块的 svg 数量 | 1 | spec D-4 |

## R-5 协议白名单

链接只放行 http/https/mailto/tel；图片额外放行 asset/media。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 产出 SVG 中 `javascript:` 出现次数 | 0 | design D6 |
| A-5.2 | exact | 产出 SVG 中 `file:` 链接出现次数 | 0 | design D6 |
| A-5.3 | exact | `asset:` 图片在 SVG 中的 href 出现次数 | 1 | design D6 |

## R-6 编辑态两态与无残留

未激活显示图；激活显示围栏；反复切换不叠加。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | 光标进入/离开 mermaid 块 | 进入=显示围栏, 离开=显示图 | spec D-6 |
| A-6.2 | exact | 反复进出 5 次后块内图表容器数量 | 1 | spec D-6 |

## R-7 导出带图

导出 HTML / PNG 中图以 SVG 内联，不再只有源码。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 导出 HTML 图块位置内联 `<svg>` 数量 | 1 | spec EX-1 |
| A-7.2 | exact | 导出产物中 mermaid 围栏源码残留数量 | 0 | spec EX-1 |
| A-7.3 | exact | 导出 PNG 前 HTML 中 `<svg>` 数量下限 | 1 | spec EX-1 |

## R-8 中文标签排版

中文标签按实际字体测宽，不溢出节点。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 中文标签文本宽度超出节点宽度的像素 | 0 | spec D-7 |

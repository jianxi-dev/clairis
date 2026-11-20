# 变更提案：真机验收收尾——嵌入呈现修订 / 视频控制条按上下文显隐 / 页签最大宽度

## Why

2026-11-20 真机验收（第四轮反馈）在已归档的 `doc-property-embed`（#1157）与页签/视频既有交付上发现 4 处缺陷与 3 处规格级 refinement：折叠态「固定宿主条 + 正文虚线标签」双轨显示造成割裂；分栏（多窗格）下编辑态属性块不渲染（模块级单槽宿主交接互踩）；预览态块与正文列不同轴；拖拽字段插入位置错误；标题字段与页签重命名不同步（曾正常）；视频控制条的全屏/满页面宽度图标按用户裁定「仅 MD 嵌入视频需要，独立播放移除」；页签无最大宽度上限、单页签顶满整条（G-6「短标题按实际长度显示」被实现违背）。本 change 一次性收口。

## What Changes

- **doc-property-panel P-1 MODIFIED**：折叠态改为正文流内折叠条（展开/添加字段/模板/全选），SHALL NOT 渲染正文「文档属性 · N 个字段」摘要标签；含 frontmatter 文档编辑态 SHALL NOT 使用固定宿主；属性块下间距由布局 margin 提供（SHALL NOT 依赖正文空行），与正文同列轴心。
- **navigation「页签条与格头」+ application-shell「G-6」MODIFIED**：页签 SHALL NOT 伸展铺满；最大宽度 `--tab-max-width` = `--tab-info-width`（256px）；多页签溢出时等比收缩语义保留，保底仅约束收缩（下限 `min(96px, 内容宽)`）——修复 G-6「短标题按实际长度显示」被违背。
- **editor-surface-batch20 的 C-6 delta 修订（进行中 change 协同）**：独立视频播放页签控制条 SHALL NOT 显示「全屏 / 满页面宽度」图标；两能力 SHALL 仅在 MD 嵌入视频上下文提供（宽度档归 2.9）。
- **L/T 形态切换图标换形**（已确认方向）：一行条=三条不等长横线、双列=两个并排竖栏矩形；落 decisions.md 台账。
- **缺陷修复（随本 change 任务交付）**：多窗格属性块不渲染（去掉模块级单槽宿主交接，改按窗格自查 DOM）；预览态列对齐；拖拽字段插入位置错误（落点计算/插入索引修正）；标题字段与页签重命名同步（根因排查后修）。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `doc-property-panel`：P-1（折叠条嵌入、摘要标签移除、固定宿主边界、布局间距）。
- `navigation`：页签条与格头（不伸展 + 最大宽度 + 保底语义修订 + 2 新场景）。
- `application-shell`：G-6（同上语义 + 2 新场景）。
- `editor-surface-batch20`（进行中 change，delta 协同修订，不在本 change 归档范围）。

## Impact

- **前端**：`ContentArea.tsx` / `docPropertyEmbed.ts`（按窗格自查宿主 + 折叠条嵌入）/ `frontmatterHide.ts` / `DocPropertyBar.tsx`（拖拽索引 + 折叠条呈现）/ `doc-property.css`（间距、预览对齐）/ `ui/icons.ts`（L/T 图形）/ `VideoPlayer.tsx` + `MediaPlayerHost.tsx`（embedded prop）/ `TabBar.tsx` + `tokens.css`（`--tab-max-width`）/ `stores/index.ts` 或 `TabBar.tsx`（标题同步根因处）。
- **测试**：双窗格回归 e2e、拖拽中位插入 e2e、折叠条嵌入 e2e、短页签/单页签 e2e（更新 #1180 断言中与「不顶满」冲突的用例）、视频控制条显隐 e2e（更新 #905/#907 相关用例）。
- **数据面**：命中图标信号（icons.ts）→ design 必含六栏表。
- **不在范围**：MD 嵌入视频宽度档本体（batch20/2.9）、插件运行时。

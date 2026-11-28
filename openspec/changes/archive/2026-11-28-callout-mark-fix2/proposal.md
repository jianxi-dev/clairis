## Why

用户 2026-11-28 反馈：`highlight-mark-refine-v1` 落地后仍有五处修正——左侧边框缺失、emoji 裁切、预览 emoji 不跟随、预览多行合并、标注色板过宽无随机。已由 PR #1679 修复。

## What Changes

- **四边 1px**：预览态纯高亮块由「无左边框」改为「四边 1px 细边」（计算 `border-inline-start-width: 1px`），与编辑态一致。
- **预览保留块内换行**：预览态纯高亮块与标注块保留块内每个源行的换行（相邻源行以 HTML `<br>` 分隔），不合并为一行；列表、代码围栏等嵌套结构不被插入多余换行。
- **标注色板定宽换行 + 随机**：标注块（13 类）颜色面板按字体色行定宽（计算宽 `246px`），字体行 1 行 9 格；边框与填充各 16 格在面板内自动换行（各 2 行），不溢出；面板头行提供「随机」按钮，点击在一次事务内同时把 `bg` 与 `border` 写成同一色名（软色），`text` 不变，面板保持打开，一次撤销同时还原两项；选色与随机后当前值色块原地刷新 `data-active`（不重建面板）。

## Capabilities

### Modified Capabilities

- `editing`：修改 E-52 纯高亮预览与编辑同形——预览态边框由「无左边框」改为「四边 1px 细边」。

### New Capabilities

- `editing`：新增 E-55 预览块内源行换行保留、E-56 标注颜色面板几何与随机。

## Impact

- **代码面**：`src/renderers/markdown.ts`（预览态 callout 渲染保留块内换行、四边 1px）、`src/styles/reader.css`（预览 `.callout-mark` 边框与换行）、标注颜色面板几何与随机逻辑（`src/editors/orchestration/callout-color-panel.ts` 及相应样式）。
- **规格面**：`openspec/specs/editing/spec.md` E-52 修订 + ADDED E-55 / E-56。
- **测试面**：`src/__tests__/renderers/markdown.test.ts`（预览换行）、标注面板几何与随机相关测试、`e2e` 预览态断言。
- **兼容性**：`[!highlight]` 序列化格式不变；既有标注（13 类）形态不变；E-52 场景名逐字保留。

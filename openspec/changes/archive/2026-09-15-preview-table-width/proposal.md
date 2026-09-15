# Proposal: 预览态表格宽度自适应与自动换行

## Why

预览态（阅读模式）下，Markdown 表格宽度由内容撑开：单元格含长内容（长句、长 URL、长英文单词）时整张表格横向延展、超出阅读区宽度，只能靠横向滚动查看，破坏"阅读区是一张纸"的排版体系。根因在 `src/styles/reader.css`：表格 `width: max-content` + 容器 `overflow-x: auto`，注释明确"按内容自然展开，宁可横向滚动也不把列压成竖条"。本变更按用户诉求反转该权衡：表格始终占满内容区宽度、内容自动换行。（需求定义面：issue #8）

## What Changes

- 预览态表格宽度改为**占满内容区可用宽度**（100%），不再由内容撑宽；内容短的表格保持满宽观感（不回退）
- 单元格文本**自动换行**：长句、长 URL、长英文单词/标识符可断行，不把表格撑破
- `.table-wrap` 横向滚动降级为**极端不可断内容**（如内嵌固定宽度媒体）的兜底，常规内容不再触发
- 表格视觉样式（边框/圆角/表头/hover）、宽通道机制（与阅读行宽联动）、渲染管线结构（`.table-wrap wide`、DOMPurify 白名单、注入方式）**均不变**——无 TS/TSX 代码变更，纯样式层
- 同步修订已批准设计 `docs/design/approved/reader-typography/spec.md` §5.5 表格条目与 `reader.css` 旧行为注释，避免设计与实现漂移

## Capabilities

### New Capabilities

<!-- 无新能力 -->

### Modified Capabilities

- `reading`：新增要求「A-11 预览表格宽度与自动换行」——表格 SHALL 占满内容区宽度、内容自动换行、不因长内容横向延展（补充 A-2 GFM 渲染中表格的可读性行为；A-10 阅读宽度体系不变）

## Impact

- **代码**：`src/styles/reader.css`（表格规则 + 注释）；无 TS/TSX 变更
- **测试**：`e2e/tauri/reader-typography.spec.ts` 新增表格宽度/换行断言；`src/__tests__/markdownRender.test.ts` 现有断言不受影响（渲染器输出结构不变）
- **文档**：`docs/design/approved/reader-typography/spec.md` §5.5 同步修订
- **风险**：极低——纯样式行为调整，无数据/接口/依赖变化

## 验收门槛

- `openspec validate preview-table-width --strict` 通过
- `npm test` 全绿；`npx playwright test --config=playwright.tauri.config.ts` 表格相关断言全绿
- 真机（`npm run tauri dev`）手动验证：长内容表格换行不溢出、短表格占满宽度、行宽三档联动正常、明暗主题下表格样式无回退
# Design: 预览态表格宽度自适应与自动换行

## Context

预览渲染管线：`renderMarkdown`（marked + DOMPurify）为表格产出 `<div class="table-wrap wide"><table>…</table></div>`，经 `PreviewView` 以 `dangerouslySetInnerHTML` 注入 `.preview-content`。

宽度约束链（`src/styles/reader.css`）：`.preview-content` 是"纸"（`max-width: var(--type-measure-wide)`，默认 1200px；运行时 = 阅读行宽 readerWidth + 120，上限 1400）；正文子元素走 `--type-measure`（默认 1080px）；`.table-wrap.wide` 走宽通道（= 纸宽）。

现状表格规则：`.table-wrap { overflow-x: auto }` + `table { width: max-content; min-width: 100% }`——内容短时占满容器；内容长时表格按不换行的自然宽度（`max-content`）展开，超出容器即横向滚动。这是刻意权衡（旧注释："宁可横向滚动也不把列压成竖条"），本变更按新需求反转。

## Goals / Non-Goals

**Goals**

1. 表格始终占满内容区宽度；长内容换行，不横向延展。
2. 常规内容零横向滚动；极端不可断内容有容器内滚动兜底。
3. 视觉样式（边框/圆角/表头/hover）、宽通道机制、渲染管线结构零变化。

**Non-Goals**

- 不改阅读行宽设置体系（三档 + 滑块）与 `--type-measure*` 变量语义。
- 不改表格视觉样式、不改渲染器输出结构与消毒白名单。
- 不做列宽拖拽/列宽记忆；不改编辑管线与 HTML 预览（iframe）内表格。

## Decisions

### D1 宽度：`table` 占满容器（100%），不强制均分列宽

- 采用 `width: 100%`，保留内容感知的自动列宽分配（`min-width: 100%` 可随之退役或保留，等价）。
- 备选否决：`table-layout: fixed` 强制均分/按首行定宽——"编号 + 说明"这类列宽比例失真的表格观感差。
- 备选否决：保留 `max-content` 仅加断行——`max-content` 以不换行宽度参与计算，长内容仍可能撑宽表格，不满足需求。

### D2 换行：单元格启用参与固有宽度计算的断行策略

- 需要长单词/URL 可断行，且断行策略要影响表格最小宽度计算（min-content），否则极端长 token 仍会把表格撑宽。
- 普通 `overflow-wrap: break-word` 不影响 min-content 计算 → 优先评估 `overflow-wrap: anywhere` / `word-break` 组合；实现时以真实浏览器验证为准（e2e + 真机）。
- 中文文本无断行障碍（表意文字可任意换行），主要收益面是长英文/URL/哈希类 token 的单元格。

### D3 兜底：保留 `.table-wrap { overflow-x: auto }`

- 仅极端不可断内容（内嵌固定宽度媒体、用户内嵌 HTML 写死宽度等）触发；不再作为常规查看方式。
- 兜底滚动条样式（`scrollbar-width: thin` 等）沿用现有规则，不改。

### D4 容器与管线不变

- 表格继续带 `wide` 类走宽通道，宽度随行宽设置联动。
- 渲染器（`markdown.ts`）、消毒白名单、`PreviewView` 注入方式零改动——本变更纯样式层。

### D5 文档同步

- 修订 `docs/design/approved/reader-typography/spec.md` §5.5 表格条目（"横向滚动"权衡反转为"占满 + 换行"）与 `reader.css` 旧注释，避免设计漂移（AGENTS.md 硬约束：设计与实现不得漂移）。

## Risks / Trade-offs

- [列宽被长内容压窄、可读性下降] → 保留内容感知列宽分配（非均分）；"换行优于横向滚动"是本变更的明确取舍。
- [超长 token 断行后观感碎] → 仅在 token 超宽时断行（断行策略均为必要时才断）；业界通用行为，可接受。
- [用户内嵌 HTML 的 inline `style` 写死宽度绕过换行] → 属用户对自己文档的主权（既有安全约定不拦截）；由 D3 兜底滚动保证不溢出。
- [e2e 断言脆弱（字体/渲染差异）] → 断言用量化布局关系（表格宽度 ≤ 容器宽度、`scrollWidth ≤ clientWidth`、换行行数变化），不断言具体像素；沿用 `e2e/tauri/reader-typography.spec.ts` 既有 computed-style 断言模式。
- [既有 e2e 表格断言（边框/圆角）受影响] → 本次不改视觉样式，断言预期不变；实现时全量回归确认。
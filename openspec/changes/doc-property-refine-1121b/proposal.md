## Why

文档属性块最近三轮（`doc-property-refine-1121` / `doc-property-acceptance-2` / `doc-property-datetime-entry`）把日期录入、footer 顺序、折叠条与 L/T 图标收了尾，但真机使用暴露出两类系统性问题：

1. **密度偏松**：A 一行条胶囊高度继承正文 1.78 行高（推算 ≈36px），文字上下留白过大；footer 计数常显且在预览态变成胶囊；布尔开关偏高。
2. **输入形态错位**：复选（多选）与列表字段共用同一个 `[[` 文档链接编辑器——复选值里出现「[[链接文档」提示、不需要输入也常驻输入框、A 胶囊拖出大片空白；下拉字段没有选项模型，退化成自由文本框（规格 P-3 已写「下拉（选项可维护）」，实现缺失）。

交互语义也与预期不符：折叠是右侧文字按钮而非标题前倒三角；拖动字段手柄同样会选中并弹工具条；工具条占据字段区一行；`⌘⇧Y` 隐藏后顶部露出 YAML 源码，且只剩一行「已隐藏，按 ⌘⇧Y 恢复」作为恢复入口。

维护者 2026-11-21 一次性提交 11 条优化并完成对账（spec issue #1311，逐条裁定见票面）。本 change 把这些裁定固化为规格增量，避免下一轮真机验收再按旧条款返工。

## What Changes

- **密度**：A 胶囊高度收到「文字行高 + 4px」；footer 计数默认不可见、指针进入「N 个字段」文字自身区域才显现（预览态同编辑态，无胶囊）；footer 行高减半；布尔开关高度减 1/4。
- **列对齐**：B 名称列固定 8 个汉字宽、名称左对齐；值列左对齐且各行统一左缘；名称超 8 字显示全名，整列按最长名加宽。A 空值输入区默认 ≥200px 可点。
- **隐藏语义**：`⌘⇧Y` 隐藏后不渲染属性区、不显示 frontmatter 源码、不显示顶部提示条；恢复入口移到页签信息窗路径行下方（「隐藏字段 / 显示字段」+ `N 个字段` + `⌘⇧Y` 说明）。
- **chip 输入统一**：复选、列表、标签三处统一「点击值区才出现输入框；Enter 确认后保留输入框继续录入下一条并弹出已有项；不在编辑态不显示输入框」；标签胶囊支持拖动排序与带图标删除。
- **下拉选项**：`select` 使用选项菜单（已有值来源 + 自由新增），当前值高亮；复选同构。
- **折叠三角**：B 在「文档属性」前、A 在文档名称前，复用标题折叠三角样式；默认不可见、滑入标题行显现；折叠后只保留标题行。
- **日期/日期时间**：值区占位符显示 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`；空字段打开面板预置当前日期与当前时刻；时分改日历右侧滚轮列；面板增加「清除」；底部说明只在滑入「点击外部保存」文字自身时显现。
- **手柄与工具条**：单击手柄才选中并弹工具条；拖动排序不改变选中集、不弹条；工具条悬浮标题行水平居中、胶囊外形。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `doc-property-panel`：P-1（隐藏语义、折叠条形态）、P-3（下拉/复选编辑器、日期占位与默认值、时分滚轮、清除、说明触发面）、P-4（拖动不选中、工具条落位）、P-5（标签编辑态与拖动排序）、P-10（胶囊高度、计数显隐、列宽、按钮顺序）、托管日期只读展示（计数显隐）、控件悬停显隐与折叠淡出（折叠控件触发面）；新增 P-11 页签信息窗字段显隐入口。

## Impact

- 前端：`src/components/Content/DocPropertyBar.tsx`、`src/components/TabInfoPopover.tsx`、`src/editors/decorations/frontmatterHide.ts`、`src/stores/docPropertyPanel.ts`（如需暴露读写）、`src/ui/icons.ts`（折叠三角）。
- 样式：`src/styles/doc-property.css`、`src/styles/tokens.css`（密度 token）、`src/styles/editor.css`（信息窗行）。
- 规格：`openspec/specs/doc-property-panel/spec.md` 7 条修订 + 1 条新增；`docs/design/system/spec.md` §7.2 / §7.6 密度 token。
- 测试：`e2e/doc-property-panel.spec.ts`、`e2e/tab-info-popover.spec.ts`（新建或扩展）、`src/__tests__/components/Content/DocPropertyBar.test.tsx`、`src/__tests__/stores/docPropertyPanel.test.ts`。
- 无 Rust 侧改动；无配置 schema 或持久化格式变更；无新增外部依赖。
- 缺陷「正文输入日期后内容消失」不属本 change（缺陷线单独 triage）。

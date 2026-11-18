## Why

batch23 汇集四条**已重启**的用户反馈（#1054 / #1050 / #1049 / #1044）。四者都是既有交付被用户复看后仍不满足的点，属于对既有交付的修正，不是新能力。用户原话：

- **#1054 搜索浮窗**（顶栏 / 状态栏 / 输入框 / 字号）：
  - 「顶栏没有复用原悬浮窗的样式功能，再顶栏增加搜索和替换标题，关闭按钮要在顶栏右侧，不要在切换图标后面」
  - 「状态栏没有复用显隐能力，文字说明去除“（局部 · 浮窗内）”文字。」
  - 「输入关键字内要增加一键删除按钮」
  - 「搜索出的内容文字包括快捷键字号调大一号，文字有点小。」
- **#1050 大纲**（拖动指示 / 正文同步 / 层级标识）：
  - 「拖动大纲，要有大纲拖动位置的指示条标识，现在还是很突然；」
  - 「大纲调整了，正文位置还未调整；」
  - 「调整后标题的显示层级很不整齐，调整方案，还原上一版每个大纲前都有标识，但只有鼠标滑入的大纲才显示当前大纲的标识，其他不显示，标识的颜色要再浅一点。」
- **#1049 预览态选区工具条**（显示时机）：
  - 「不要鼠标开始拖动就显示工具条，要在鼠标落点位置跟随鼠标开始显示。」
- **#1044 日期时间字段**（单面板）：
  - 「分开两个字段填写，效果很不方便，要以一个面板，最方便的方式来操作选择。」

## What Changes

- **search-replace-float（#1054）**：S-1 浮窗顶栏增加标题「搜索和替换」，关闭按钮移到顶栏最右侧（不再排在视图切换图标之后）；搜索输入框增加一键清空按钮。S-6 状态栏文案删除「（局部 · 浮窗内）」。S-3 结果区文字（定位行 + 上下文片段）与行尾快捷键徽标字号按 `docs/design/system/spec.md` §4 字阶各上调一档。
- **editing（#1050）**：E-10 大纲拖动时渲染**插入位置指示条**（落点指示条，实时跟随指针）；松手后正文标题顺序 SHALL 与大纲顺序一致（既有 requirement 的缺陷复现，作为验收锚点）；每个大纲项持有层级标识，但仅鼠标悬入项显示、其余隐藏，标识颜色取比次级文字色更浅一档的语义色（§6）。
- **reading（#1049）**：预览态选区工具条 SHALL NOT 在拖选过程中显示；SHALL 在选区完成（鼠标松开）后于鼠标落点显示。
- **doc-property-panel（#1044）**：P-3 日期时间字段改为**单一面板**（一个 popover 内同时完成日期与时间选择），提交组合 `YYYY-MM-DDTHH:mm`；SHALL NOT 使用分离的日期控件 + 时间控件双控件。
- **BREAKING**：无。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `search-replace-float`：S-1 浮窗形态与默认位置（顶栏标题 / 关闭按钮位次 / 输入框清空）、S-3 结果列表与行尾快捷键（字号）、S-6 浮窗状态栏（文案）。
- `editing`：E-10 编辑器大纲浮层（插入位置指示条 / 正文顺序同步 / 层级标识显隐与颜色）。
- `reading`：预览态选区工具条（显示时机）。
- `doc-property-panel`：P-3 字段类型系统与智能编辑（日期时间单面板）。

> 归属说明：#1050 的 canonical 落点是 `editing` 的 E-10「编辑器大纲浮层」（batch21 同落点），不是 `navigation`；`navigation` 规格内无大纲条款。

## Impact

- 前端：`src/components/Content/SearchReplacePanel.tsx` 与 `src/styles/search-float.css`（顶栏 / 关闭按钮 / 清空按钮 / 状态栏文案 / 字号）；`src/components/Content/OutlineMenu.tsx` 与其样式（插入位置指示条 / 层级标识）；`src/components/Content/SelectionPill.tsx`（显示时机）；`src/components/Content/DocPropertyBar.tsx`（日期时间单面板）。
- 设计：`docs/design/system/decisions.md` 追加三条裁决（搜索浮窗顶栏 / 大纲插入指示条 / 日期时间选择面板）。
- 测试：e2e `e2e/search-float.spec.ts`、`e2e/outline-menu.spec.ts`、`e2e/selection-pill.spec.ts`、`e2e/doc-property-panel.spec.ts` 新增 / 扩展用例。
- 无新增配置字段、无数据库迁移、无新增外部依赖；不回滚 batch21 / batch22 制品。

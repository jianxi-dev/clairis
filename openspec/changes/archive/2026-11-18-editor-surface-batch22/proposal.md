## Why

batch22 汇集两条**已重启**的用户反馈（#1053、#1055）。两者都是 batch21 已交付、但用户复看后仍不满足的点，属于对既有交付的修正，不是新能力：

- **#1053 页签**：上一轮把页签标题的 `truncate` 换成 `break-words line-clamp-2`，但 `-webkit-line-clamp` 达到行数上限时**仍会渲染视觉省略号**，且页签名被允许换行。用户复看后提出三点：省略号还在、页签名不要换行显示、页签间距再加宽一个指针（16px → 32px）。
- **#1055 搜索浮窗**：上一轮把选中行行尾徽标从 `⏎` 改成文本「回车」，用户要的是**回车图标**（键帽/返回箭头图形），不是两个字；同时指出鼠标滑过结果行应等价于按 ↑↓ 移动选择（更新 `activeIndex`），选中图标随之切换。

## What Changes

- **application-shell（#1053）**：页签标题改为**单行完整显示**——SHALL NOT 使用 `text-overflow: ellipsis`、SHALL NOT 截断、SHALL NOT 使用 `-webkit-line-clamp`（含 `line-clamp` 系列）、SHALL NOT 换行（`white-space: nowrap`）；页签总宽超出页签条可用宽度时，页签条横向滚动；相邻页签间距 16px → **32px**（±2px）。
- **search-replace-float（#1055）**：选中（当前命中）行行尾徽标由裸文本「回车」改为**键帽式回车图标**（自绘静态 path，经仓库图标注册表渲染，可访问名「回车」）；鼠标悬停结果行 SHALL 更新 `activeIndex` 至该行（与 ↑↓ 同一选择态），徽标在悬停 / 选中行显示。既有 9 行上限、快捷键列常驻、↑↓ / Enter 导航与点击定位保持不变。
- **BREAKING**：无。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `application-shell`：G-6 顶栏职责与页签身份（页签标题单行全显 + 页签间距 32px）。
- `navigation`：页签条与格头（同步页签标题 / 间距口径，避免与 application-shell 冲突）。
- `search-replace-float`：S-3 结果列表与行尾快捷键（徽标改回车图标 + 悬停更新 activeIndex）。

## Impact

- 前端：`src/components/TabBar.tsx` 与页签条样式（页签标题与间距）；`src/components/Content/SearchReplacePanel.tsx`（徽标渲染 + 悬停选择）；`src/ui/icons.ts` 与 `src/editors/icons.ts`（新键帽回车图标）。
- 设计：`docs/design/system/decisions.md` 追加一条裁决（搜索徽标回车图标）。
- 测试：e2e `e2e/tab-selection.spec.ts`、`e2e/search-float.spec.ts` 新增 / 扩展用例。
- 无新增配置字段、无数据库迁移、无新增外部依赖；不回滚 batch21 制品。

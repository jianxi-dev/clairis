# E-58 卡片源码起点随位置漂移刷新

## Why

E-58 上一版只规定「按卡片携带的源码起点定位」，但没有规定起点必须随前文编辑更新。`CalloutWidget.eq()` 未比较源码位置时，CM 复用旧 DOM，`data-callout-from` 停在旧偏移；第一块改色后，第 2..n 块再改色会全部落回第一块（#1725 复发，PR #1730 修复）。

## What Changes

- E-58 增补：卡片携带的源码起点 SHALL 随前文编辑同步更新；仅当块内容与位置都不变时才可复用 DOM；位置变化 SHALL 重建卡片。
- 新增场景「连续改色后仍定位自身」。

## Capabilities

### Modified Capabilities

- `editing`：修订 E-58（补位置刷新约束与场景）。

## Impact

- 规格：`openspec/specs/editing/spec.md` E-58。
- 代码：已在 PR #1730 落地（`CalloutWidget.sourceFrom` 参与 `eq`）。

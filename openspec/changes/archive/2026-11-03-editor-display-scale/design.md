# Design: 菜单尺度

## D1 数值

| 项 | 旧 | 新 |
|---|---|---|
| 菜单宽 | 236 | 264 |
| 行高 | 32 | 36 |
| 菜单字号 | 13 | 14 |
| 分组标签 | 11 | 12 |
| 图标 | 18 | 20 |
| 网格单元高 | 56 | 62 |
| 网格标签 | 12 | 13 |

## D2 为什么图标走 `ICON_SIZE_PX`

图标尺寸写在 `renderIcon` 的 inline style 里，CSS 覆盖不了。放 CSS 里只会让「看起来改了、其实没变」——本轮就是这样先改 CSS 后测出没生效。单一来源，改一处。

## D3 空大纲

`headings.length === 0` 时 `OutlineMenu` 直接返回 null：按钮与浮层都不渲染。判定用的是同一个 `extractHeadings`，不会出现「按钮在、点开空」的分歧。

## Verification

- `e2e/fixtures/editor-anchors.ts` 同步新数值，`ui-fidelity.spec.ts` 断言 264 / 36 / 20。
- 新增：无标题文档不出现 `outline-btn`；有标题时出现。

# Design: 轮盘标注类型全集

## R-D1 单一类型源

轮盘高亮层 SHALL 由 `CALLOUT_EDIT_TYPES`（13 类）驱动，不在 `floating-toolbar.ts` 内联第二份清单。图标通过 `CALLOUT_ICONS` 映射到 `ui/icons.ts` 的语义图标；缺失映射回退 `callout`。

## R-D2 写入语法

每类写 `> [!<key>]\n> 正文`，key 与 `CALLOUT_EDIT_TYPES.key` 一致（note/info/abstract/todo/tip/success/question/warning/failure/danger/bug/example/quote）。

## R-D3 扇形容量

三层仍是固定 15° 一格、紧排；13 项覆盖 195°，允许跨越多侧，但不得改变每格宽度与中心角规则。

## R-D4 悬停观感

悬停/激活用 `color-mix(accent 22%, surface)` 实色填充，保留描边强调；不使用带 alpha 的 `--app-accent-soft` 直接替换底色。

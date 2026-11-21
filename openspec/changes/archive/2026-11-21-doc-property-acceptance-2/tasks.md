# 任务 — doc-property-acceptance-2

> 切片原则：1 任务 = 1 票 = 1 PR；每张票做完用户能在界面上看到变化。
> 票标题前缀 `[change=doc-property-acceptance-2/<任务号>]`。
> 不在范围：O2（日期选择器密度）、O6（锁图标 12px）、`doc-property-refine-1121` 已归档条目。

## 1. B1a 纯字符串默认文本

- [x] 1.1 纯字符串值推断为 `text`
  - 交付物：`src/lib/frontmatter.ts` 的 `inferFrontmatterType` 字符串分支（非日期/日期时间一律 `text`）；`src/__tests__/frontmatter.test.ts` 三处 `unknown` 断言改 `text`（`custom-note`、`priority`、缺省配置 `customdate`），测试名改为「纯文本默认 text」。
  - 验收要点：打开含 `priority: 高` 的文档，属性面板该字段显示「Aa」文本图标而非「?」；`inferFrontmatterType("高")` 返回 `"text"`，`inferFrontmatterType({})` 仍返回 `"unknown"`。
  - 验证命令：`npx vitest run src/__tests__/frontmatter.test.ts`
  - **数据面**: 校验

## 2. B1b 截断值暴露全文

- [x] 2.1 A/B 两态截断值 `title` 给全文
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 的 `ValueView`（去掉 `long` 启发式，非空 `display` 恒作 `title`）；`e2e/doc-property-panel.spec.ts` 增加 A 态胶囊截断与 B 态两行截断的 `title` 断言。
  - 验收要点：字段值被截断时，鼠标悬停显示完整原文（A、B 都一样）；`[data-testid="dpb-value"]` 的 `title` 等于完整 `display`。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 无

## 3. B3 值字重与字号

- [x] 3.1 字段值去粗体、字号随正文
  - 交付物：`src/styles/doc-property.css` 删除 `.dpb-v` 的 `font-weight: 550`；e2e 增加值字重与字号断言（不改 `.dpb-a-title`）。
  - 验收要点：字段值不再比字段名更粗；⌘+/- 调整正文后，A/B 两态字段名与值的计算字号仍相等；面板标题字号保持不变。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 规格

## 4. O1 B 标签列自适应

- [x] 4.1 B 行去固定 92px 标签列 + 去竖线 + A 胶囊同优先级
  - 交付物：`docs/design/system/spec.md` §7.2 新增 `--dpb-label-max-width: 16em`、`src/styles/tokens.css` 同步；`src/styles/doc-property.css` 改 `.dpb-b-row` 网格为 `16px auto minmax(0, max-content) minmax(0, 1fr) 18px`、`.dpb-b-label` 与 `.dpb-k` 加 `max-width: var(--dpb-label-max-width, 16em)`；`e2e/doc-property-panel.spec.ts` 把 `tracks[2] ≈ 92` 断言改为「标签列随字段名长度变化」并新增 A 胶囊截断断言。
  - 验收要点：B 态长字段名不再被 92px 截断（在 cap 内完整显示），值列让位；列间没有竖向分隔线；A 态胶囊内字段名同样在 cap 内完整、超 cap 才省略号并换行。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 规格,消费

## 5. O3 控件悬停显隐

- [x] 5.1 标签叉号 / 形态切换 / 折叠按钮悬停才显现
  - 交付物：`src/styles/doc-property.css` 给 `.dpb-tag-x`、`.dpb-variant-toggle`、`.dpb-collapse` 加默认 `opacity: 0` 与 `:hover` / `:focus-within` / `:focus-visible` 恢复；e2e 增加计算 `opacity` 断言（不改把手与行尾删除叉号）。
  - 验收要点：指针移入标签/工具条前，标签叉号、L/T 形态切换、折叠按钮不可见；移入或 Tab 聚焦后可见可用。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 规格,消费

## 6. O4 折叠全透明

- [x] 6.1 折叠态透明度 0.35 → 0
  - 交付物：`docs/design/system/spec.md` §7.2 把 `--dpb-collapsed-opacity` 改为 0、`src/styles/tokens.css` 同步；e2e 增加折叠态计算 `opacity` 断言（0 → hover/focus 1，高度不变）。
  - 验收要点：面板折叠后完全看不见，指针滑入或聚焦时浮现；折叠/展开不引起额外布局位移。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 规格

## 7. O5 footer 收敛

- [x] 7.1 footer 收窄 + 预览计数胶囊
  - 交付物：`src/styles/doc-property.css` 改 `.dpb-b-foot` / `.dpb-a-foot` 垂直内距为 §3 刻度（`--space-4` / `--space-2`），预览态 `.dpb-count` 加胶囊样式（`--app-border` + `--radius-full`）；`src/components/Content/DocPropertyBar.tsx` 传入模式以区分预览/编辑；e2e 改 footer 几何断言（B `padding-top` ≤ 4px、A `margin-top` ≤ 4px、预览计数有描边且全圆角、编辑态无描边、计数仍在日期左）。
  - 验收要点：底部字段计数行比现在更矮；预览态计数是左对齐的小胶囊，编辑态仍是纯文字；托管日期仍靠右。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 规格,消费

## 8. O7 去空态引导 + 页签右键「添加字段」

- [x] 8.1 移除空态文案，页签菜单新增「添加字段」
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 删除 `!parsed.present` 的 `.dpb-empty` 分支；`src/stores/docPropertyPanel.ts` 新增会话态 `paletteRequest` 与 `requestPalette` / `consumePaletteRequest`；`src/components/TabBar.tsx` 页签右键菜单（`data-tab-menu`）新增「添加字段」项，点击后 `requestPalette(menu.tabId)` 并 `closeMenu()`；`DocPropertyBar` 订阅请求、按 `docKey` 匹配后以本面板添加按钮为锚点开调色板；`src/__tests__/stores/docPropertyPanel.test.ts` 增请求消费用例；`e2e/doc-property-panel.spec.ts` 删除空态引导用例，改为「无 frontmatter 不渲染空态 + 页签右键菜单打开调色板」。
  - 验收要点：无 frontmatter 的文档不再显示「暂无 frontmatter 属性」；右键任意页签出现「添加字段」，点击后该页签文档的字段调色板打开、菜单关闭，Esc 或点外部收起；分屏下只打开被右键页签的面板。
  - 验证命令：`npx vitest run src/__tests__/stores/docPropertyPanel.test.ts` + `npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 存储,消费

## 9. O8 日期选择器底部提示显隐

- [x] 9.1 `.dpb-dt-hint` 默认隐藏、footer 行悬停/聚焦显现
  - 交付物：`src/styles/doc-property.css` 给 `.dpb-dt-hint` 加默认 `opacity: 0` 与 `transition: opacity .12s`，并让 `.dpb-dt-foot:hover .dpb-dt-hint`、`.dpb-dt-foot:focus-within .dpb-dt-hint`、`.dpb-dt-hint:focus-visible` 恢复 `opacity: 1`；`e2e/doc-property-panel.spec.ts` 对日期与日期时间两个选择器各加一条断言；`src/components/Content/DocPropertyBar.tsx` 的 `.dpb-dt-foot` / `.dpb-dt-hint` 结构不变（如实现需要仅微调 className，不动键盘链路）。不新增设计 token。
  - 验收要点：打开日期或日期时间选择器，底部「Esc 取消 · Enter 保存 · 点击外部保存」默认不可见；鼠标进入底部 footer 任意位置（含「今天」按钮一侧）或 Tab 聚焦到 footer 内元素时出现，移出 / 失焦即隐藏；footer 与面板高度不变；Esc 取消、Enter 保存、点击外部保存行为不变。
  - 验证命令：`npx playwright test e2e/doc-property-panel.spec.ts`
  - **数据面**: 无

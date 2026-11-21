# 任务 — doc-property-datetime-entry

> 切片原则：1 任务 = 1 票 = 1 PR；每张票做完用户能在界面上看到变化。
> 票标题前缀 `[change=doc-property-datetime-entry/<任务号>]`。
> 三票都改 `src/components/Content/DocPropertyBar.tsx` 与 `e2e/doc-property-panel.spec.ts`，必须**按 1 → 2 → 3 串行**（后票依赖前票的草稿与提交骨架）。
> 不在范围：面板宽度与 `--dpb-cal-*` 密度、时分步进（O2 的 32px 间距与 WebKit 56px 组）、形态切换、footer、托管日期的展示值。

## 1. 值区可编辑：直接输入 / 粘贴归一化 / 空值与非法回退

- [ ] 1.1 日期与日期时间值区改为可编辑文本控件，并接入归一化校验
  - 依赖：无（首票）。
  - 交付物：
    - `src/lib/frontmatter.ts`：`validateFieldValue` 对 date 接受 `YYYY/MM/DD` 并归一化为 `YYYY-MM-DD`；对 datetime 归一化分隔符为 `T`、接受空格/可选秒/`YYYY/MM/DD` 日期部分，秒为 `00` 时省略；date/datetime 的 trim 空串返回 `{ ok:true, value:"" }`；非法 reason 保持不变。
    - `src/components/Content/DocPropertyBar.tsx`：`DatetimeEditor` 编辑态把 `.dpb-dt-trigger` 的静态 `<span>` 换成绑定 `draft` 的 `<input class="dpb-input dpb-dt-input">`（沿用既有盒模型，不改尺寸）；picker 写入 `draft`，Enter / 失焦 / 外部点击提交，Esc 回退；提交经 `doneRef` 只发生一次；空值写回空值。
    - `src/__tests__/frontmatter.test.ts`：`2026/11/16` 由 `ok:false` 改为 `ok:true` 且值为 `2026-11-16`；datetime 空格输入期望改为 `T` 归一化结果；补空值与 `/` 日期时间用例。
    - `src/__tests__/components/Content/DocPropertyBar.test.tsx`：补「编辑态存在可编辑文本控件、且不是原生 date/time 控件」断言；补直接键入 Enter 提交与清空提交断言。
    - `e2e/doc-property-panel.spec.ts`：新增日期键入 `2026/11/18`、日期时间键入 `2026-11-18 14:30`、粘贴、清空为空、非法回退并提示的用例。
  - 验收要点：日期值区可直接键入或粘贴 `2026/11/18`，提交后面板显示 `2026-11-18`、源码为 `2026-11-18`；日期时间键入 `2026-11-18 14:30` 提交后显示 `2026-11-18 14:30`、源码为 `2026-11-18T14:30`；清空提交后值为空、源码为空字符串；键入 `abc` 提交后原值不变并出现格式错误提示。
  - 验证命令：`npx vitest run src/__tests__/frontmatter.test.ts src/__tests__/components/Content/DocPropertyBar.test.tsx` + `npx playwright test e2e/doc-property-panel.spec.ts`
  - 变更的既有测试：`frontmatter.test.ts` 的 date `/` 拒绝断言、datetime 空格保留断言；`DocPropertyBar.test.tsx` 的日期面板用例补输入控件断言。
  - **数据面**: 无

## 2. 日期日格即选即提交与关闭（含「今天」）

- [ ] 2.1 日期字段单明日格立即写回并关闭，日期时间维持只改草稿
  - 依赖：1（复用票 1 的 `draft` 与一次性提交出口；同一文件，必须后做）。
  - 交付物：
    - `src/components/Content/DocPropertyBar.tsx`：`dateOnly` 的日格与「今天」选择先写同步快照再调用唯一提交出口，`doneRef` 阻止随后的失焦/外部点击二次提交；日期时间日格仍只写 `draft`。
    - `src/__tests__/components/Content/DocPropertyBar.test.tsx`：把「日期字段 Enter 提交」改为「日格单击即时提交且只 dispatch 一次、编辑器立即消失」。
    - `e2e/doc-property-panel.spec.ts`：类型切换为日期后点日格的用例去掉多余的 Enter 按键（避免焦点回到正文）；新增日期日格单击关闭、日期时间日格不关闭的对照用例。
  - 验收要点：日期字段点某一天，值立即写回并关闭面板，写回只有一次；再点外部不会重复写回；日期时间字段点日格后仍停留在面板内等待时分与确认。
  - 验证命令：`npx vitest run src/__tests__/components/Content/DocPropertyBar.test.tsx` + `npx playwright test e2e/doc-property-panel.spec.ts`
  - 变更的既有测试：`DocPropertyBar.test.tsx` 的「日期字段 Enter 提交 YYYY-MM-DD」；`doc-property-panel.spec.ts` 中类型切换 date 用例的末尾 Enter。
  - **数据面**: 无

## 3. 双击聚焦与面板键盘 / 托管只读回归

- [ ] 3.1 双击值区定位时分或日格，并锁定既有键盘与只读语义
  - 依赖：2（复用票 2 的打开与提交骨架；同一文件，必须后做）。
  - 交付物：
    - `src/components/Content/DocPropertyBar.tsx`：在稳定的值区外层用 pointerdown 时间/坐标检测双击（同区 ≤300ms、≤6px、目标不在面板内）；日期时间聚焦小时输入，日期聚焦选中日格（无选中则当月首个可聚焦日格）；双击不提交。
    - `src/__tests__/components/Content/DocPropertyBar.test.tsx`：补双击后焦点断言；补「在值区输入框按 Tab 仍进入面板、正文首字符仍为 `-`」回归断言。
    - `e2e/doc-property-panel.spec.ts`：新增双击日期时间值区聚焦小时输入、双击日期字段值区聚焦日格的用例；新增托管日期（`created`）无文本输入、双击不出现编辑器的用例。
  - 验收要点：双击日期时间值区后面板打开且光标在小时输入；双击日期值区后焦点在日历日格；两种情况都不写回；值区输入框上按 Tab 不会把缩进写进正文；托管日期没有输入框，双击也不出现编辑器。
  - 验证命令：`npx vitest run src/__tests__/components/Content/DocPropertyBar.test.tsx` + `npx playwright test e2e/doc-property-panel.spec.ts`
  - 变更的既有测试：无删除；补双击焦点、输入框 Tab 回归、托管日期只读三组断言。
  - **数据面**: 无

# 验收锚点 — icon-system-v3-redraw

锚点来源：本 change `design.md` D1–D8、`specs/navigation/spec.md`「图标体系」、`specs/application-shell/spec.md` G-7、已批准原型 `docs/design/explorations/icon-system-v3/icon-system-v3-proto.html`、逐格 QA `PROTOTYPE-QA.md`。

## R-1 图标体系（navigation）

静态 path 表、描边语言、状态对、禁 emoji、类型色不变。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 任一描边图标的 `<path>` fill 属性 | """none""" | spec navigation 图标体系 |
| A-1.2 | exact | 任一描边图标 `<path>` 的 stroke 属性 | """currentColor""" | spec navigation 图标体系 |
| A-1.3 | exact | 设置图标抽屉 `[data-icon-entry]` 条目数下界 | 13 | e2e/icon-system.spec.ts:71 |
| A-1.4 | exact | 页面正文 emoji 字符数 | 0 | spec navigation 图标体系 |
| A-1.5 | exact | `play` 图标 `<path>` 的 fill 属性 | """currentColor""" | spec navigation 图标体系 |
| A-1.6 | state-machine | `collapse` 的 d 与 `expand` 的 d 相等 | 0 | design D4 |
| A-1.7 | exact | 8 个文件类型图标的 `<path>` 数量 | 1 | e2e/icon-system.spec.ts:51 |
| A-1.8 | exact | 读取 `src/ui/icons.ts` 中 `<text` 出现次数 | 0 | tasks 4.1 |

## R-2 全屏退出态（application-shell G-7）

全屏中按钮渲染 collapse、aria-pressed、退出恢复、单格隐藏。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 全屏态格头按钮 `data-icon` | """collapse""" | spec G-7 |
| A-2.2 | exact | 全屏态格头按钮 `aria-pressed` | """true""" | spec G-7 |
| A-2.3 | exact | 退出全屏后按钮 `data-icon` | """expand""" | spec G-7 |
| A-2.4 | exact | 单格工作区全屏按钮数量 | 0 | spec G-7 |
| A-2.5 | exact | 全屏态按钮 `aria-label` | """退出全屏""" | spec G-7 |

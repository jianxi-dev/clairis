# Tasks — editor-block-parity

> 2026-11-06 收口对账：全部条目按实际交付勾选；被维护者裁定取代的条目在行内注明依据（2026-11-03：#137 撤销表格结构开关；#140 整体删除单元格工具条；「放大一档」264/36/20）。

## 1. 块菜单视觉与图标体系（能看到：转为变成 5×2 图标网格、图标变大、在下方添加有图标）

- [x] 1.1 `icons.ts` 统一图标渲染常量（`ICON_SIZE_PX = "20px"`，2026-11-03「放大一档」，原定 18px）；字形图标只用于「转为」网格，手柄与动作行用 path 图标；`DividerOutlined`/`TodoOutlined` 等已补。
- [x] 1.2 `block-menu.ts`：「转为」为 5 列 × 2 行网格（`cm-block-menu-grid`），当前块型高亮；菜单宽 264、行高 36（2026-11-03「放大一档」，原定 236/32；与 E-7 数值一致）。
- [x] 1.3 「在下方添加」带图标与右侧 chevron（`block-menu.ts` addLabel + `cm-block-menu-chevron`）。
- [x] 1.4 `editor.css`：网格单元/hover/高亮态样式，图标 20px（`.cm-block-menu-item svg`）。
- [x] 1.5 e2e：网格 10 单元、每单元 1 个 svg、图标 20px、每行都有图标（`e2e/block-menu.spec.ts` + `e2e/ui-fidelity.spec.ts`；数值唯一来源 `e2e/fixtures/editor-anchors.ts`）。

## 2. 块菜单功能补齐（能看到：菜单里有复制/剪切/删除/缩进/颜色）

- [x] 2.1 结构动作对表格块生效（表格块共用 复制/剪切/删除/缩进/「在下方添加」；「转为」网格按裁定不对表格提供目标）。
- [x] 2.2 复制 / 剪切 / 删除三条动作（直接改源码；单测 `blockActions.test.ts`）。
- [x] 2.3 缩进（增加/减少）与颜色两个入口（`block-menu.ts` 动作行 + 颜色 flyout，写入 `mdb-color-*`，E-17 / PR #228）——原定「缩进与对齐」的对齐项不设：markdown 无块级对齐表达，与 #137 裁定同一取舍。
- [x] 2.4 ~~表格结构开关（标题行 / 标题列 / 均分列宽）~~ —— **已撤**：2026-11-03 维护者裁定不再提供（#137 已关闭）。
- [x] 2.5 e2e：表格块菜单含结构动作、无表格结构开关（`e2e/block-menu.spec.ts`）。

## 3. 单元格富文本编辑（能看到：单元格里打 `/` 弹菜单、提交后 `**粗**` 渲染为粗体）

- [x] 3.1 编辑面保持原生 `<input>`（`table.ts` 文件头明确裁决：表单控件避免 CM6 contenteditable 陷阱）；行内 markdown 在提交落定后的显示态渲染（原定「编辑面换成 contenteditable」被该裁决取代）。
- [x] 3.2 接线 `trigger: "anchor"` 插入通道；提交经 `sanitizeCellText`。
- [x] 3.3 行内 markdown 渲染与源码同步（`cell-text.ts` `renderCellText`：粗/斜/链接/行内代码）。
- [x] 3.4 Enter/Tab/Esc/失焦 四种提交语义（单事务写回）。
- [x] 3.5 中文输入法合成事件不打断编辑（`compositionstart/end`）。
- [x] 3.6 e2e：单元格内斜杠菜单、行内格式、Tab 右移、Esc 还原（`e2e/table-decorations.spec.ts`）。

## 4. 工具条瘦身（修订 E-9）

- [x] 4.1 `cell-toolbar.ts` 及其挂载**整体删除**（#140；2026-11-03 维护者裁定「两个功能都不可靠、使用频率低，直接删，不做瘦身」）。
- [x] 4.2 移除 `setCellBackground` 写入路径；`mdb-bg-*` 仅保留渲染侧识别（兼容既有文档）。
- [x] 4.3 单格/单行/任意选区均不渲染工具条（文件已不存在）。
- [x] 4.4 旧 E-9 断言随 #140 更新（单击显示工具条 / 改底色写源码的旧用例已删）。
- [x] 4.5 e2e：无工具条、无背景色入口（`e2e/table-decorations.spec.ts` 全绿）。

## 5. 全角标点归一（能看到：打「你好，世界」源码变「你好,世界」）

- [x] 5.1 `，`→`,`、`／`→`/`，排除代码块/行内代码/URL（PR #121，`4cbeec0`）。
- [x] 5.2 单次 undo 回到全角（同一事务替换）。
- [x] 5.3 中文输入法合成事件下不吞字、不重复替换。
- [x] 5.4 单测 + e2e（`smartInput.test.ts` / `e2e/smart-input.spec.ts`）。

## 6. 收口

- [x] 6.1 验证（2026-11-06 收口实跑）：`tsc --noEmit` 0 错、`eslint src/` 0 error、相关单测 160 通过、相关 e2e 面 41 通过（1 例计时抖动重试通过）。
- [x] 6.2 需求台账登记：E-9 修订为「已移除」、E-11/E-12 注明归档、E-13 归因 PR #121。

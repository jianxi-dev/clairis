# 验收锚点 — doc-property-refine

> 机读层唯一解析面。人读层 = `specs/doc-property-panel/spec.md`（P-1/P-3/P-4/P-6/P-7 修订）。
> 来源记法：`issue#<N>`（GitHub #1019/#1021/#1022/#1023/#1024 票面与 triage brief）、`决策#<n>`（本 change design.md Decisions D1～D8）、`一手裁定`（维护者 2026-11-17 验收原话）、`现状 <file>:<symbol>`（已读代码）。
> R-1～R-5 分别对应 #1021 / #1022 / #1019 / #1023 / #1024；tasks.md 1.1～1.5 逐条消费。

## R-1 布尔字段值内仅状态图形

布尔字段显示态与编辑态值内 SHALL NOT 出现「开/关」文字，仅保留状态图形，提示移入 `title`/aria 语义。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 布尔值节点文本不含「开/关」文字 | true 态值节点 `textContent` 严格等于 `◉`（长度为 1），不含字符「开」 | issue#1021 / 一手裁定「不要显示在值内」 |
| A-1.2 | exact | 状态文案移至 title | true 态值节点 `title` 严格等于 `已开启`，false 态严格等于 `已关闭` | issue#1021 / 决策#2 |
| A-1.3 | state-machine | 布尔切换两态图形与 aria 同步 | 点击开关后 `aria-checked` 由 `true`→`false`，值图形由 `◉`→`○`，`title` 由 `已开启`→`已关闭` | issue#1021 / 现状 DocPropertyBar.tsx:ValueEditor |

## R-2 工具条与行内操作图标统一注册表

选中行工具条七按钮与行内操作图标经 `src/ui/icons` 的 `iconSvg` 渲染，与 MD 横向工具条同源；无 Unicode 字形残留。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 工具条七按钮均为注册表 SVG 渲染 | 选中行后 `.dpb-ops-btn` 节点数等于 7，每个内 `<svg>` 数为 1、直接文本节点数为 0 | issue#1022 / 现状 DocPropertyBar.tsx:OpsBar |
| A-2.2 | exact | 与 MD 菜单同源同尺寸档 | 工具条按钮 `svg` 的 `viewBox` 严格等于 `0 0 24 24`，渲染尺寸档为 14 | issue#1022 / 决策#3 |
| A-2.3 | exact | 新增图标先有设计条款 | `docs/design/system/spec.md` §2.3 动作组含 `copy`/`cut`/`paste`/`arrowUp`/`arrowDown`/`trash` 六个概念条款 | 决策#3 / design-system:§2.3 |

## R-3 面板可见时编辑态隐藏 frontmatter 源码块

面板可见且编辑态时正文隐藏 `--- ... ---` 块；折叠态显示一行摘要、隐藏态恢复完整源码块；光标/选区/undo 不受影响。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 展开态隐藏整块前言 | 编辑态面板展开时正文首行可见文本不含子串 `---`（被 decoration 替换）；装饰范围 `[from,to)` 等于 frontmatter 块起止 | issue#1019 / 决策#1 / 现状 frontmatter.ts:parseFrontmatter |
| A-3.2 | exact | 折叠态一行摘要占位 | 折叠面板后正文出现恰好 1 个摘要占位节点，其文本匹配 `文档属性 · N 个字段`（N = 实际字段数） | issue#1019 / 决策#1 |
| A-3.3 | state-machine | 隐藏态恢复完整源码块 | 按 `⌘⇧Y` 隐藏面板后正文重新可见以 `---` 开头的前言块，且 YAML 文本完整可编辑 | issue#1019 / 决策#1 / 一手裁定「正文不要再显示」 |
| A-3.4 | state-machine | 隐藏不吞光标且不破坏 undo | 隐藏态下点击正文首段后光标行号 ≥ 前言块行数+1；随后 Ctrl+Z 撤销前面板编辑后面板随源码重解析，首段文本与撤销前一致 | issue#1019 / 决策#1 / spec P-9 |

## R-4 模板字段类型 UI 与内置模板可编辑

设置中模板编辑提供字段列表（键名 + 类型选择器 + 预设值）；内置模板可编辑并落为同名覆盖层，可恢复默认。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 字段类型选择并套用生效 | 设置把内置「通用」某字段类型改为「日期」保存后，新文档套用该模板，面板中该字段类型图标为日历（`data-type="date"`） | issue#1023 / 决策#4 |
| A-4.2 | state-machine | 恢复默认回落内置定义 | 对内置模板点「恢复默认」后，新文档套用该模板，该字段类型回到内置原值（非「日期」） | issue#1023 / 决策#4 / 现状 propTemplates.ts:normalizePropTemplates |
| A-4.3 | exact | 编辑落为同名覆盖层 | 保存内置模板编辑后 `AppConfig.propTemplates` 含 1 条与内置同名的条目（长度与内置名一致），无重复名 | issue#1023 / 决策#4 / 现状 SettingsView.tsx:addPropTemplate |

## R-5 propAliasMap 应用配置落地

别称映射表成为 `AppConfig.propAliasMap` 可维护配置：校验 + 桥接热应用 + 设置管理 UI + 内置默认可重置；只赋类型不改名。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 配置映射优先并热应用 | 设置新增 `customdate → 日期` 后打开含 `customdate: 2026-11-17` 外部文件，该字段 `data-type="date"` 且显示名严格等于 `customdate` | issue#1024 / 决策#5 |
| A-5.2 | exact | 恢复默认回内置 9 组 | 点「恢复默认」后自定义映射清空，含 `createdate: 2026-11-14` 的文件重新识别为 `data-type="date"` | issue#1024 / 决策#5 / 现状 frontmatter.ts:ALIAS |
| A-5.3 | exact | Rust 白名单拒绝非法类型值 | `validate_config` 收到 `propAliasMap: {"k":"color"}` 返回 `Err`，错误信息含非法类型 `color`；合法八类枚举通过 | issue#1024 / 决策#5 / 现状 config.rs:validate_config |
| A-5.4 | state-machine | 合并序：配置先于内置默认 | 同时存在用户映射 `date → text` 与内置 `date → date` 时，`date` 键解析为 `text`（配置覆盖内置） | 决策#5 / spec P-6 |

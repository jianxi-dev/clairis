## ADDED Requirements

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 缩进与对齐、颜色 两个二级入口。菜单项图标 SHALL 为 18px，行高 SHALL 为 32px，菜单宽 SHALL 为 236px。「在下方添加」行 SHALL 带图标与右侧展开指示，形态与其它行一致。

表格块 SHALL 与文本块共用同一组结构动作（复制、剪切、删除等），SHALL NOT 只显示「在下方添加」。不可用项 SHALL 以禁用态呈现，SHALL NOT 从菜单中消失。

> 2026-11-03 维护者裁定：**不再提供** 标题行 / 标题列 / 均分列宽 三个开关。GFM 表格恒有表头行、没有列宽与标题列的表达方式；为这三项引入非 GFM 扩展不值得（#137 已关闭）。

#### Scenario: 转为网格形态

- **WHEN** 用户打开任意文本块的块菜单
- **THEN** 「转为」区域 SHALL 为 5 列 2 行、共 10 个图标单元，且当前块型单元处于高亮态

#### Scenario: 表格块菜单有结构动作

- **WHEN** 用户打开表格块的块菜单
- **THEN** 菜单 SHALL 含 复制块、剪切块、删除块 与「在下方添加」；SHALL NOT 出现 标题行 / 标题列 / 均分列宽

#### Scenario: 每一行都有图标

- **WHEN** 用户打开块菜单
- **THEN** 菜单中每一行（含「在下方添加」）SHALL 各含一个 `svg[data-icon]`，图标渲染尺寸为 18px

### Requirement: E-12 单元格富文本编辑

表格单元格进入编辑态 SHALL 提供行内 markdown 能力：输入 `/` SHALL 打开锚定插入菜单，SHALL 支持 粗体、斜体、链接、行内代码 的即时渲染与源码写入。提交时 SHALL 保持 GFM 单元格单行约束（不含换行与裸管道符）。Enter SHALL 提交，Tab SHALL 提交并移至右侧单元格，Esc SHALL 取消并还原，失焦 SHALL 提交。

#### Scenario: 单元格内斜杠菜单

- **WHEN** 用户在单元格编辑态输入 `/`
- **THEN** SHALL 出现锚定插入菜单，选中项插入后单元格仍保持单行

#### Scenario: 单元格内行内格式

- **WHEN** 用户在单元格编辑态输入 `**粗**`
- **THEN** 显示为粗体，源码为 `**粗**`

#### Scenario: 单元格提交/取消

- **WHEN** 用户在编辑态按 Enter / Esc
- **THEN** Enter 提交并落盘，Esc 还原到编辑前的内容

## MODIFIED Requirements

### Requirement: E-9 单元格工具条可见性

表格单元格工具条 SHALL 仅在选区跨越两行及以上时出现。工具条 SHALL 提供「合并单元格」，并 SHALL 在单选或单行选区时不渲染。单元格背景色能力 SHALL 移除，源码中不再写入 `mdb-bg-*` 包裹。

#### Scenario: 单格不显示工具条

- **WHEN** 用户单击表格中的单个单元格
- **THEN** SHALL NOT 出现单元格工具条

#### Scenario: 多行选区显示合并

- **WHEN** 用户拖选跨越两行及以上的单元格
- **THEN** 工具条 SHALL 出现且「合并单元格」可用

#### Scenario: 背景色入口已移除

- **WHEN** 用户打开单元格工具条
- **THEN** SHALL NOT 出现背景色入口或 `mdb-bg-*` 相关控件

## ADDED Requirements

### Requirement: E-13 全角标点归一

在编辑态输入全角逗号 `，` 与全角斜杠 `／` 时，SHALL 自动替换为半角 `,` 与 `/`。替换 SHALL 不作用于围栏代码块、行内代码与 URL。替换 SHALL 与普通输入一样只产生一次撤销步（撤销即回到键入前）。

#### Scenario: 中文逗号转半角

- **WHEN** 用户在正文输入「你好，世界」
- **THEN** 源码 SHALL 为「你好,世界」

#### Scenario: 代码块内不替换

- **WHEN** 用户在围栏代码块内输入 `，`
- **THEN** 源码 SHALL 保留全角逗号

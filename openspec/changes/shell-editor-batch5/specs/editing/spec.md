## MODIFIED Requirements

### Requirement: E-13 全角标点归一

在编辑态输入全角逗号 `，` 与全角斜杠 `／` 时，SHALL 自动替换为半角 `,` 与 `/`。输入全角斜杠 `／` 或中文顿号 `、` 时，替换为半角 `/` 后 SHALL 触发斜杠命令菜单（等价于直接键入半角 `/`）。替换 SHALL 不作用于围栏代码块、行内代码与 URL。替换 SHALL 与普通输入一样只产生一次撤销步（撤销即回到键入前）。

#### Scenario: 中文逗号转半角

- **WHEN** 用户在正文输入「你好，世界」
- **THEN** 源码 SHALL 为「你好,世界」

#### Scenario: 全角斜杠转半角并唤起命令

- **WHEN** 用户在行首输入全角斜杠 `／`
- **THEN** 源码 SHALL 变为半角 `/`，且斜杠命令菜单 SHALL 打开

#### Scenario: 顿号转半角并唤起命令

- **WHEN** 用户在行首输入中文顿号 `、`
- **THEN** 源码 SHALL 变为半角 `/`，且斜杠命令菜单 SHALL 打开

#### Scenario: 代码块内不替换

- **WHEN** 用户在围栏代码块内输入 `，`
- **THEN** 源码 SHALL 保留全角逗号

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口。大纲入口按钮 SHALL 为方形圆角背景图形，默认背景透明；钉住态 SHALL 显示背景色（强调色系）。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块（``` 与 ~~~，含未闭合围栏）内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

点击大纲项 SHALL 把内容区滚动到对应标题：编辑/源码模式按文档行号定位并置于视口顶部，预览模式按标题元素滚到容器顶部。切换页签或编辑模式后，浮层 SHALL 只反映当前页签的标题。

#### Scenario: 列出标题并跳过代码块

- **WHEN** 用户悬停大纲按钮，文档含 `# 第一章` 与一个包含 `# 代码里的井号` 的围栏代码块
- **THEN** 浮层 SHALL 只列出真实标题，不得出现代码块内的行

#### Scenario: 点击跳转

- **WHEN** 用户点击大纲里的第二个标题
- **THEN** 编辑区 SHALL 滚动到该标题行，且该行位于内容区顶部附近

#### Scenario: 同名标题

- **WHEN** 文档含两个文本相同的标题
- **THEN** 点击第二个大纲项 SHALL 跳到第二个标题，不得跳到第一个

#### Scenario: 多页签跟随

- **WHEN** 用户切换到另一篇文档
- **THEN** 大纲 SHALL 只列出新页签的标题

#### Scenario: 按钮形态与钉住底色

- **WHEN** 大纲按钮未钉住 / 已钉住
- **THEN** 未钉住时 SHALL 为透明底的方形圆角图形；钉住时 SHALL 显示背景色

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 缩进（增加 / 减少）、颜色、对齐 入口。缩进图标 SHALL 使用语义正确的缩进/反缩进图形（SHALL NOT 复用好似「左对齐/清除」的错位图标）。颜色 SHALL 使用共享调色板（字色 8 色 + 底色 15 色的实色观感），SHALL NOT 呈现为偏淡的浅色块。菜单项图标 SHALL 为 20px，行高 SHALL 为 36px，菜单宽 SHALL 为 264px（2026-11-03「放大一档」，与 E-7 一致）。「在下方添加」行 SHALL 带图标与右侧展开指示，形态与其它行一致。

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
- **THEN** 菜单中每一行（含「在下方添加」）SHALL 各含一个 `svg[data-icon]`，图标渲染尺寸为 20px

#### Scenario: 缩进图标语义正确

- **WHEN** 审查块菜单的缩进 / 减少缩进两项
- **THEN** 两项图标 SHALL 为缩进与反缩进语义图形，SHALL NOT 与对齐类图标混淆

#### Scenario: 颜色观感为实色

- **WHEN** 用户展开块菜单的颜色面板
- **THEN** 色板 SHALL 呈现实色观感（字色与底色两组），SHALL NOT 呈现为偏淡的浅色块

### Requirement: E-16 HTML 可视化编辑

`.html` 文件的编辑态 SHALL 提供可视化编辑：用户可在渲染结果上点选元素、双击修改文本、通过工具条修改标签/样式/属性（见 E-19），改动 SHALL 反映到文档内容。可视化编辑态 SHALL 正确显示文档内容——对含外链脚本（如 CDN `<script>`）、非标准首字符、或复杂结构的 HTML 文档，编辑态 SHALL 仍能正常渲染与交互，SHALL NOT 出现空白或异常。保存 SHALL 写回**干净 HTML**——不得残留 `data-cm-*` 属性、`<!--cmid:-->` 注释锚点、`contenteditable` 或注入的运行时脚本/样式。

可视化编辑器 SHALL NOT 在打开文件时改写磁盘内容（除用户主动保存）。源码模式（CM6 `html()`）与可视化模式 SHALL 读写同一份 `content`，且切到源码模式时 CM6 的 `EditorView` SHALL NOT remount。

#### Scenario: 点选元素并修改文本

- **WHEN** 用户在可视化编辑态双击一段文字并输入新内容
- **THEN** 文档 `content` SHALL 反映该改动，切到预览 SHALL 看到同一处改动

#### Scenario: 选中后可改标签与样式

- **WHEN** 用户在可视化编辑态点选一个元素
- **THEN** SHALL 出现编辑工具条，可换标签、改字号/颜色/对齐、改 `class`/`id`

#### Scenario: 复杂文档编辑态可见

- **WHEN** 用户打开含外链 CDN 脚本与复杂结构的 HTML 文件并切到编辑态
- **THEN** 编辑面板 SHALL 渲染可见的文档内容，SHALL NOT 空白

#### Scenario: 保存零残留

- **WHEN** 用户在可视化编辑态改动内容后保存
- **THEN** 写回的文件 SHALL NOT 含 `data-cm-` 前缀、`cmid` 注释、`contenteditable` 或注入运行时的 `<script>`/`<style>`

#### Scenario: 打开文件不产生副作用

- **WHEN** 用户打开一个从未被本应用编辑过的 `.html` 文件，只看不改
- **THEN** 该文件的字节与 mtime SHALL 保持不变

#### Scenario: 源码模式状态不丢

- **WHEN** 用户在源码模式有未撤销的编辑与选区，切到可视化模式再切回源码
- **THEN** CM6 的 `EditorView` SHALL 是同一次挂载（undo 栈与选区保留）

## ADDED Requirements

### Requirement: 标题折叠

MD 编辑态 SHALL 为标题行与其下有下级内容的上级行渲染一个可折叠三角标记。点击三角 SHALL 折叠/展开该标题下（到下一个同级或更高级标题之前）的全部内容；折叠态 SHALL 视觉隐藏被折叠行。SHALL 至少对 ATX 标题（`#`–`######`）生效。

#### Scenario: 标题前有折叠三角

- **WHEN** 文档含 `# 第一章` 且其下有正文与 `## 小节`
- **THEN** 标题行前 SHALL 渲染一个折叠三角标记

#### Scenario: 折叠隐藏下级

- **WHEN** 用户点击某标题的折叠三角
- **THEN** 该标题到下一同级/更高级标题之间的内容 SHALL 视觉隐藏

#### Scenario: 无下级不显示三角

- **WHEN** 某标题下没有内容（到文档末尾前无下级行）
- **THEN** 该标题 SHALL NOT 渲染折叠三角

### Requirement: 前进后退恢复

MD 与 HTML 编辑态 SHALL 支持多步撤销/重做，撤销不 SHALL 一次清空全文且不可恢复。切换页签或 preview↔edit↔source 切换时，SHALL NOT 因内容同步而向编辑历史写入整篇替换记录（内容同步 SHALL 以不进入历史或最小 diff 的方式应用）；撤销/重做 SHALL NOT 跨越页签边界。HTML 可视化编辑 SHALL 提供文档级撤销栈。

#### Scenario: 同步不进历史

- **WHEN** 用户在预览态浏览后切到编辑态，随后按一次 Ctrl+Z
- **THEN** 正文 SHALL NOT 被清空为空白；撤销 SHALL 只回退用户的真实编辑步

#### Scenario: 多步撤销与重做

- **WHEN** 用户连续做三次编辑后按三次 Ctrl+Z 再按三次 Ctrl+Shift+Z
- **THEN** 内容 SHALL 逐步回退到编辑前，再逐步恢复到三次编辑后

#### Scenario: 撤销不跨页签

- **WHEN** 用户在页签 A 编辑，切到页签 B 后按 Ctrl+Z
- **THEN** SHALL NOT 影响页签 A 或把页签 B 内容替换为 A 的内容

### Requirement: 选区浮动工具条

MD 编辑态 SHALL 在用户选中文本时显示浮动工具条，且工具条集合 SHALL 与 workbuddy 对齐：块工具条 SHALL 恰含 AI 编辑、背景色、边框色、删除；文字工具条 SHALL 恰含 AI 编辑、字号（显示当前值）、加粗、斜体、下划线、删除线、链接、对齐、文字颜色、删除。选中文本范围内的调整 SHALL 作用于选区；未选中文本时，对区块类动作（对齐/删除/颜色）SHALL 作用于光标所在/识别到的整个区块。工具条图标 SHALL 复用静态图标体系。

#### Scenario: 选中文字出现工具条

- **WHEN** 用户在 MD 编辑态选中一段文字
- **THEN** SHALL 显示文字工具条，含 AI 编辑、字号、加粗、斜体、下划线、删除线、链接、对齐、文字颜色、删除

#### Scenario: 图标按钮生效于选区

- **WHEN** 用户选中文字并点击加粗
- **THEN** 选区文字 SHALL 加粗（源码包裹），未选中部分 SHALL 不受影响

#### Scenario: 未选中调整整块

- **WHEN** 光标在区块内且未选中文字，用户点击对齐
- **THEN** 该区块 SHALL 整体应用对齐

### Requirement: 块对齐

MD 编辑态 SHALL 支持块级对齐：左/中/右（至少），并 SHALL 复用与块颜色一致的作者语法（如 Pandoc fenced div 风格 `::: {.align-center}`），SHALL NOT 仅在 UI 显示而不改变文档。对齐 SHALL 作用于整块。

#### Scenario: 应用居中对齐

- **WHEN** 用户对某段落应用居中对齐
- **THEN** 文档源码 SHALL 出现对应的对齐标记，预览态该段落 SHALL 居中

#### Scenario: 取消对齐

- **WHEN** 用户对已居中段落再次应用居中
- **THEN** 对齐标记 SHALL 被移除，段落回到默认对齐

### Requirement: 编辑器工具条按 workbuddy 收敛

编辑器工具条的控件集合 SHALL 按 workbuddy 对齐收敛，制造工具条 SHALL NOT 保留 workbuddy 之外的冗余控件。

#### Scenario: 无多余控件

- **WHEN** 审查 MD 块工具条与文字工具条
- **THEN** 二者控件集合 SHALL 分别为「AI 编辑/背景色/边框色/删除」与「AI 编辑/字号/加粗/斜体/下划线/删除线/链接/对齐/文字颜色/删除」，SHALL NOT 出现清单外的控件

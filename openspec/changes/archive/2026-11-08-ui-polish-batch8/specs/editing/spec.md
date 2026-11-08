## MODIFIED Requirements

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口；入口按钮的右缘到内容区右缘的距离 SHALL 恰为一个按钮宽（28px，不含外边框），SHALL NOT 使用容器宽度的分数定位。大纲入口按钮 SHALL 为方形圆角图形：未钉住态 SHALL NOT 绘制边框（计算 `border-width` 为 0），背景透明；钉住态 SHALL 显示 1px 细边框与强调色系背景。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层未钉住时 SHALL NOT 绘制边框；钉住态 SHALL 绘制 1px 细边框。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块（``` 与 ~~~，含未闭合围栏）内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

点击大纲项 SHALL 把内容区滚动到对应标题：编辑/源码模式按文档行号定位并置于视口顶部，预览模式按标题元素滚到容器顶部。切换页签或编辑模式后，浮层 SHALL 只反映当前页签的标题。

#### Scenario: 大纲按钮位置

- **WHEN** 测量大纲入口按钮右缘到内容区右缘的距离
- **THEN** SHALL 为 28px（±2px），且按钮右侧不含额外空隙

#### Scenario: 未钉住无边框

- **WHEN** 大纲未钉住
- **THEN** 按钮计算 `border-width` SHALL 为 0px，浮层计算 `border-width` SHALL 为 0px

#### Scenario: 钉住细边框

- **WHEN** 用户点击大纲按钮钉住
- **THEN** 按钮与浮层的计算 `border-width` SHALL 均为 1px

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

#### Scenario: 按钮距右缘三分之二

- **WHEN** 测量大纲入口按钮右侧到内容区右缘的距离
- **THEN** 该距离 SHALL 约等于容器宽度的 2/3（误差不超过 4px）

#### Scenario: 钉住显示细边框

- **WHEN** 用户点击钉住大纲浮层
- **THEN** 浮层边框宽度 SHALL 为 1px

### Requirement: E-16 HTML 可视化编辑

`.html` 文件的编辑态 SHALL 提供可视化编辑：用户可在渲染结果上点选元素、双击修改文本、通过工具条修改标签/样式/属性（见 E-19），改动 SHALL 反映到文档内容。双击 SHALL 只把光标定位到点击处并进入该块编辑，SHALL NOT 选中点击位置邻近的文字（浏览器默认的双击选词 SHALL 被取消）。可视化编辑态 SHALL 正确显示文档内容——对含外链脚本、非标准首字符、或复杂结构的 HTML 文档，编辑态 SHALL 仍能正常渲染与交互，SHALL NOT 出现空白或异常。保存 SHALL 写回**干净 HTML**——不得残留 `data-cm-*` 属性、`<!--cmid:-->` 注释锚点、`contenteditable` 或注入的运行时脚本/样式。

可视化编辑器 SHALL NOT 在打开文件时改写磁盘内容（除用户主动保存）。源码模式（CM6 `html()`）与可视化模式 SHALL 读写同一份 `content`，且切到源码模式时 CM6 的 `EditorView` SHALL NOT remount。

#### Scenario: 双击只定位光标

- **WHEN** 用户在 HTML 可视化编辑态双击一段文字的中间
- **THEN** 进入该块编辑且 `window.getSelection().toString()` 的长度 SHALL 为 0；光标 SHALL 位于点击处附近（同一文本节点）

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

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素后提供工具条（`.html-edit-toolbar`），支持：**替换标签**、**修改样式**、**修改属性**（`class` / `id`）、**删除元素**、**区域截图**（见 E-21）。控件集 SHALL 按节点类型分化（见 E-22）。该工具条 SHALL 只出现在 HTML 可视化编辑态：markdown 编辑态 SHALL NOT 渲染 `.html-edit-toolbar`，HTML 可视化编辑态 SHALL NOT 渲染 markdown 的 `.cm-floating-toolbar` / `.cm-block-toolbar`。

工具条 SHALL 跟随选中元素定位，且 SHALL NOT 遮挡被选中元素本身。

工具条产生的改动 SHALL 折算回文档 `content`（样式写内联 `style`、属性写对应属性），并 SHALL 立即在渲染结果中可见。保存 SHALL 沿用 E-16 的清洗链路：写回文件不得残留 `data-cm-*` 属性、`cmid` 注释锚点、`contenteditable`、注入的运行时脚本/样式。

#### Scenario: 工具条归属

- **WHEN** 用户在 markdown 文件的编辑态选中一段文字
- **THEN** 页面中 `.html-edit-toolbar` 节点数 SHALL 为 0
- **AND WHEN** 用户在 HTML 文件的编辑态选中一个元素
- **THEN** `.html-edit-toolbar` SHALL 可见，且 `.cm-floating-toolbar` 节点数 SHALL 为 0

#### Scenario: 换标签保留内容与属性

- **WHEN** 用户选中一个 `<h2 class="lead">标题</h2>` 并在工具条里把标签换成 `h3`
- **THEN** `content` SHALL 变为 `<h3 class="lead">标题</h3>`，文本与 `class` 都保留，且 `h2` 不再出现

#### Scenario: 改样式立即生效

- **WHEN** 用户在工具条里给选中的段落选 24px 字号并居中
- **THEN** 文档 `content` SHALL 含该段落的 `style="font-size: 24px; text-align: center"`，渲染结果 SHALL 立即变化

#### Scenario: 清空属性即删除

- **WHEN** 用户把某个元素的 `class` 输入框清空
- **THEN** `content` 里该元素 SHALL 不再带 `class` 属性，SHALL NOT 出现 `class=""`

#### Scenario: 白名单外标签拒绝

- **WHEN** 工具条请求把一个段落换成白名单之外的标签
- **THEN** `content` SHALL 保持原样，不产生任何改动

#### Scenario: 保存零残留

- **WHEN** 用户用工具条改过标签与样式后保存
- **THEN** 写回的文件 SHALL NOT 含 `data-cm-` 前缀、`cmid` 注释、`contenteditable` 或注入运行时的 `<script>`/`<style>`

## ADDED Requirements

### Requirement: E-23 HTML 可视化编辑：选中块尺寸拖拽

HTML 可视化编辑态在选中一个区块元素后 SHALL 提供尺寸手柄：至少包含右缘、下缘、右下角三个可拖拽手柄；拖动 SHALL 修改该元素的 `width` / `height`（内联样式，单位 px，最小 24px），改动 SHALL 折算回文档 `content` 并立即在渲染结果中可见。位移小于 4px 时 SHALL 按点击处理，SHALL NOT 触发尺寸修改。处于文本编辑态（双击进入）时 SHALL NOT 显示尺寸手柄。

#### Scenario: 拖动右下角调整宽高

- **WHEN** 用户在 HTML 可视化编辑态选中一个 `<div>` 并拖动右下角手柄
- **THEN** 该元素的渲染宽高 SHALL 改变，文档 `content` 中该元素的内联 `style` SHALL 含 `width:` 与 `height:`

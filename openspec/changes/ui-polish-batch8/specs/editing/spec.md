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

### Requirement: E-16 HTML 可视化编辑

`.html` 文件的编辑态 SHALL 提供可视化编辑：用户可在渲染结果上点选元素、双击修改文本、通过工具条修改标签/样式/属性（见 E-19），改动 SHALL 反映到文档内容。双击 SHALL 只把光标定位到点击处并进入该块编辑，SHALL NOT 选中点击位置邻近的文字（浏览器默认的双击选词 SHALL 被取消）。可视化编辑态 SHALL 正确显示文档内容——对含外链脚本、非标准首字符、或复杂结构的 HTML 文档，编辑态 SHALL 仍能正常渲染与交互，SHALL NOT 出现空白或异常。保存 SHALL 写回**干净 HTML**——不得残留 `data-cm-*` 属性、`<!--cmid:-->` 注释锚点、`contenteditable` 或注入的运行时脚本/样式。

可视化编辑器 SHALL NOT 在打开文件时改写磁盘内容（除用户主动保存）。源码模式（CM6 `html()`）与可视化模式 SHALL 读写同一份 `content`，且切到源码模式时 CM6 的 `EditorView` SHALL NOT remount。

#### Scenario: 双击只定位光标

- **WHEN** 用户在 HTML 可视化编辑态双击一段文字的中间
- **THEN** 进入该块编辑且 `window.getSelection().toString()` 的长度 SHALL 为 0；光标 SHALL 位于点击处附近（同一文本节点）

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素后提供工具条（`.html-edit-toolbar`），支持：**替换标签**、**修改样式**、**修改属性**（`class` / `id`）、**删除元素**、**区域截图**（见 E-21）。控件集 SHALL 按节点类型分化（见 E-22）。该工具条 SHALL 只出现在 HTML 可视化编辑态：markdown 编辑态 SHALL NOT 渲染 `.html-edit-toolbar`，HTML 可视化编辑态 SHALL NOT 渲染 markdown 的 `.cm-floating-toolbar` / `.cm-block-toolbar`。

工具条 SHALL 跟随选中元素定位，且 SHALL NOT 遮挡被选中元素本身。

工具条产生的改动 SHALL 折算回文档 `content`（样式写内联 `style`、属性写对应属性），并 SHALL 立即在渲染结果中可见。保存 SHALL 沿用 E-16 的清洗链路：写回文件不得残留 `data-cm-*` 属性、`cmid` 注释锚点、`contenteditable`、注入的运行时脚本/样式。

#### Scenario: 工具条归属

- **WHEN** 用户在 markdown 文件的编辑态选中一段文字
- **THEN** 页面中 `.html-edit-toolbar` 节点数 SHALL 为 0
- **AND WHEN** 用户在 HTML 文件的编辑态选中一个元素
- **THEN** `.html-edit-toolbar` SHALL 可见，且 `.cm-floating-toolbar` 节点数 SHALL 为 0

## ADDED Requirements

### Requirement: E-23 HTML 可视化编辑：选中块尺寸拖拽

HTML 可视化编辑态在选中一个区块元素后 SHALL 提供尺寸手柄：至少包含右缘、下缘、右下角三个可拖拽手柄；拖动 SHALL 修改该元素的 `width` / `height`（内联样式，单位 px，最小 24px），改动 SHALL 折算回文档 `content` 并立即在渲染结果中可见。位移小于 4px 时 SHALL 按点击处理，SHALL NOT 触发尺寸修改。处于文本编辑态（双击进入）时 SHALL NOT 显示尺寸手柄。

#### Scenario: 拖动右下角调整宽高

- **WHEN** 用户在 HTML 可视化编辑态选中一个 `<div>` 并拖动右下角手柄
- **THEN** 该元素的渲染宽高 SHALL 改变，文档 `content` 中该元素的内联 `style` SHALL 含 `width:` 与 `height:`

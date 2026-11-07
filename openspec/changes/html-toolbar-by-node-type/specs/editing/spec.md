## ADDED Requirements

### Requirement: E-22 HTML 可视化编辑：工具条按节点类型分化

可视化编辑态的工具条 SHALL 按选中节点的类型提供不同的控件集：

- **文本级元素**（`p` / `h1`–`h6` / `li` / `blockquote` / `span` / `a` / `strong` / `em` / `b` / `i` / `u` / `s` / `code` / `pre` / `td` / `th` / `figcaption` / `label` / `dt` / `dd`，以及未知标签）SHALL 提供：字号、粗体、斜体、下划线、删除线、对齐、文字颜色；选中元素为 `<a>` 时 SHALL 额外提供 `href` 输入。
- **区块容器**（`div` / `section` / `article` / `aside` / `header` / `footer` / `main` / `nav` / `ul` / `ol` / `table` / `figure` / `form`）SHALL 提供：对齐、背景色、边框。

两类工具条 SHALL 共同提供：标签替换、`class` / `id`、区域截图、删除元素、关闭。文本级工具条 SHALL NOT 显示背景色与边框控件；区块工具条 SHALL NOT 显示字号与粗体/斜体/下划线/删除线控件。

粗体、斜体、下划线、删除线 SHALL 以元素的内联样式表达，SHALL 可再次点击取消。下划线与删除线 SHALL 能同时存在。样式写入 SHALL 基于文档的最新状态，连续操作两个开关时 SHALL NOT 互相覆盖。

删除元素 SHALL 移除该元素及其子树；选中 `html` 或 `body` 时删除 SHALL NOT 生效。

#### Scenario: 选中段落看到文字排版控件

- **WHEN** 用户点选一个 `<p>`
- **THEN** 工具条 SHALL 显示字号、粗体、斜体、下划线、删除线、对齐、文字颜色，且 SHALL NOT 显示背景色与边框

#### Scenario: 选中容器看到容器控件

- **WHEN** 用户点选一个 `<section>` 或 `<div>`
- **THEN** 工具条 SHALL 显示对齐、背景色、边框，且 SHALL NOT 显示字号与粗体/斜体/下划线/删除线

#### Scenario: 连续勾选下划线与删除线互不覆盖

- **WHEN** 用户先点下划线、紧接着点删除线
- **THEN** 该元素的 `text-decoration` SHALL 同时包含 `underline` 与 `line-through`

#### Scenario: 删除元素

- **WHEN** 用户点工具条的删除按钮
- **THEN** 该元素及其子树 SHALL 从文档 `content` 与渲染结果中消失，工具条 SHALL 关闭

#### Scenario: 不可删除 html/body

- **WHEN** 当前选中的是 `html` 或 `body`
- **THEN** 删除 SHALL NOT 生效，文档 `content` SHALL 保持不变

## MODIFIED Requirements

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素后提供工具条，支持：**替换标签**、**修改样式**、**修改属性**（`class` / `id`）、**删除元素**、**区域截图**（见 E-21）。控件集 SHALL 按节点类型分化（见 E-22）：文本级元素给排版类控件，区块容器给容器类控件。

工具条 SHALL 跟随选中元素定位，且 SHALL NOT 遮挡被选中元素本身。

工具条产生的改动 SHALL 折算回文档 `content`（样式写内联 `style`、属性写对应属性），并 SHALL 立即在渲染结果中可见。保存 SHALL 沿用 E-16 的清洗链路：写回文件不得残留 `data-cm-*` 属性、`cmid` 注释锚点、`contenteditable`、注入的运行时脚本/样式。

标签替换 SHALL 限定在白名单标签内（`p` / `h1` / `h2` / `h3` / `div` / `section` / `blockquote` / `li` / `span`）；白名单之外的标签 SHALL NOT 被写入文档。属性与样式项被清空时 SHALL 删除该属性/该项，SHALL NOT 写入空值属性。

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

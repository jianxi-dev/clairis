## MODIFIED Requirements

### Requirement: 预览分栏渲染

预览态 SHALL 把 `::: {.col-N}`（兼容 `cols=N`）围栏渲染为 N 栏布局（N=1..6），输出 `.layout-col-N` 容器，栏数与顺序 SHALL 与编辑态一致。不支持的属性和不含 `col` 的 `:::` 围栏 SHALL 保持原样，SHALL NOT 吞掉内容。窄视口下多栏 SHALL 折叠为单列。分栏内容区 SHALL 与正文一致地渲染（标题、列表、粗斜体、代码），SHALL NOT 退化为源码格式。

#### Scenario: 分栏渲染为多栏

- **WHEN** 用户打开含 `::: {.col-2}` … `:::` 的文档并进入预览态
- **THEN** `.preview-content .layout-col-2` 节点数 SHALL 为 1，可见文本含 `:::` 次数 SHALL 为 0，两栏子项的水平坐标差 SHALL 大于 0

#### Scenario: 无 col 围栏保持原样

- **WHEN** 文档含 `::: {.align-left}` 或普通 `:::` 围栏
- **THEN** 预览态 SHALL 按既有规则处理，SHALL NOT 生成 `.layout-col-*` 容器

#### Scenario: 分栏内外渲染一致

- **WHEN** 分栏内容区含标题 / 列表 / 粗斜体并进入预览态
- **THEN** 分栏内 SHALL 按正文渲染，可见源码标记（`**` / `##`）节点数 SHALL 为 0

### Requirement: A-10 阅读宽度与标题配色

预览阅读宽度 SHALL 默认为 880px（`min(880px, 可用宽度 - 48px)`），标题 SHALL 应用用户配置的标题配色（`headingColors`，经 CSS 变量注入，明暗主题均生效）。用户可选的页面宽度最大值 SHALL 为 1400px；三档预设 SHALL 为 紧凑 720px / 标准 960px / 宽松 1200px。

每一级标题（H1–H6）SHALL 应用用户配置的标题字体（`headingFonts`）；未配置时 SHALL 回落到 md-bundle 预览态字体（`--type-font-sans`）。标题字体是标题面的覆盖，SHALL NOT 改变正文与代码字体。

#### Scenario: 阅读宽度

- **WHEN** 用户选择宽松档
- **THEN** 正文行宽变量 `--type-measure` SHALL 为 1200px，宽内容上限 `--type-measure-wide` SHALL 不超过 1400px

#### Scenario: 标题配色

- **WHEN** 预览渲染 markdown 标题
- **THEN** h1-h6 SHALL 应用 `headingColors` 配置的颜色

#### Scenario: 标题字体逐级应用

- **WHEN** 用户为 H1 选择字体 A、为 H2 选择字体 B 后预览渲染标题
- **THEN** h1 计算 `font-family` SHALL 等于字体 A，h2 SHALL 等于字体 B，正文 `font-family` SHALL 不变

#### Scenario: 标题字体默认回落

- **WHEN** 用户未配置任何标题字体
- **THEN** h1-h6 计算 `font-family` SHALL 等于 `--type-font-sans`

## ADDED Requirements

### Requirement: 内嵌文件渲染

Markdown 中插入的 pdf / md / html / 内嵌页面等文件 SHALL 在正文中内嵌渲染真实内容，SHALL NOT 只显示文件名 / 链接。内嵌块默认高度 SHALL 约一屏，SHALL 支持调整显示高宽，内容 SHALL 可滚动。滚动到某区域后鼠标滑出 SHALL 定格，再次打开 SHALL 保持该定格（持久化到文档级 view-state）。内嵌块 SHALL 支持切换「只显示文件名 / 链接」与「显示内容」；仅显示名称 / 链接时鼠标滑入 SHALL 弹出悬浮窗预览内容。点击支持本产品打开的链接文件 SHALL 在新标签页打开。

#### Scenario: 内嵌渲染内容

- **WHEN** 用户在 Markdown 中插入一个 pdf / md / html 文件
- **THEN** 正文中 SHALL 出现内嵌内容节点（iframe / 渲染容器），SHALL NOT 只显示文件名

#### Scenario: 默认一屏高与可调

- **WHEN** 用户插入一个内嵌文件
- **THEN** 内嵌块默认高度 SHALL 约一屏；拖拽边缘后其高度 / 宽度 SHALL 随之变化

#### Scenario: 滚动定格与重开保持

- **WHEN** 用户把内嵌内容滚动到某区域后把鼠标滑出，再重新打开该文档
- **THEN** 内嵌块 SHALL 恢复到滑出时的定格位置

#### Scenario: 名称态与悬浮预览

- **WHEN** 用户把内嵌块切换为「只显示文件名 / 链接」
- **THEN** 内容节点 SHALL 隐藏；鼠标滑入时 SHALL 出现悬浮窗预览内容

#### Scenario: 链接新标签页打开

- **WHEN** 用户点击内嵌块中支持本产品打开的链接文件
- **THEN** 该文件 SHALL 在新标签页中打开

### Requirement: 文本与脚本预览语法

预览态对纯文本 / 脚本（代码）文件 SHALL 显示语法颜色与代码块缩进格式，SHALL NOT 以无差别纯文本回退。语法颜色 SHALL 复用既有代码高亮 token 与语言别名表；代码块前导缩进 SHALL 保留。

#### Scenario: 语法颜色

- **WHEN** 用户预览一个 `.js` / `.py` 等脚本文件
- **THEN** 代码 token 节点（`.tok-*`）数 SHALL ≥1

#### Scenario: 缩进保留

- **WHEN** 用户预览含缩进的代码块
- **THEN** 前导空白 SHALL 保留，行首缩进不丢失

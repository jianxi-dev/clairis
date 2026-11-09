## MODIFIED Requirements

### Requirement: E-13 全角标点归一

在编辑态输入全角逗号 `，` 时，SHALL 自动替换为半角 `,`。全角斜杠 `／` 与中文顿号 `、` SHALL 按原字符插入，SHALL NOT 归一为半角 `/`，也 SHALL NOT 触发斜杠命令菜单。替换 SHALL 不作用于围栏代码块、行内代码与 URL。替换 SHALL 与普通输入一样只产生一次撤销步。

#### Scenario: 中文逗号转半角

- **WHEN** 用户在正文输入「你好，世界」
- **THEN** 源码 SHALL 为「你好,世界」

#### Scenario: 全角斜杠不触发命令

- **WHEN** 用户在行首输入全角斜杠 `／`
- **THEN** 源码 SHALL 保留 `／`，斜杠命令菜单节点数 SHALL 为 0

#### Scenario: 顿号不触发命令

- **WHEN** 用户在行首输入中文顿号 `、`
- **THEN** 源码 SHALL 保留 `、`，斜杠命令菜单节点数 SHALL 为 0

#### Scenario: 代码块内不替换

- **WHEN** 用户在围栏代码块内输入 `，`
- **THEN** 源码 SHALL 保留全角逗号

### Requirement: E-17 块手柄召唤区域与滑入菜单

MD 编辑态的块手柄 SHALL 仅在指针位于正文左侧四分之一区域或手柄自身时召唤；指针位于其余区域 SHALL NOT 显示手柄。非空块手柄滑入后 SHALL 自动显示块菜单。空行「+」手柄 SHALL 只在按压时打开插入菜单，指针悬停 SHALL NOT 打开转换菜单。

#### Scenario: 左侧四分之一召唤

- **WHEN** 指针进入正文左侧四分之一区域
- **THEN** 对应块手柄 SHALL 淡入

#### Scenario: 右侧不召唤

- **WHEN** 指针仅在正文右侧区域移动
- **THEN** 块手柄 SHALL 保持隐藏

#### Scenario: 非空块滑入即菜单

- **WHEN** 指针从正文滑入已显示的非空块手柄
- **THEN** 块菜单 SHALL 自动打开

#### Scenario: 空行加号悬停不弹转换菜单

- **WHEN** 用户把指针停在空行「+」手柄上 1 秒
- **THEN** 转换菜单节点数 SHALL 为 0，插入菜单 SHALL 保持关闭

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素或文字后提供横向工具条，SHALL NOT 使用选区轮盘。工具条按节点类型分化：

- 文字节点与文字选区 SHALL 显示：AI、字号、加粗、斜体、下划线、删除线、链接、对齐、文字颜色、截图、删除。
- 非文字区块 SHALL 显示：AI、背景色、边框色、删除。

工具条 SHALL 跟随选中元素/选区定位且 SHALL NOT 遮挡目标。改动 SHALL 折算回 `content` 并立即可见；保存 SHALL 零残留（无 `data-cm-*`、`cmid`、`contenteditable`、注入脚本/样式）。

#### Scenario: HTML 文字节点显示文字工具条

- **WHEN** 用户在 HTML 可视化编辑态点选一个 `<p>`
- **THEN** 工具条 SHALL 含 AI、字号、粗体、斜体、下划线、删除线、链接、对齐、文字颜色、删除，且 SHALL NOT 含背景色与边框色

#### Scenario: HTML 文字选区显示同一横向条

- **WHEN** 用户在 HTML 可视化编辑态选中一段文字
- **THEN** SHALL 出现横向工具条，轮盘节点数 SHALL 为 0

#### Scenario: HTML 区块显示四项

- **WHEN** 用户点选一个 `<section>`
- **THEN** 工具条 SHALL 只含 AI、背景色、边框色、删除

#### Scenario: MD 编辑态不出现块工具条

- **WHEN** 用户在 Markdown 编辑态点击正文任意位置且未选中文字
- **THEN** `[data-testid="block-toolbar"]` 节点数 SHALL 为 0

#### Scenario: AI 按钮带入选中文本

- **WHEN** 用户点选一个文字节点并点击工具条 AI
- **THEN** AI 浮层 SHALL 打开且输入框含该节点文本

#### Scenario: 保存零残留

- **WHEN** 用户用工具条改过样式后保存
- **THEN** 写回文件 SHALL NOT 含 `data-cm-`、`cmid`、`contenteditable` 或注入的 `<script>`/`<style>`

### Requirement: E-22 HTML 可视化编辑：工具条按节点类型分化

可视化编辑态的工具条 SHALL 按选中节点的类型提供不同的控件集：文字节点/文字选区 SHALL 提供字号、粗体、斜体、下划线、删除线、链接、对齐、文字颜色、AI、删除；区块容器 SHALL 提供对齐、背景色、边框色、AI、删除。文字级工具条 SHALL NOT 显示背景色与边框控件；区块工具条 SHALL NOT 显示字号与粗体/斜体/下划线/删除线控件。

粗体、斜体、下划线、删除线 SHALL 以元素的内联样式表达并可再次点击取消；下划线与删除线 SHALL 能同时存在。删除元素 SHALL 移除该元素及其子树；选中 `html` 或 `body` 时删除 SHALL NOT 生效。

#### Scenario: 连续勾选下划线与删除线互不覆盖

- **WHEN** 用户先点下划线、紧接着点删除线
- **THEN** 该元素的 `text-decoration` SHALL 同时包含 `underline` 与 `line-through`

#### Scenario: 删除元素

- **WHEN** 用户点工具条的删除按钮
- **THEN** 该元素及其子树 SHALL 从文档 `content` 与渲染结果中消失，工具条 SHALL 关闭

#### Scenario: 不可删除 html/body

- **WHEN** 当前选中的是 `html` 或 `body`
- **THEN** 删除 SHALL NOT 生效，文档 `content` SHALL 保持不变

### Requirement: 标题折叠

MD 编辑态 SHALL 为有下级内容的 ATX 标题渲染 20×20 折叠三角；点击 SHALL 折叠/展开到下一个同级或更高级标题之前的内容。三角默认隐藏；指针位于 `.cm-content` 左缘 25% 召唤区时，SHALL 只显示指针所在行的三角；三角自身悬停、键盘聚焦或已折叠时 SHALL 始终显示。折叠替换 SHALL 保留标题行末换行符。

MD 预览态 SHALL 为每个有下级内容的标题渲染折叠按钮；按钮默认隐藏，指针悬停该标题或已折叠时显示。点击 SHALL 隐藏后续兄弟内容直到下一个同级或更高级标题。

#### Scenario: 编辑态只显示当前行三角

- **WHEN** 指针在召唤区内移动到第二个标题行
- **THEN** 只有该行折叠三角的计算 `opacity` SHALL 为 1，其他标题 SHALL 为 0

#### Scenario: 相邻折叠不合并

- **WHEN** 用户依次折叠四个相邻的一级标题
- **THEN** 四个标题 SHALL 分处四个 `.cm-line`

#### Scenario: 预览态折叠

- **WHEN** 用户在 MD 预览态点击某个标题的折叠按钮
- **THEN** 该标题到下一个同级/更高级标题之间的内容 SHALL 隐藏，按钮 SHALL 转为展开态

#### Scenario: 预览态显隐

- **WHEN** 指针不在任一标题上
- **THEN** 所有预览折叠按钮的计算 `opacity` SHALL 为 0

# editing — 基础编辑能力当前规格

## Purpose

editing 域定义标月桌面端的基础编辑能力：阅读/源码模式切换、CodeMirror 6 L2 编辑美化、文件保存（含原子写入、未保存守卫与并发覆盖保护）以及 HTML 源码编辑。本规格是 editing 域可验收功能行为的唯一真相源；条目编号（E-1 至 E-4）与 `docs/MVP-需求跟踪表.md` 模块 E 一一对应。

## 设计来源与参考

- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵 Phase M（源码模式查看、加粗/斜体/删除线、语法高亮、工具栏、未保存守卫、并发覆盖保护、原子写入）、§三 快捷键体系；`docs/MVP-需求跟踪表.md` 模块 E（E-1 至 E-4 均标 ✅）
- 硬约束：模式切换（preview/edit/source）使用 CSS display 切换，不 remount EditorView，以保留 undo/选区/编辑状态（见 `AGENTS.md` 仓库约束与 `CONTEXT.md`）
## Requirements
### Requirement: E-1 源码模式

应用 SHALL 提供预览与源码模式的一键切换；切换 SHALL 保留编辑状态（不 remount 编辑器实例，undo 栈、选区、光标位置均保留）。

#### Scenario: 模式切换保留编辑状态

- **WHEN** 用户在编辑态已输入内容并产生 undo 历史后切换到源码模式，再切回
- **THEN** 编辑器内容、选区与 undo 历史 SHALL 保持不变（编辑器实例未重建）

### Requirement: E-2 GFM L2 编辑

编辑模式 SHALL 基于 CodeMirror 6 decoration 对核心语法标记做可视化美化，覆盖范围 SHALL 包括：加粗、斜体、引用、列表、标题、行内代码/代码块。美化 SHALL 不改变底层 Markdown 源码——保存结果与所见语义一致。IME 组合输入降级处理与 `Cmd+Click` 链接导航为 P1 polish，不属于当前已验收行为。

#### Scenario: 核心语法 decoration 美化

- **WHEN** 用户编辑包含粗体、斜体、引用、列表、标题、代码块标记的文档
- **THEN** 这些语法标记 SHALL 以 decoration 呈现美化效果（如标题放大、引用块样式化），且可见的语义与源码一致

#### Scenario: 编辑-保存往返无损

- **WHEN** 用户在 L2 编辑态修改内容并保存，再以源码模式打开同一文件
- **THEN** 源码 SHALL 与编辑语义一致，decoration SHALL 不向文件中注入展示性字符

### Requirement: E-3 保存文件与写入保护

文件保存 SHALL 支持 `Cmd+S` 手动保存，写入 SHALL 采用原子写入（tempfile→persist）。存在未保存修改（dirty）时，切换标签/导航目录/离开 SHALL 被未保存守卫拦截，三种编辑器模式 SHALL 使用统一 guard。写入前 SHALL 校验文件 mtime（编辑前记录 mtime），文件已被外部修改时 SHALL 防止盲覆盖。

#### Scenario: 手动保存原子写入

- **WHEN** 用户按 `Cmd+S` 保存
- **THEN** 内容 SHALL 以原子方式写入磁盘（临时文件落盘后 rename 持久化），不产生半写文件

#### Scenario: 未保存守卫拦截导航

- **WHEN** 文档处于 dirty 状态时用户尝试切换标签、切换目录或关闭离开
- **THEN** 应用 SHALL 拦截该操作并提示未保存（三种编辑模式行为一致）

#### Scenario: 并发覆盖保护

- **WHEN** 用户编辑期间文件被外部修改（磁盘 mtime 领先于编辑前记录值），此时用户触发保存
- **THEN** 应用 SHALL 检测到 mtime 变化并阻止盲覆盖，交由用户裁定，而不是静默覆盖外部修改

### Requirement: E-4 HTML 源码编辑

应用 SHALL 支持 `.html` 文件的源码编辑，使用 CodeMirror html() 模式提供 HTML 语法高亮。

#### Scenario: HTML 源码高亮编辑

- **WHEN** 用户将 `.html` 文件切换到源码/编辑模式
- **THEN** 内容 SHALL 以 HTML 语法高亮呈现并可编辑

### Requirement: E-6 编辑内核与插入入口

编辑模式 SHALL 支持块级装饰（表格、分栏、高亮块、图片、链接、分割线、代码围栏、引用、列表、标题）、插入入口（斜杠菜单、空行「+」、块手柄占位）与智能输入（`# ` `- ` `> ` `1. ` `- [ ] ` 自动转换）。装饰层 SHALL 通过 CM6 扩展装配，模式切换 SHALL NOT remount EditorView。

所有操作 SHALL 满足两条红线：
1. **源码无损**：操作后 Markdown 只在目标处变化，其余字节不变。
2. **显示=源码**：被操作元素的可见文本 SHALL 严格等于其在源码中的值。

#### Scenario: 表格单元格编辑

- **WHEN** 用户点击单元格并把 `B2` 改成 `B2XYZ`
- **THEN** 源码 SHALL 只在该单元格变化，且单元格**可见文本** SHALL 立即为 `B2XYZ`（不需要再点别处）

#### Scenario: 斜杠插入

- **WHEN** 用户在空行输入 `/h1`
- **THEN** 当前行 SHALL 变为一级标题，源码为 `# `，其余行逐字节不变

#### Scenario: 取消无残留

- **WHEN** 用户打开斜杠菜单后点击外部或按 Esc
- **THEN** 菜单 SHALL 关闭，输入框 SHALL NOT 残留 `/`

### Requirement: E-7 编排层交互契约

编辑模式 SHALL 提供块手柄、统一菜单栈、锚点化浮层与 hover 门控。浮层生命周期 SHALL 由单一菜单栈管理：滑入即显示、离开整栈即收起、**不 retarget**（栈打开期间指针移动到其它块不得改变锚点）、滚动容器滚动即收起。浮层位置 SHALL 由 CM6 坐标（`coordsAtPos`）计算，并在视口/容器边界越界时先翻转再夹取。块手柄 SHALL 为 42×26 药丸（块型图标 + 拖拽把手），空行退化为「+」入口；块菜单 SHALL 为 236px 宽、行高 32px，按块型裁剪「转为」项。

所有编排操作 SHALL 满足两条红线：
1. **源码无损**：拖拽、插入、关闭浮层后，除目标块外 Markdown 逐字节不变。
2. **显示=源码**：被操作块的可见文本 SHALL 严格等于其在源码中的值。

#### Scenario: 块手柄拖拽重排

- **WHEN** 用户用块手柄把第 2 段拖到第 1 段之前并松手
- **THEN** 源码中两段顺序交换，其余字节不变，且该次重排可被一次撤销还原

#### Scenario: 菜单不 retarget

- **WHEN** 块菜单已打开，用户把指针移到另一个块
- **THEN** 菜单 SHALL 仍锚在原块，不得切换到新块；必须先关闭再打开才能换锚点

#### Scenario: 浮层裁剪

- **WHEN** 用户在接近视口底部的位置打开块菜单
- **THEN** 浮层 SHALL 翻转到锚点上方或夹取到容器内，完整可见且矩形不越出视口

#### Scenario: hover 门控

- **WHEN** 用户正在用键盘输入，或指针只是快速划过
- **THEN** 块手柄与菜单 SHALL NOT 出现；指针停留 300ms 后才显现，离开栈 150ms 后收起

### Requirement: E-8 编辑态与预览态同貌

编辑模式 SHALL 与预览模式呈现同一份排版。二者 SHALL 共享纸面宽度、内边距、纸面底色与投影、正文字体族、字号、行高、标题配色与阅读强调色；编辑态正文 SHALL 与预览正文同宽（同一窄栏），宽内容（表格/分栏/图片/媒体）SHALL 走满纸宽。

编辑模式 SHALL NOT 出现只有编辑器才有的外壳：行号槽、折叠箭头、活动行高亮。

语法高亮 SHALL 只用于代码 token，SHALL NOT 改写标题与正文的排版（不得给标题加下划线或覆盖字重）。

块级渲染 SHALL 与预览一致：

1. 连续 `>` 行 SHALL 渲染为**一张**引用卡片，行距与预览一致，不得逐行加纵向内边距。
2. `> [!TYPE]` 高亮块 SHALL 只有高亮块自身的一层卡片，不得再叠加引用底色。
3. 围栏代码块 SHALL 不因开启/闭合围栏行而多出空白行。
4. 缩进列表 SHALL 保持嵌套缩进与项目符号，不得把 `- ` 原样显示。

#### Scenario: 标题不被高亮器改写

- **WHEN** 用户打开一份含 `#` ~ `####` 标题的文档并进入编辑模式
- **THEN** 每个标题只按 `--heading-hN` 着色，计算样式 `text-decoration-line` 为 `none`

#### Scenario: 多行引用是一张卡片

- **WHEN** 文档中有两行以上连续 `>` 引用
- **THEN** 编辑态渲染为一张带左侧竖线的卡片，行间距与预览一致，不得出现行间空档

#### Scenario: 高亮块只有一层

- **WHEN** 文档中有 `> [!TIP]` 高亮块
- **THEN** 编辑态只显示高亮块卡片本身，卡片外不得有引用底色或竖线

#### Scenario: 围栏代码块无多余空行

- **WHEN** 文档中有围栏代码块且光标不在块内
- **THEN** 代码卡片内只显示代码行，开栏/闭栏行不占高度

#### Scenario: 嵌套列表

- **WHEN** 文档中有两空格缩进的子列表项
- **THEN** 编辑态显示项目符号、隐藏原始 `- `，且该行左边缘比父项更靠右

#### Scenario: 没有编辑器专属外壳

- **WHEN** 用户进入编辑模式
- **THEN** 编辑区不出现行号槽、折叠箭头与整行活动行高亮


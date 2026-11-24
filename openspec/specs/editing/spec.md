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

编辑模式 SHALL 支持块级装饰（表格、分栏、高亮块、图片、链接、分割线、代码围栏、引用、列表、标题）、插入入口（斜杠菜单、空行「+」、块手柄占位、容器内容输入处的「+」手柄）与智能输入（`# ` `- ` `> ` `1. ` `- [ ] ` 自动转换）。装饰层 SHALL 通过 CM6 扩展装配，模式切换 SHALL NOT remount EditorView。斜杠菜单 SHALL 支持「内容输入上下文」触发：表格单元格、分栏内容区、高亮块内容区的原生输入控件 SHALL 接入与文档级一致的统一菜单组件与命令注册表；上下文触发时焦点 SHALL 保持在触发控件，过滤词 SHALL 来自该控件，选中后内容 SHALL 插入到触发控件对应位置，菜单定位 SHALL 基于触发控件的屏幕矩形。

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

#### Scenario: 单元格内斜杠触发

- **WHEN** 用户在表格单元格内输入 `/`
- **THEN** 插入菜单 SHALL 在该单元格近旁打开，焦点 SHALL 保持在单元格输入框，后续按键 SHALL 进入单元格输入框用于过滤

#### Scenario: 单元格内取消无残留

- **WHEN** 用户在单元格内输入 `/` 后按 Esc 或点击菜单外部
- **THEN** 菜单 SHALL 关闭，单元格文本 SHALL NOT 残留 `/`，表格源码其余部分逐字节不变

#### Scenario: 单元格菜单插入落点

- **WHEN** 用户在单元格内打开插入菜单并选中一项
- **THEN** 内容 SHALL 插入到该单元格内，源码表格行数/列数不变，且选中的内容出现在目标单元格的可见文本中

#### Scenario: 单元格手柄统一居中

- **WHEN** 用户悬停任一非表头单元格
- **THEN** 单元格手柄 SHALL 显示统一的一种表格图标（空/非空单元格不再切换两套图标），手柄纵向中心与单元格纵向中心差 SHALL ≤ 2px，手柄 SHALL 位于单元格左边框线外侧且不覆盖单元格文本

#### Scenario: 表头无手柄

- **WHEN** 用户悬停表头（`th`）单元格
- **THEN** SHALL NOT 出现单元格手柄图标

#### Scenario: 单元格手柄圆角

- **WHEN** 用户悬停非表头单元格并测量手柄计算样式
- **THEN** 手柄 `border-radius` SHALL 为 3px

#### Scenario: 容器内斜杠触发

- **WHEN** 用户在分栏内容区或高亮块内容区输入 `/`
- **THEN** 统一插入菜单 SHALL 在该输入控件近旁打开，焦点 SHALL 保持在控件，选中后内容 SHALL 插入到控件文本对应位置，取消后控件文本 SHALL NOT 残留 `/`

#### Scenario: 容器新增手柄

- **WHEN** 用户悬停分栏内容区或高亮块内容区
- **THEN** SHALL 出现「+」新增手柄（与单元格手柄同款形态），点击后 SHALL 打开统一插入菜单，插入落点在该容器内容文本内

### Requirement: E-7 编排层交互契约

编辑模式 SHALL 提供块手柄、统一菜单栈、锚点化浮层与 hover 门控。浮层生命周期 SHALL 由单一菜单栈管理：滑入即显示、离开整栈即收起、**不 retarget**（栈打开期间指针移动到其它块不得改变锚点，也不得召唤其它手柄）、滚动容器滚动即收起。块菜单位置 SHALL 横向贴触发手柄右缘、纵向以指针所在行为中心；越界时先翻转再夹取，高度 SHALL 封顶到锚点较大一侧并允许滚动，不得被推离锚点。块手柄 SHALL 为 42×26 药丸（块型图标 + 拖拽把手），空行退化为「+」入口；块菜单 SHALL 为 176px 宽、行高 36px、图标 20px，按块型裁剪「转为」项，且每一行 SHALL 带图标。「在下方添加」SHALL 在悬停后向右展开二级面板并保留父菜单，父菜单高度 SHALL NOT 因二级内容变化；点击手柄 SHALL 等价于悬停召唤。

表格行列插入 SHALL 以「外缘圆点」承载：指针滑入表格后，列插入点 SHALL 以圆点形态显示在表格上边框外（相邻两列中点水平位置，含尾列追加点），行插入点 SHALL 以圆点形态显示在表格左边框外（相邻两行中点垂直位置，含尾行追加点）；悬停圆点 SHALL 变为「+」图标；点击 SHALL 展开插入/删除操作气泡。指针离开表格 SHALL 隐藏全部圆点。

上下文菜单（单元格/容器触发）SHALL 按触发上下文提供命令安全集：单元格上下文 SHALL NOT 出现块级命令（表格/分栏/代码块等在管道表内不合法的命令）；分栏与高亮块容器上下文 SHALL 包含行内命令与可安全落入容器语法的块命令。

任一二級面板（类型 / 颜色 / 对齐与缩进）展开后 SHALL 把当前菜单栈标记为 keep-open：指针离开父菜单与二级面板后 SHALL NOT 触发收起定时器关闭，收起 SHALL 只由选中项、外部 `pointerdown`、`Esc` 或滚动触发。父菜单与二级面板之间的视觉间隙 SHALL 由二级面板自身的透明内边距桥接，SHALL NOT 让空白承担分离。

所有编排操作 SHALL 满足两条红线：
1. **源码无损**：拖拽、插入、关闭浮层后，除目标块外 Markdown 逐字节不变。
2. **显示=源码**：被操作块的可见文本 SHALL 严格等于其在源码中的值。

#### Scenario: 编辑态块菜单贴手柄并居中

- **WHEN** 用户把指针停在某块上召唤手柄并打开块菜单
- **THEN** 菜单 SHALL 贴在手柄右侧，纵向中点与指针所在行中点相差不超过一个行高，且完整落在编辑器可视区内

#### Scenario: 块手柄拖拽重排

- **WHEN** 用户用块手柄把第 2 段拖到第 1 段之前并松手
- **THEN** 源码中两段顺序交换，其余字节不变，且该次重排可被一次撤销还原

#### Scenario: 菜单不 retarget

- **WHEN** 块菜单已打开，用户把指针移到另一个块
- **THEN** 菜单 SHALL 仍锚在原块，且 SHALL NOT 在其它块前冒出新手柄；必须先关闭再打开才能换锚点

#### Scenario: 浮层裁剪

- **WHEN** 用户在接近视口底部的位置打开块菜单
- **THEN** 浮层 SHALL 翻转到锚点上方或夹取到容器内，完整可见且矩形不越出视口

#### Scenario: hover 门控

- **WHEN** 用户正在用键盘输入，或指针只是快速划过
- **THEN** 块手柄与菜单 SHALL NOT 出现；指针停留 300ms 后才显现，离开栈 150ms 后收起
- **AND** 指针移动到新的块时 SHALL 恢复召唤能力（不得因按键结束事件丢失而永久失效）
- **AND** 点击已显现的手柄 SHALL 直接打开块菜单

#### Scenario: 在下方添加向右展开

- **WHEN** 用户把指针移到块菜单的「在下方添加」上
- **THEN** 二级插入面板 SHALL 在父菜单右侧展开，父菜单 SHALL 保留且高度不变

#### Scenario: 类型二级菜单滑出不消失

- **WHEN** 用户展开块菜单并悬停「转为」→「类型」，二级面板出现后把指针移到编辑器空白处 600ms
- **THEN** 类型二级面板与父菜单 SHALL 仍可见

#### Scenario: 二级菜单 Esc 关闭

- **WHEN** 类型二级面板与父菜单同时可见时用户按 `Esc`
- **THEN** 二级面板与父菜单 SHALL 同时消失，且源码不变

#### Scenario: 行列插入圆点形态

- **WHEN** 用户把指针滑入表格
- **THEN** 上边框外每个列间位置 SHALL 出现圆点、左边框外每个行间位置 SHALL 出现圆点，圆点矩形 SHALL 与表格边框外缘相邻且在表格矩形之外

#### Scenario: 圆点悬停变加号

- **WHEN** 用户悬停任一插入圆点
- **THEN** 该圆点 SHALL 变为「+」图标形态；指针离开表格后全部圆点 SHALL 隐藏

#### Scenario: 圆点点击插入

- **WHEN** 用户点击某列间圆点展开气泡并选「插入列」
- **THEN** 该位置 SHALL 新增一列，表格其余内容逐字节不变；行间圆点同规则作用于行

#### Scenario: 单元格上下文命令安全集

- **WHEN** 用户在表格单元格内打开插入菜单
- **THEN** 菜单 SHALL NOT 出现块级命令（表格/分栏/代码围栏等），SHALL 包含行内命令，且每个菜单项 SHALL 完整可见

#### Scenario: 容器上下文命令集

- **WHEN** 用户在分栏内容区或高亮块内容区打开插入菜单
- **THEN** 菜单 SHALL 包含行内命令与表格等容器内合法的块命令，且每个菜单项 SHALL 完整可见

### Requirement: E-8 编辑态与预览态同貌

编辑模式 SHALL 与预览模式呈现同一份排版。二者 SHALL 共享纸面宽度、内边距、纸面底色与投影、正文字体族、字号、行高、标题配色与阅读强调色；编辑态正文 SHALL 与预览正文同宽（同一窄栏），宽内容（表格/分栏/图片/媒体）SHALL 走满纸宽。

编辑模式 SHALL NOT 出现只有编辑器才有的外壳：行号槽、折叠箭头、活动行高亮。

语法高亮 SHALL 只用于代码 token，SHALL NOT 改写标题与正文的排版（不得给标题加下划线或覆盖字重）。**行内代码在编辑态 SHALL 显示与预览态一致的底色 / 圆角 / 等宽字体效果**（复用既有 `cm-inline-code` 装饰与其 CSS），SHALL NOT 退化为无样式的纯文本。

块级渲染 SHALL 与预览一致：

1. 连续 `>` 行 SHALL 渲染为**一张**引用卡片，行距与预览一致，不得逐行加纵向内边距。
2. `> [!TYPE]` 高亮块 SHALL 只有高亮块自身的一层卡片，不得再叠加引用底色。
3. 围栏代码块 SHALL 不因开启/闭合围栏行而多出空白行。
4. 缩进列表 SHALL 保持嵌套缩进与项目符号，不得把 `- ` 原样显示。

代码块、引用块与 mermaid 块在编辑态的左右边框 SHALL 与正文文本块的左右边框对齐，且三者彼此一致；宽度补偿 SHALL 通过块自身最大宽度 / 内边距实现，SHALL NOT 改动 `.cm-line` 的基础行宽。

#### Scenario: 行内代码显示同预览

- **WHEN** 用户在同一段 Markdown 中查看行内代码 `code`
- **THEN** 编辑态该 token 的计算背景色、圆角与 `font-family` SHALL 与预览态一致，SHALL NOT 为无样式纯文本

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

#### Scenario: 三类块边框与正文对齐

- **WHEN** 文档同时含围栏代码块、引用块与 mermaid 块，用户进入编辑模式
- **THEN** 三类块的左边界 x 与正文文本块左边界 x 差 SHALL 为 0，三者彼此左边界 x 差 SHALL 为 0

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口；入口按钮的右缘 SHALL 与栏目头右侧操作区的右缘对齐（误差 ≤1px）。大纲入口按钮 SHALL 为 28×28 的方形圆角图形：未钉住态 SHALL NOT 绘制边框（计算 `border-width` 为 0），背景透明；钉住态 SHALL 显示 1px 细边框与强调色系背景。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层未钉住时 SHALL NOT 绘制边框；钉住态 SHALL 绘制 1px 细边框。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块（``` 与 ~~~，含未闭合围栏）内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

**层级标识**：每个大纲项 SHALL 持有层级标识节点（`H{n}` 徽标）；标识默认隐藏，仅鼠标悬入的那一项 SHALL 显示其标识，其余项标识 SHALL 保持隐藏。标识颜色 SHALL 取比次级文字色更浅一档的语义色（`docs/design/system/spec.md` §6），SHALL NOT 与标题文字抢眼。**拖动大纲条目时 SHALL 渲染插入位置指示条**（落点指示条，随指针位置实时移动，松手后消失），SHALL NOT 只渲染 ghost / 占位轨迹；松手后正文顺序 SHALL 按新大纲顺序同步（编辑/预览均生效），SHALL NOT 只改显示顺序而正文不动。点击大纲项 SHALL 把内容区滚动到对应标题：编辑/源码模式按文档行号定位并置于视口顶部，预览模式按标题元素滚到容器顶部。切换页签或编辑模式后，浮层 SHALL 只反映当前页签的标题。

#### Scenario: 大纲按钮与栏目操作区右缘对齐

- **WHEN** 测量大纲入口按钮右缘与栏目头「更多操作」按钮右缘
- **THEN** 两者差值 SHALL ≤1px

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

#### Scenario: 钉住显示细边框

- **WHEN** 用户点击钉住大纲浮层
- **THEN** 浮层边框宽度 SHALL 为 1px

#### Scenario: 每项持有层级标识

- **WHEN** 文档含三个连续的同级二级标题
- **THEN** 每个大纲项 SHALL 各持有一个 `H2` 层级标识节点（共 3 个），SHALL NOT 只在首个项渲染

#### Scenario: 标识仅悬停项可见

- **WHEN** 用户未悬入任何大纲项
- **THEN** 可见的层级标识节点数 SHALL 为 0；鼠标悬入某一项后，仅该项标识 SHALL 可见

#### Scenario: 标识颜色更浅

- **WHEN** 用户查看层级标识
- **THEN** 其计算 `color` SHALL 等于 `docs/design/system/spec.md` §6 中比次级文字色更浅一档的语义色解析值，SHALL NOT 等于标题文字色

#### Scenario: 拖动出现插入位置指示条并同步正文

- **WHEN** 用户拖动一个大纲条目到新的层级位置
- **THEN** 拖动期间 SHALL 出现插入位置指示条并随指针移动；松手后指示条消失，正文顺序 SHALL 与新大纲顺序一致（状态往返可验证）

### Requirement: E-14 浮层定位：最短路径为默认，最优与统一优先

指针触发的浮层（块菜单、二级插入面板、斜杠菜单、大纲浮层、单元格插入菜单、表格边界气泡、容器上下文菜单）SHALL 出现在触发元素近旁：浮层矩形与触发元素矩形之间的最近距离 SHALL 不超过 8px，且 SHALL NOT 覆盖触发元素本身。

**最短路径不是无条件的。** 当它与其他定位目标冲突时，按下述优先级裁决：

1. **不遮挡、不越界**：浮层 SHALL NOT 覆盖触发元素，SHALL NOT 超出可视区；越界时先翻转、再夹取。
2. **同类一律对齐**：属于同一定位组的浮层 SHALL 使用同一对齐边与同一相对偏移。组内任何成员不得为了"更近几像素"而单独偏移——那会让同一入口在不同时刻出现在不同位置。
3. **最短路径**：以上两条都满足后，取最近的位置。

由此，属于「统一定位组」的浮层（例如固定在内容区右上角的工具类入口）允许距离大于 8px，但组内 SHALL 位置一致。这类例外 SHALL 在实现里显式标注，不得靠"碰巧一样"。

该判据以**矩形最近距离**度量，不以中心点距离度量——中心点距离随浮层高度增长，会逼着浮层做小，与「指针不必长途跋涉」的目标相反。

内容输入上下文触发的浮层（单元格/容器菜单）SHALL 以**触发控件的屏幕矩形**为锚（SHALL NOT 以整块 widget 的文档坐标求位置——块级装饰的文档坐标返回块盒，必然错位）；浮层裁剪夹取的基准 SHALL 与实际裁剪祖先一致（`.cm-editor` 矩形与视口交集）。

#### Scenario: 块菜单贴着手柄

- **WHEN** 用户把指针停在块手柄上召唤块菜单
- **THEN** 菜单矩形与手柄矩形的最近距离 SHALL ≤ 8px，且菜单 SHALL NOT 覆盖手柄

#### Scenario: 二级面板贴着父行

- **WHEN** 用户把指针移到「在下方添加」并展开二级面板
- **THEN** 二级面板矩形与该行的最近距离 SHALL ≤ 8px

#### Scenario: 同类浮层位置一致

- **WHEN** 用户在同一个文档里连续两次召唤同一个浮层（例如关闭后再次悬停同一个块手柄）
- **THEN** 两次浮层相对触发元素的偏移 SHALL 完全相同

#### Scenario: 越界时先保证完整可见

- **WHEN** 触发元素贴近视口底部或右侧
- **THEN** 浮层 SHALL 先翻转再夹取，完整落在可视区内；此时允许距离大于 8px

#### Scenario: 上下文菜单以控件矩形定位

- **WHEN** 用户在表格单元格或分栏/高亮块内容区触发插入菜单
- **THEN** 菜单 SHALL 锚定在触发控件的屏幕矩形近旁（最近距离 ≤ 8px），SHALL NOT 出现在表格矩形边缘或容器外

#### Scenario: 上下文菜单完整可见

- **WHEN** 用户在接近视口底部/右侧的单元格或容器内触发插入菜单
- **THEN** 菜单 SHALL 翻转或夹取后完整可见，所有菜单项 SHALL 均可点击

### Requirement: E-15 HTML 编辑闭环

`.html` 文件的预览 SHALL 在隔离的 iframe 中渲染（`srcdoc` + `sandbox`），SHALL NOT 把用户 HTML 直接注入应用主文档。预览中的相对路径资源（样式表、图片）SHALL 解析到**文档所在目录**并可加载。预览/编辑/源码三模式切换 SHALL NOT remount `EditorView`；编辑态的改动 SHALL 在切回预览时可见。

预览态与可视化编辑态 SHALL 使用**各自独立**的内容安全策略：预览态 SHALL NOT 执行脚本；编辑态 SHALL 仅允许本应用注入的运行时执行，用户文件内的脚本仍 SHALL NOT 执行。

#### Scenario: 预览隔离渲染

- **WHEN** 用户打开一个带 `<style>` 与 `<script>` 的 `.html` 文件并切到预览
- **THEN** 内容 SHALL 在 iframe 内渲染，应用自身的样式与脚本 SHALL NOT 受影响

#### Scenario: 相对资源可加载

- **WHEN** HTML 里引用 `./style.css` 或 `img/a.png`，且文件与文档同目录
- **THEN** 预览 SHALL 能加载到这两个资源（src 解析到文档目录，而非应用 origin）

#### Scenario: 编辑后切回预览可见

- **WHEN** 用户在编辑态改动一行内容并切回预览
- **THEN** 预览 SHALL 反映该改动，且文档内容不因切换而丢失

#### Scenario: 两态脚本策略分离

- **WHEN** 用户在预览态与可视化编辑态之间切换
- **THEN** 预览态 SHALL NOT 执行任何脚本；编辑态 SHALL 只执行本应用注入的运行时，用户文件里的 `<script>` SHALL NOT 执行

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

### Requirement: E-17 块手柄召唤区域与滑入菜单

MD 编辑态的块手柄 SHALL 仅在指针位于正文左侧四分之一区域或手柄自身时召唤；指针位于其余区域 SHALL NOT 显示手柄。非空块手柄滑入后 SHALL 自动显示块菜单。空行「+」手柄 SHALL 只在按压时打开插入菜单，指针悬停 SHALL NOT 打开转换菜单。

转换手柄的二级菜单（对齐与缩进、在下方添加行）显示后，指针移出「父菜单 ∪ 二级面板」并集时 SHALL 自动消失；菜单栈打开期间 SHALL 进入全局禁召唤会话，指针在下层文字移动 SHALL NOT 触发新的新增 / 转换手柄，栈关闭后恢复召唤。mermaid 块手柄 SHALL 以块装饰的屏幕矩形为锚，SHALL NOT 停在其边框右上角；「使用图标增强表现」等含图标增强语法的小节 SHALL 能识别出手柄；「伪动画时间轴」展开的转换菜单垂直中心与手柄中心偏差 SHALL ≤2px。图片 / 视频转换手柄 SHALL 显示六点拖拽手柄（含四点），显示位置与标题手柄对齐（同一召唤区与中心线，纵向中心差 ≤2px）。

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

#### Scenario: 二级菜单移出消失

- **WHEN** 用户展开「在下方添加行」二级面板后把指针移出父菜单与二级面板的并集
- **THEN** 二级菜单节点数 SHALL 为 0

#### Scenario: 菜单栈打开期间下层不误触发

- **WHEN** 转换手柄菜单栈打开期间，指针在下层正文文字上移动
- **THEN** 下层文字的新增 / 转换手柄节点数 SHALL 为 0；栈关闭后手柄恢复召唤

#### Scenario: mermaid 手柄不停在右上角

- **WHEN** 用户悬停复现文档「伪动画时间轴（单图显示全流程）」与「颜色编码流程」两处 mermaid 块
- **THEN** 手柄 SHALL 锚定在块装饰屏幕矩形上，SHALL NOT 停在边框右上角

#### Scenario: 图标增强小节识别手柄

- **WHEN** 用户悬停「使用图标增强表现」小节的 mermaid 块
- **THEN** 手柄节点数 SHALL 为 1

#### Scenario: mermaid 菜单与手柄贴合

- **WHEN** 用户展开「伪动画时间轴」的转换菜单
- **THEN** 菜单垂直中心与手柄中心偏差 SHALL ≤2px

#### Scenario: 图片视频手柄六点且对齐

- **WHEN** 用户悬停图片块与视频块的转换手柄
- **THEN** 手柄 SHALL 显示六个拖拽点，其纵向中心与标题手柄纵向中心差 SHALL ≤2px

### Requirement: E-18 正文选区胶囊

阅读态的正文选区 SHALL 显示胶囊工具条，提供复制 / 解释 / 翻译。编辑态的 AI 三动作（改写 / 翻译 / 润色）SHALL 由选区轮盘（见「选区浮动工具条」）承载，编辑态 SHALL NOT 再显示胶囊。胶囊形状 SHALL 与文件类型 chip、活跃页签高亮一致。

#### Scenario: 阅读态选区

- **WHEN** 用户在阅读态选中一段正文
- **THEN** 选区上方 SHALL 显示胶囊工具条（复制 / 解释 / 翻译）

#### Scenario: 编辑态选区

- **WHEN** 用户在 MD 编辑态选中一段正文
- **THEN** SHALL 出现选区轮盘，且 DOM 中 `[data-selection-pill]` 节点数 SHALL 为 0

#### Scenario: 编辑态 AI 三动作

- **WHEN** 用户在 MD 编辑态选中文字并打开轮盘「智能」扇区
- **THEN** SHALL 提供改写 / 翻译 / 润色三项，执行时 SHALL 把选中文本带入 AI 输入框

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮；每个单元 SHALL 只显示图标，SHALL NOT 显示文字标签。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 颜色 与 合并后的「对齐与缩进」入口——缩进（增加 / 减少）与对齐（左 / 中 / 右）SHALL 收在同一个入口的二级菜单内，SHALL NOT 各占一行。「对齐与缩进」行 SHALL 显示图标；二级菜单内的对齐三项 SHALL 各带图标。缩进图标 SHALL 使用语义正确的缩进/反缩进图形。颜色 SHALL 使用共享调色板并在触发行下方展开，指针从行移入面板 SHALL NOT 关闭。菜单项图标 SHALL 为 20px，行高 SHALL 为 36px，菜单宽 SHALL 为 176px；新增手柄菜单与转换手柄菜单 SHALL 共用该宽度常量。新增手柄菜单的「插入 CSS」行 SHALL 渲染 `CssOutlined` 图标，图标边界框宽高 SHALL 大于 0。

新增手柄菜单 SHALL 分为「基础」与「常用」两段：基础段只显示图标（仿转换手柄），顺序为 H1~H3 标题、有序列表、无序列表、任务、引用、分割线、代码块、链接；常用段显示文字，含标题、高亮、分栏、表格、图片、视频或文件、公式、内嵌网页。两段 SHALL 沿用同一菜单宽度 / 行高常量。新增手柄的「分栏」弹窗顶部 SHALL 显示说明文字「选择栏目」，选择时上方 SHALL 实时显示已选栏数。

#### Scenario: 转为网格形态
- **WHEN** 用户打开任意文本块的块菜单
- **THEN** 「转为」区域 SHALL 为 5 列 2 行、共 10 个图标单元，每个单元只显示图标、文本内容为空，当前块型单元处于高亮态（A-8.4）

#### Scenario: 每一行都有图标
- **WHEN** 用户打开块菜单
- **THEN** 菜单中每一行（含「在下方添加」）SHALL 各含一个 `svg[data-icon]`，图标渲染尺寸为 20px（A-8.2）

#### Scenario: 插入 CSS 行有图标
- **WHEN** 用户打开新增手柄菜单
- **THEN** `[data-cmd="insert-css"]` 行 SHALL 含 `svg[data-icon="CssOutlined"]`，其 `getBoundingClientRect().width` SHALL 大于 0

#### Scenario: 对齐与缩进合并在二级菜单
- **WHEN** 用户打开块菜单
- **THEN** 菜单中 SHALL 只有一个「对齐与缩进」入口且该行带图标；展开其二级菜单后 SHALL 含 左对齐 / 居中 / 右对齐 / 减少缩进 / 增加缩进 五项，且对齐三项 SHALL 各带图标

#### Scenario: 表格块菜单有结构动作
- **WHEN** 用户打开表格块的块菜单
- **THEN** 菜单 SHALL 含 复制块、剪切块、删除块 与「在下方添加」；SHALL NOT 出现 标题行 / 标题列 / 均分列宽

#### Scenario: 两级菜单同宽
- **WHEN** 分别测量新增手柄菜单与转换手柄菜单的宽度
- **THEN** 两者的 `offsetWidth` SHALL 相等

#### Scenario: 菜单前两行间距收紧
- **WHEN** 审查块菜单中标题行与无序列表行的垂直间距
- **THEN** 该间距 SHALL 小于菜单其它相邻行的间距

#### Scenario: 缩进图标语义正确
- **WHEN** 审查「对齐与缩进」二级菜单里的增加缩进 / 减少缩进两项
- **THEN** 两项图标 SHALL 为缩进与反缩进语义图形，SHALL NOT 与对齐类图标混淆

#### Scenario: 颜色观感为实色
- **WHEN** 用户展开块菜单的颜色面板
- **THEN** 色板 SHALL 呈现实色观感（字色与底色两组），SHALL NOT 呈现为偏淡的浅色块

#### Scenario: 新增手柄菜单基础段纯图标
- **WHEN** 用户打开新增手柄菜单
- **THEN** 基础段 SHALL 有 8 个单元且只显示图标（文字节点数 0），顺序为 H1 / H2 / H3 / 有序列表 / 无序列表 / 任务 / 引用 / 分割线 / 代码块 / 链接

#### Scenario: 新增手柄菜单常用段带文字
- **WHEN** 用户打开新增手柄菜单
- **THEN** 常用段 SHALL 含 标题 / 高亮 / 分栏 / 表格 / 图片 / 视频或文件 / 公式 / 内嵌网页 8 项且每项显示文字

#### Scenario: 分栏弹窗说明与实时栏数
- **WHEN** 用户在新增加手柄菜单展开「分栏」并把指针滑到第 3 根柱子
- **THEN** 弹窗顶部 SHALL 显示「选择栏目」，上方实时栏数文案 SHALL 为 3

### Requirement: E-12 单元格富文本编辑

表格单元格进入编辑态 SHALL 提供行内 markdown 能力：输入 `/` SHALL 打开锚定插入菜单，SHALL 支持 粗体、斜体、链接、行内代码 的源码写入，并 SHALL 在提交落定后按行内子集渲染（编辑态为原生 `<input>`，显示原始 markdown；渲染发生在落定后的单元格显示态）。提交时 SHALL 保持 GFM 单元格单行约束（不含换行与裸管道符）。Enter SHALL 提交，Tab SHALL 提交并移至右侧单元格，Esc SHALL 取消并还原，失焦 SHALL 提交。

单元格显示态与分栏内容区 SHALL 与正文一致地渲染（标题、列表、粗斜体、代码），SHALL NOT 退化为源码格式。鼠标滑入表格 SHALL 显示表头转换手柄（表格图标 + 六点拖拽），滑入单元格 SHALL 显示单元格转换手柄与单元格新增「+」手柄；单元格转换 / 新增手柄菜单 SHALL 复用全局菜单组件与项集；表格上缘 / 左缘的行列插入热点 SHALL 完整显示，SHALL NOT 只剩孤立灰点。

#### Scenario: 单元格内斜杠菜单

- **WHEN** 用户在单元格编辑态输入 `/`
- **THEN** SHALL 出现锚定插入菜单，选中项插入后单元格仍保持单行

#### Scenario: 单元格内行内格式

- **WHEN** 用户在单元格编辑态输入 `**粗**`
- **THEN** 显示为粗体，源码为 `**粗**`

#### Scenario: 单元格提交/取消

- **WHEN** 用户在编辑态按 Enter / Esc
- **THEN** Enter 提交并落盘，Esc 还原到编辑前的内容

#### Scenario: 单元格内外渲染一致

- **WHEN** 单元格含标题 / 列表 / 粗斜体并进入显示态
- **THEN** 单元格内 SHALL 按正文渲染，可见源码标记数 SHALL 为 0

#### Scenario: 表格与单元格手柄

- **WHEN** 用户滑入表格与任一单元格
- **THEN** 表头转换手柄节点数 SHALL 为 1，单元格转换与新增手柄节点数 SHALL 为 2，二者菜单项集 SHALL 与全局菜单相等

#### Scenario: 行列热点完整

- **WHEN** 用户滑入表格
- **THEN** 上缘与左缘的行列插入热点 SHALL 完整显示，SHALL NOT 只剩孤立灰点

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

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素或文字后提供横向工具条，SHALL NOT 使用选区轮盘。工具条按节点类型分化：

- 文字节点与文字选区 SHALL 显示：AI、字号、字体族、背景色、加粗、斜体、下划线、删除线、链接、对齐、文字颜色、删除；SHALL NOT 显示截图入口。
- 非文字区块 SHALL 显示：AI、背景色、边框色、删除。

HTML 的**源码编辑态**（CM6）SHALL 使用横向文字工具条（`.cm-floating-toolbar`），SHALL NOT 渲染选区轮盘；该横条 SHALL 提供 AI 改写 / 翻译 / 润色与加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接 / 对齐 / 文字颜色 / 清除格式，按钮 SHALL 作用于当前选合并写回源码。

工具条 SHALL 跟随选中元素 / 选区定位且 SHALL NOT 遮挡目标。改动 SHALL 折算回 `content` 并立即可见；保存 SHALL 零残留（无 `data-cm-*`、`cmid`、`contenteditable`、注入脚本/样式）。

#### Scenario: HTML 文字节点显示文字工具条

- **WHEN** 用户在 HTML 可视化编辑态点选一个 `<p>`
- **THEN** 工具条 SHALL 含 AI、字号、字体族、背景色、粗体、斜体、下划线、删除线、链接、对齐、文字颜色、删除，且 SHALL NOT 含截图入口与边框色

#### Scenario: HTML 文字选区显示同一横向条

- **WHEN** 用户在 HTML 可视化编辑态选中一段文字
- **THEN** SHALL 出现横向工具条，轮盘节点数 SHALL 为 0

#### Scenario: HTML 源码编辑态使用横条

- **WHEN** 用户在 `.html` 源码编辑态选中一行文字
- **THEN** SHALL 出现 `.cm-floating-toolbar` 横向条，轮盘 `[data-testid="selection-roulette"]` 节点数 SHALL 为 0

#### Scenario: HTML 源码横条生效于选区

- **WHEN** 用户在 HTML 源码编辑态选中文字并点击加粗
- **THEN** 源码 SHALL 被 `**` 包裹，未选中部分 SHALL 不受影响

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

### Requirement: E-20 HTML 可视化编辑：拖拽移动节点

`.html` 可视化编辑态 SHALL 支持用户按住元素拖到另一个元素的位置，松手后该元素（含其子树）在文档中换到目标元素之前或之后。位移小于阈值（4px）时 SHALL 按点击处理，SHALL NOT 触发移动。

拖拽意图 SHALL 仅在选区折叠时启动：mousedown 后若文档存在非空选区，或用户开始划选（selectionchange 先于位移阈值发生），SHALL 取消拖拽意图。拖拽越过阈值后 SHALL 显示跟随指针的元素幽灵（半透明、不接收指针事件），原元素 SHALL 降透明度；落点指示 SHALL 稳定，指针在目标中线附近移动时 SHALL NOT 来回切换 before / after。落点为目标元素自身或其子孙时 SHALL 拒绝移动并保持文档不变。移动结果 SHALL 折算回 `content`，保存产物 SHALL NOT 残留编辑期属性或锚点。

#### Scenario: 把后一段拖到前一段之前

- **WHEN** 用户按住第二个 `<p>` 拖到第一个 `<p>` 的上半部并松手
- **THEN** 渲染结果里第二段 SHALL 排在前面，`content` 中两段顺序 SHALL 同步调换，且父容器与兄弟结构不受影响

#### Scenario: 拖拽有跟随反馈

- **WHEN** 用户按住一个元素移动超过 4px
- **THEN** SHALL 出现跟随指针的幽灵节点，原元素 SHALL 变半透明

#### Scenario: 划选文字不启动拖拽

- **WHEN** 用户在 HTML 可视化编辑态划选一段文字
- **THEN** ghost 节点数 SHALL 为 0，文档长度 SHALL 不变

#### Scenario: 落点指示稳定

- **WHEN** 用户把指针停在目标元素中线附近小幅移动
- **THEN** 落点 before / after SHALL 保持不抖动

#### Scenario: 微小位移仍算点击

- **WHEN** 用户在元素上按下并只移动 3px 就松手
- **THEN** 文档 SHALL 保持不变，选中状态 SHALL 按点击处理

#### Scenario: 拒绝把自己拖进自己的子树

- **WHEN** 用户把一个容器元素拖到它自己的子元素上松手
- **THEN** `content` SHALL 保持不变，文档结构 SHALL NOT 出现节点丢失

### Requirement: E-21 HTML 可视化编辑：区域截图

`.html` 可视化编辑态 SHALL 提供截图入口：用户进入截图模式后在页面上拖出矩形区域，应用 SHALL 把该区域渲染为 PNG 并保存到用户选择的位置。

截图 SHALL 复用应用的 PNG 栅格化管线（SVG `foreignObject` → canvas）。截图 SHALL 保留文档的内联 `<style>` 与相对路径图片；**外链样式表与 `@import` SHALL NOT 被保证包含**（SVG 作为图片加载时不请求外部资源）。文档 `body` 的关键计算样式（边距、背景、字体）SHALL 反映在截图里。

截图 SHALL NOT 修改文档 `content`；内容为空或区域无效时 SHALL NOT 产出文件。

#### Scenario: 截取一块区域得到 PNG

- **WHEN** 用户在截图模式下框选页面上的一段标题与正文
- **THEN** SHALL 产出 PNG 文件，且文件的像素尺寸与所选区域一致（按 2 倍栅格）

#### Scenario: 截图不污染文档

- **WHEN** 用户截图后保存文档
- **THEN** 写回的文件 SHALL NOT 含截图选框、`data-cm-*` 属性或注入运行时的脚本/样式

#### Scenario: 空区域不产出文件

- **WHEN** 用户拖出的区域宽度或高度为 0
- **THEN** SHALL NOT 写出文件，SHALL 提示区域无效

### Requirement: E-22 HTML 可视化编辑：工具条按节点类型分化

可视化编辑态的工具条 SHALL 按选中节点的类型提供不同的控件集：文字节点/文字选区 SHALL 提供字号、字体族、背景色、粗体、斜体、下划线、删除线、链接、对齐、文字颜色、AI、删除；区块容器 SHALL 提供对齐、背景色、边框色、AI、删除。文字级工具条 SHALL NOT 显示背景色与边框控件；区块工具条 SHALL NOT 显示字号与粗体/斜体/下划线/删除线控件。

对齐 SHALL 以下拉呈现，选项含 左 / 中 / 右 / 两端；选择两端时元素的 `text-align` SHALL 为 `justify`。区块工具条的「边框」SHALL 为颜色选择器，读取并写入当前选中区块元素自身的 `border-color`，SHALL NOT 改动文字颜色；元素无边框时 SHALL 同时写出边框宽度与颜色。

粗体、斜体、下划线、删除线 SHALL 以元素的内联样式表达并可再次点击取消；下划线与删除线 SHALL 能同时存在。删除元素 SHALL 移除该元素及其子树；选中 `html` 或 `body` 时删除 SHALL NOT 生效。

#### Scenario: 连续勾选下划线与删除线互不覆盖

- **WHEN** 用户先点下划线、紧接着点删除线
- **THEN** 该元素的 `text-decoration` SHALL 同时包含 `underline` 与 `line-through`

#### Scenario: 对齐下拉含两端

- **WHEN** 用户选中文字并打开对齐下拉
- **THEN** 选项数 SHALL 为 4；选择两端后计算 `text-align` SHALL 为 `justify`

#### Scenario: 区块边框色写入自身

- **WHEN** 用户点选一个区块并在工具条选择边框色
- **THEN** 该区块元素的 `border-color` SHALL 等于所选颜色，文字颜色 SHALL 不变

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

MD 编辑态的正文选区 SHALL 显示径向轮盘（Selection Roulette），SHALL NOT 渲染横向 `.cm-floating-toolbar`（HTML 源码编辑态除外，见 E-19）。

轮盘 SHALL 为 420×420 的 SVG 扇形盘面，根环 SHALL 有 8 个 45° 扇区（按 12:00 起顺时针：智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色），根环内半径 30px、外半径 86px、扇区间隙 0.35°；每扇区 SHALL 显示 14px 图标与 11px 两字标签，标签中心位于半径 60px。圆心 SHALL 为独立按钮（格式刷 / 返回），半径 31px；圆心 SHALL 使用实色底（accent 24% 与 surface 混合），SHALL NOT 使用带透明度的软色。

轮盘圆心 SHALL 取鼠标落点（键盘选区取选区末端 client rect），整轮包围盒 SHALL 夹进视口安全区。按住鼠标拖选期间轮盘 SHALL NOT 出现；选区稳定 SHALL 至少 90ms 后才出现，SHALL NOT 在 `mouseup` 当场出现；圆心 SHALL NOT 设置死区。

二级选项 SHALL 只在父扇区方向就近展开成等宽扇形：环带 92–122px，每格固定 15°、间隙 0.35°，纯图标 + `title`，项少不摊开。分组项（标题 / 列表 / 高亮）的三层 SHALL 画在二层外环 126–152px，使用同一套 15° 扇形、以被点击二层区块的中心角为中心，SHALL NOT 替换二层；三层出现时二层 SHALL 保留并降到 0.8 不透明度，圆心 SHALL 变为 `‹` 返回。展开下级后根环 SHALL 降到 0.7 不透明度。

颜色扇区 SHALL 展开为双圈窄色条：内圈 90–106px、文字色 9 段（默认 + 8，每段渲染平切于圆的字母 A，默认项加斜杠），外圈 111–127px、背景色 16 段（无 + 15）；SHALL NOT 使用独立色板浮层或色卡。点击色条 SHALL 立即套用且轮盘保持展开。

轮盘 SHALL 提供：行内代码、链接、分栏 1–5（各画栏数图标）、转换二层（代码块 / 表格 / 标题 › / 列表 › / 高亮 › / 引用 / 分割线；光标已在标题时多「正文」）、标题三层 H1–H6、列表三层（无序 / 有序 / 待办）、高亮三层十三类（注释 / 信息 / 摘要 / 待办 / 提示 / 成功 / 问题 / 警告 / 失败 / 危险 / Bug / 示例 / 引用，分别落 `> [!note]` / `[!info]` / `[!abstract]` / `[!todo]` / `[!tip]` / `[!success]` / `[!question]` / `[!warning]` / `[!failure]` / `[!danger]` / `[!bug]` / `[!example]` / `[!quote]`）、复制、文字色与背景色、缩进 / 减少缩进、清除格式、后退 / 前进、格式刷、删除。格式二层顺序 SHALL 为：链接 / 下划线 / 斜体 / 加粗 / 行内代码 / 删除线。对齐二层 SHALL 为左 / 中 / 右 / 增加缩进 / 减少缩进五项。

格式类动作执行后 SHALL 保持展开；破坏性 / 历史 / 插入类执行后 SHALL 收起。滚轮或方向键 SHALL 在当前层移动高亮，`Enter` 执行；`Ctrl+F` / `⌘F` SHALL 打开独立筛选面板（输入框 SHALL NOT 在输入过程中重建）；数字键 `1–8` SHALL 直达对应扇区；`Esc` SHALL 逐层后退（筛选 → 三层 → 二层 → 关闭）；指针离开整只轮盘 400ms 后 SHALL 收回下级。

格式刷 SHALL 读取当前选区的行内包装，之后每次新选区自动套用（幂等）并显示已刷次数；刷完 SHALL 仍展开轮盘；`Esc` 或再点圆心退出。清除格式 SHALL 只解包与选区相交的节点并保留链接，一次提交可撤销。后退 / 前进 SHALL 映射 CodeMirror 的 undo / redo，与 `Mod-z` / `Mod-Shift-z` 共用同一份历史。轮盘 SHALL 为 `role="menu"`，每扇区 `role="menuitem"` 且 `aria-label` 为中文名。

#### Scenario: 编辑态出现轮盘而非横条

- **WHEN** 用户在 markdown 编辑态选中一段文字并保持 120ms
- **THEN** SHALL 出现径向轮盘，8 个扇区可见，页面中 `.cm-floating-toolbar` 节点数 SHALL 为 0

#### Scenario: 拖选期间不出现

- **WHEN** 用户按住鼠标在正文上拖选且尚未松开
- **THEN** 轮盘节点数 SHALL 为 0；松开 90ms 后 SHALL 在鼠标落点出现

#### Scenario: 圆心与越界夹取

- **WHEN** 用户用鼠标选中靠近窗口右下角的文字
- **THEN** 轮盘圆心 SHALL 与鼠标落点偏差 ≤1px（未被夹取时），整体包围盒 SHALL 完整落在视口内

#### Scenario: 点击展开而非悬停

- **WHEN** 用户把指针停在「格式」扇区上但不点击
- **THEN** 二层 SHALL NOT 展开；点击后 SHALL 展开 6 项扇形且总跨度不超过 90°

#### Scenario: 三层画在二层外环

- **WHEN** 用户在「转换」中点击「标题 ›」
- **THEN** H1–H6 SHALL 出现在 126–152px 外环，二层 SHALL 仍可见并降到 0.8 不透明度，圆心 SHALL 显示 `‹`

#### Scenario: 颜色双圈

- **WHEN** 用户点击「颜色」扇区
- **THEN** 内圈 SHALL 有 9 个字母 A 色段，外圈 SHALL 有 16 个背景色段，两者同时可见且无浮层色板

#### Scenario: 标注类型齐备

- **WHEN** 用户在「转换」中展开「高亮」与「标题」
- **THEN** 高亮三层 SHALL 有注释 / 信息 / 摘要 / 待办 / 提示 / 成功 / 问题 / 警告 / 失败 / 危险 / Bug / 示例 / 引用 13 项，标题三层 SHALL 有一级至六级 6 项

#### Scenario: 分栏与高亮写入源码

- **WHEN** 用户选择「分栏 3」并随后选择「注释」高亮
- **THEN** 文档源码 SHALL 含 `::: {.col-3}` 与 `> [!note]`

#### Scenario: 格式刷跨选区幂等

- **WHEN** 用户在加粗选区点击圆心，再选中另一段并重复选中同一段
- **THEN** 两段 SHALL 都被加粗，已刷次数 SHALL 为 2，重复套用 SHALL NOT 叠加标记

#### Scenario: 清除格式保留链接

- **WHEN** 用户对含 `**粗**` 与 `[链接](url)` 的选区执行清除格式
- **THEN** 源码中 `**` 与 `mdb-color-` SHALL 消失，`[链接](url)` SHALL 保留

#### Scenario: 后退与快捷键共用历史

- **WHEN** 用户在轮盘点「后退」后按 `Mod-Shift-z`
- **THEN** 文档 SHALL 重做同一次改动（两者共用同一份历史）

#### Scenario: 筛选面板不打断输入

- **WHEN** 用户按 `Ctrl+F` 后在筛选框连续输入关键词
- **THEN** 输入框 SHALL 保持同一个 DOM 节点与焦点，结果行随输入更新，候选可回车执行

#### Scenario: 就近扇形不绕整圈

- **WHEN** 用户点击「格式」扇区
- **THEN** 展开的 6 项扇形 SHALL 紧排在一侧，覆盖跨度 SHALL 为 90°，SHALL NOT 绕满整圈

#### Scenario: 三级原位替换

- **WHEN** 用户在「转换」中点击「标题 ›」
- **THEN** 三层 SHALL 画在 126–152px 外环并保留二层（0.8），圆心 SHALL 显示返回；按返回后 SHALL 回到二层

#### Scenario: 选中文字出现工具条

- **WHEN** 用户在 MD 编辑态选中一段文字
- **THEN** SHALL 出现径向轮盘（不是横向 12 项工具条），含 8 个根扇区与圆心

#### Scenario: 图标按钮生效于选区

- **WHEN** 用户选中文字并点击「格式」里的加粗
- **THEN** 选区文字 SHALL 被 `**…**` 包裹，未选中部分 SHALL 不受影响

#### Scenario: 未选中调整整块

- **WHEN** 光标在区块内且未选中文字，用户点击「对齐」里的居中
- **THEN** 该区块 SHALL 整体应用居中对齐

### Requirement: 块对齐

MD 编辑态 SHALL 支持块级对齐：左/中/右（至少），并 SHALL 复用与块颜色一致的作者语法（如 Pandoc fenced div 风格 `::: {.align-center}`），SHALL NOT 仅在 UI 显示而不改变文档。对齐 SHALL 作用于整块。编辑态 SHALL 隐藏对齐围栏标记，源码态 SHALL 保留；预览态 SHALL 仍按对齐渲染。

#### Scenario: 应用居中对齐

- **WHEN** 用户对某段落应用居中对齐
- **THEN** 文档源码 SHALL 出现对应的对齐标记，预览态该段落 SHALL 居中

#### Scenario: 取消对齐

- **WHEN** 用户对已居中段落再次应用居中
- **THEN** 对齐标记 SHALL 被移除，段落回到默认对齐

#### Scenario: 居中对齐后编辑态不露标记
- **WHEN** 用户对段落应用居中
- **THEN** 编辑态可见文本不含 `:::`；源码态仍含 `:::`；取消后编辑态无残留（A-5.1–A-5.2）

### Requirement: 编辑器工具条按 workbuddy 收敛

编辑器工具条的控件集合 SHALL 按 workbuddy 对齐收敛，制造工具条 SHALL NOT 保留 workbuddy 之外的冗余控件。

#### Scenario: 无多余控件

- **WHEN** 审查 MD 块工具条与文字工具条
- **THEN** 二者控件集合 SHALL 分别为「AI 编辑/背景色/边框色/删除」与「AI 编辑/字号/加粗/斜体/下划线/删除线/链接/对齐/文字颜色/删除」，SHALL NOT 出现清单外的控件

### Requirement: 颜色面板二级保持

块菜单的颜色入口展开二级调色板后，指针离开父项 SHALL NOT 使调色板消失；调色板 SHALL 仅在选择颜色、按 Esc 或点击菜单外部时关闭。颜色菜单 SHALL 在背景色下方提供「恢复默认」项，点击后 SHALL 清除字色 / 背景色标记（`mdb-color-*` 与背景标记），该项 SHALL 与既有色板项同宽并取设计系统语义色。

#### Scenario: 指针移出父项后调色板仍在

- **WHEN** 用户展开颜色二级调色板后把指针移出该父项
- **THEN** 调色板 SHALL 仍然可见

#### Scenario: 点击外部关闭

- **WHEN** 调色板展开时用户点击菜单外部
- **THEN** 调色板 SHALL 关闭

#### Scenario: 恢复默认清除颜色

- **WHEN** 用户对已套字色 / 背景色的块打开颜色菜单并点击「恢复默认」
- **THEN** 源码中 `mdb-color-*` 与背景标记节点数 SHALL 为 0

### Requirement: 编辑态工具条归属

Markdown 编辑态与 HTML 可视化编辑态 SHALL 各自使用各自的选区工具条，SHALL NOT 混用。Markdown 编辑态选中文本后呈现的工具条 SHALL 为 md-bundle 的按钮集合（改写 / 翻译 / 润色 + 格式组），图标 SHALL 取自本仓 `icons.ts`。HTML 可视化编辑态的格式条与改写条 SHALL 只在 HTML 编辑态出现。

#### Scenario: md 编辑态不出现 html 工具条

- **WHEN** 用户在 Markdown 编辑态选中一段文本
- **THEN** 出现的工具条 SHALL NOT 含 HTML 可视化编辑专属按钮

#### Scenario: md 工具条集合与 md-bundle 一致

- **WHEN** 用户在 Markdown 编辑态选中文本
- **THEN** 工具条按钮集合 SHALL 等于 md-bundle 的集合（改写 / 翻译 / 润色 + 格式组）

### Requirement: 撤销与重做快捷键

撤销 / 重做 SHALL 同时响应 `Mod`（macOS 上为 Command）与 `Control` 两套修饰键：撤销接受 `Mod-Z` 与 `Ctrl-Z`，重做接受 `Mod-Shift-Z`、`Ctrl-Shift-Z` 与 `Ctrl-Y`。Markdown 编辑与 HTML 可视化编辑 SHALL 使用同一映射。

#### Scenario: Ctrl 撤销生效

- **WHEN** 用户在编辑态按 `Control+Z`
- **THEN** 内容 SHALL 回退一步，行为与 `Command+Z` 相同

#### Scenario: Ctrl 重做生效

- **WHEN** 用户按下 `Control+Shift+Z` 或 `Control+Y`
- **THEN** 内容 SHALL 前进一步

#### Scenario: 颜色观感为实色

- **WHEN** 用户展开块菜单的颜色面板
- **THEN** 色板 SHALL 呈现实色观感（字色与底色两组），SHALL NOT 呈现为偏淡的浅色块

### Requirement: E-23 HTML 可视化编辑：选中块尺寸拖拽

HTML 可视化编辑态在选中一个区块元素后 SHALL 提供尺寸手柄：至少包含右缘、下缘、右下角三个可拖拽手柄；拖动 SHALL 修改该元素的 `width` / `height`（内联样式，单位 px，最小 24px），改动 SHALL 折算回文档 `content` 并立即在渲染结果中可见。位移小于 4px 时 SHALL 按点击处理，SHALL NOT 触发尺寸修改。处于文本编辑态（双击进入）时 SHALL NOT 显示尺寸手柄。

#### Scenario: 拖动右下角调整宽高

- **WHEN** 用户在 HTML 可视化编辑态选中一个 `<div>` 并拖动右下角手柄
- **THEN** 该元素的渲染宽高 SHALL 改变，文档 `content` 中该元素的内联 `style` SHALL 含 `width:` 与 `height:`

### Requirement: 第十一批走查修正（菜单与折叠）

块菜单的颜色与缩进二级面板 SHALL 在触发行右侧展开；越界时 SHALL 翻转到左侧并保持完整可见。块菜单「对齐与缩进」入口 SHALL 显示图标，其子项 SHALL 保留图标。斜杠菜单「插入 CSS」入口 SHALL 显示图标。

MD 编辑态标题折叠三角与标题可见文字之间的水平距离 SHALL 不超过 2px。

#### Scenario: 二级面板向右展开

- **WHEN** 用户打开块菜单并展开「颜色」或「对齐与缩进」
- **THEN** 二级面板左缘 SHALL 位于父行右缘右侧，SHALL NOT 覆盖父菜单

#### Scenario: 图标齐全

- **WHEN** 用户打开块菜单与斜杠菜单
- **THEN** 「对齐与缩进」入口与「插入 CSS」入口 SHALL 各含一个 `svg[data-icon]`

#### Scenario: 折叠三角贴近标题

- **WHEN** 指针进入左侧召唤区并显示某标题的折叠三角
- **THEN** 三角右缘与标题文字左缘的距离 SHALL ≤2px

### Requirement: E-21 行内字色与背景色叠加

MD 编辑态的行内文字色（`mdb-color-*`）与背景色（`mdb-bg-*`）SHALL 可同时作用于同一段文字，允许源码中出现任意层嵌套的 `<span class="mdb-*">`。编辑态装饰层 SHALL 对每个 `mdb-*` span 独立地隐藏开闭标签并按族着色/铺底，嵌套时内外层样式 SHALL 同时生效；编辑区 SHALL NOT 将任何 `<span` 标签作为正文文本显示。

「清除格式」SHALL 移除与选区相交的所有 `mdb-color-*` / `mdb-bg-*` / `mdb-border-*` 包装，即使选中范围只覆盖文字、标签位于选区之外；链接语法 SHALL 保留；整次清除 SHALL 为一次可撤销的编辑。

#### Scenario: 字色与背景色同时生效

- **WHEN** 用户在 MD 编辑态选中一段文字，先设字体色为绿、再设背景色为紫
- **THEN** 该选区文字的计算 `color` SHALL 为绿色值，计算 `background-color` SHALL 为紫色值
- **AND** 编辑区 SHALL NOT 出现 `<span` 形式的源码文本

#### Scenario: 清除格式作用于已设背景

- **WHEN** 文字已套用字色与背景色，用户保持该选区（或在其中选中部分文字）并点「清除格式」
- **THEN** 源码 SHALL 不再包含 `mdb-color-` 与 `mdb-bg-` 包装
- **AND** 选区文字 SHALL 恢复默认样式

#### Scenario: 清除格式保留链接

- **WHEN** 选区同时包含加粗、字色与一个 `[文字](url)` 链接，用户执行清除格式
- **THEN** `**` 与 `mdb-color-` SHALL 消失，`[文字](url)` SHALL 保留

### Requirement: E-22 编辑态悬停提示胶囊化

界面中一切自绘悬停提示 SHALL 为胶囊形（圆角半径 ≥ 提示高度的一半）；SHALL NOT 使用系统原生的矩形 `title` 提示。编辑态的选区轮盘 SHALL 在每个扇区（根扇区、二级单元、色条）被悬停时显示其中文名称提示。同一类**胶囊**提示（按钮提示、轮盘扇区提示）SHALL 共用同一胶囊外壳常量，SHALL NOT 出现矩形外壳。页签名信息窗 SHALL 为矩形圆角 8px 卡片（设计系统 §5 浮层档），是本条的**唯一豁免**；SHALL NOT 因本条把它改回胶囊。

提示胶囊 SHALL 带指向触发元素的箭头尾，箭头朝向按弹出方位取值（提示在触发元素上方时朝下、下方时朝上、左侧时朝右、右侧时朝左），SHALL 指向其描述的触发元素。提示内容 SHALL 按按钮形态区分：同时显示图标与文字的按钮，其提示 SHALL 只显示快捷键、SHALL NOT 重复按钮名称；纯图标按钮的提示 SHALL 显示图标名称与快捷键（如「下划线 (⌘ + U)」），并 SHALL 给出该动作的 markdown 用法提示（如 `Markdown: ~文本~ 空格`）。刻意以文字解释图标动作的按钮 SHALL 保留名称。

#### Scenario: 按钮提示为胶囊

- **WHEN** 用户把指针停在任一功能按钮上 600ms
- **THEN** SHALL 出现提示元素，其计算 `border-radius` SHALL ≥ 提示高度的一半
- **AND** 页面 SHALL NOT 弹出系统原生矩形提示

#### Scenario: 轮盘扇区显示提示

- **WHEN** 用户在 MD 编辑态唤出选区轮盘并把指针停在「转换」扇区上
- **THEN** SHALL 出现文案为「转换」的胶囊提示

#### Scenario: 同类提示外壳一致

> 场景标题沿用旧名；自本 change 起「同类」指胶囊提示（按钮 / 轮盘），页签名信息窗为显式豁免。

- **WHEN** 分别悬停功能按钮、轮盘扇区与页签名
- **THEN** 按钮提示与轮盘提示外壳 SHALL 为胶囊且共享同一常量，计算 `border-radius` 均 ≥ 各自高度的一半；页签名信息窗外壳 SHALL 为 8px 圆角矩形；SHALL NOT 出现未圆角的直角外壳

#### Scenario: 提示气泡箭头指向触发元素

- **WHEN** 用户把指针停在任一功能按钮上并唤出提示
- **THEN** 提示气泡 SHALL 含箭头尾，箭头朝向该按钮（按弹出方位）

#### Scenario: 图标+文字按钮提示仅快捷键

- **WHEN** 用户悬停同时显示图标与文字的菜单项「复制」
- **THEN** 提示文本 SHALL 为 `⌘ + C`，SHALL NOT 含名称「复制」

#### Scenario: 纯图标按钮提示名称与快捷键

- **WHEN** 用户悬停纯图标按钮「下划线」
- **THEN** 提示文本 SHALL 为 `下划线 (⌘ + U)`，并 SHALL 含 markdown 用法提示 `Markdown: ~文本~ 空格`

### Requirement: 编辑态装饰在视图重建后仍然生效

系统 SHALL 在 EditorView 因分栏、整屏、移动或布局恢复而重建后，继续以富文本渲染 Markdown 编辑态；不得退化为源码显示。

#### Scenario: 分栏后原格仍为富文本

- **WHEN** 用户以编辑态打开 Markdown 文档并执行右分栏
- **THEN** 原格 `data-mode` 仍为 `edit`，标题与高亮块装饰可见，正文不出现 `**`/`##` 源码标记（A-1.1–A-1.4）

### Requirement: 选区轮盘三级联动

系统 SHALL 在轮盘三层展开时把轮盘本体降到 25% 不透明度，默认高亮一个三层选项，并让三层高亮随指针沿二层同向移动；提示信息只保留圆心的操作说明。

#### Scenario: 三层展开与指针联动

- **WHEN** 用户展开任一二层分组并沿二层扇区移动指针
- **THEN** 根与二层 opacity 为 0.25，三层恰有一个 `.hot` 且其索引随指针方向单调移动；悬停扇区不出现胶囊提示，悬停圆心出现格式刷说明（A-2.1–A-2.6）

### Requirement: 格式刷与胶囊选区工具条

系统 SHALL 让格式刷同时应用行内样式与字色/背景色；并提供可切换的胶囊选区工具条（两行按钮，常用动作贴近指针）。

#### Scenario: 格式刷与胶囊模式

- **WHEN** 用户用格式刷把一段的加粗与字色刷到另一段，且在设置中切到胶囊模式后选中文字
- **THEN** 目标段同时含 `**` 与 `mdb-color-*`，圆心计数为 2；胶囊可见且为两行、轮盘不出现（A-3.1–A-3.6）

### Requirement: 高亮块图标随类型切换

系统 SHALL 让会话内的 emoji 覆盖只在原高亮类型下生效；转换为其他类型后显示新类型默认图标。图标与标题之间不得留出空白间隔（间距不超过 2px），无标题卡片头部 SHALL NOT 出现空白槽。高亮块的块手柄 SHALL 显示高亮图标。

#### Scenario: 图标跟随类型与间距
- **WHEN** 用户修改 NOTE 高亮块图标后将其转换为 TIP，或把指针移到高亮块左侧召唤区
- **THEN** 卡片显示 TIP 默认图标 💡，图标右缘与标题左缘间距不超过 2px，块手柄为 `CalloutOutlined`（A-9.1–A-9.2、A-1.2）

#### Scenario: 相邻同类型互不串图标
- **WHEN** 文档中有两个相邻的 `> [!NOTE]` 高亮块，用户只修改第一个的图标
- **THEN** 第二个卡片仍显示 NOTE 默认图标

### Requirement: 撤销/重做快捷键不依赖编辑器聚焦

系统 SHALL 在编辑态下让 ⌘Z / ⌘⇧Z（Ctrl 同）无需先点击正文即可撤销/重做当前聚焦格的活动编辑器。

#### Scenario: 焦点在栏目头时撤销

- **WHEN** 用户输入文字后点击栏目头再按 ⌘Z
- **THEN** 内容撤销一步；按 ⌘⇧Z 恢复（A-5.1–A-5.2）

### Requirement: 弹窗打开期间不显示悬停提示

系统 SHALL 在任一菜单或弹层打开期间抑制悬停胶囊提示，关闭后恢复。

#### Scenario: 右键菜单打开时悬停栏目头

- **WHEN** 用户打开页签右键菜单并把指针移到栏目头按钮停留 600ms
- **THEN** 不出现 `.app-tip`；关闭菜单后再悬停则出现（A-7.3）

### Requirement: 轮盘动作经命令注册表执行

系统 SHALL 让轮盘动作以注册的命令标识执行，而不是仅依赖渲染时捕获的闭包；未注册且无内联执行的条目不得渲染为可点击项，也不得出现在筛选结果中。

#### Scenario: 点击加粗与未注册条目

- **WHEN** 用户在编辑态选中文字并点击轮盘「加粗」，且某条目仅声明了未注册的 `commandId`
- **THEN** 源码出现 `**`，`hasCommand("bold")` 为真；未注册条目不可点击且筛选中出现次数为 0（A-1.1–A-1.3）

### Requirement: 轮盘根扇区由配置驱动

系统 SHALL 按 `user/settings.json` 的 `rouletteSectors` 决定根扇区的集合与顺序；字段缺省或为 `null` 时使用内置 8 项默认顺序；未知标识被忽略，重复项去重，空数组拒绝写入。

#### Scenario: 删除、重排与坏输入

- **WHEN** 用户把 `rouletteSectors` 改为不含 `columns` 的数组并重载，或改为含未知标识的数组，或提交空数组
- **THEN** 轮盘分别渲染 7 个根扇区且无 `columns`、回落为默认 8 项、保存被拒且磁盘内容不变（A-2.1–A-2.4）

### Requirement: 设置面可编辑轮盘扇区并恢复默认

系统 SHALL 在设置·编辑器提供轮盘扇区的勾选与排序，改动即时生效并持久化；「恢复默认」写回空值以继承未来默认顺序。

#### Scenario: 取消勾选、重启与恢复默认

- **WHEN** 用户在设置中取消勾选「分栏」、上移一项、重启应用，随后点击「恢复默认」
- **THEN** 轮盘依次为 7 扇区、顺序变化、重启后仍为 7 扇区、恢复后为默认 8 项（A-3.1–A-3.4）

### Requirement: 横向工具条按钮集合与顺序由配置驱动

系统 SHALL 按 `user/settings.json` 的 `htmlToolbarItems` 决定横向工具条动作按钮的集合与顺序；字段缺省或为 `null` 时使用 12 项默认顺序；未知标识忽略、重复去重、空数组拒绝写入；颜色下拉与「清除格式」为固定控件，不参与槽位配置。

#### Scenario: 删除、重排与坏输入

- **WHEN** 用户把 `htmlToolbarItems` 改为不含 `format-bold` 的数组并重新选中文字，或把 `format-italic` 排到首位，或提交空数组
- **THEN** 工具条分别渲染 12 个动作且无 `format-bold`、首个动作为 `format-italic`、保存被拒且磁盘内容不变（A-1.1–A-1.4）

### Requirement: 设置面可编辑工具条槽位并恢复默认

系统 SHALL 在设置·编辑器提供文字工具条槽位的勾选与排序，改动即时生效并持久化；「恢复默认」写回空值以继承未来默认顺序。

#### Scenario: 取消勾选、重启与恢复默认

- **WHEN** 用户在设置中取消勾选「粗体」、上移一项、重启应用，随后点击「恢复默认」
- **THEN** 工具条依次为 12 个动作、顺序变化、重启后仍为 12 个动作、恢复后为默认 13 个可点控件（A-2.1–A-2.4）

### Requirement: 轮盘展开透明度与高亮块图标回归

系统 SHALL 在轮盘三层展开时把本体透明度设为 90%；高亮块的自定义图标只在该类型下生效，转换为其他类型后显示新类型默认图标。

#### Scenario: 三层展开与图标跟随

- **WHEN** 用户展开任一二层分组，或把 NOTE 高亮块图标改掉后转换为 TIP
- **THEN** 根/二层计算 opacity 为 0.9；TIP 卡片显示 TIP 默认图标；关闭轮盘后无残留节点（A-1.1–A-1.3）

### Requirement: 胶囊为圆角矩形并承载轮盘全部功能

系统 SHALL 把编辑态选区胶囊渲染为单层圆角矩形（圆角不超过 12px），其动作项覆盖轮盘全部可执行动作，高频动作位于首屏。

#### Scenario: 胶囊形态与功能覆盖

- **WHEN** 用户在设置选择胶囊形态并选中文字
- **THEN** 胶囊为单行圆角矩形，动作项数与轮盘可执行项数一致，高频三项可见（A-7.1–A-7.2）

### Requirement: 转换菜单图标、二级菜单隐藏与列表转换

系统 SHALL 为转换菜单的插入 CSS、缩进与对齐及其子功能提供图标，图标名 SHALL 与斜杠菜单同源（插入 CSS 为 `CssOutlined`）。二级菜单 SHALL 在指针滑出后卸载，同一时刻 SHALL 最多只有一个二级面板存在；菜单或页面滚动 SHALL 关闭二级面板。任务项转换 SHALL 落为任务列表而非高亮；同级多块列表转换 SHALL 整体转换，有序列表 SHALL 自动编号。

#### Scenario: 菜单图标、隐藏与列表转换
- **WHEN** 用户打开转换手柄菜单、悬停展开一个二级面板后把指针滑出，或把三块同级无序列表转为有序列表
- **THEN** 插入 CSS 行图标为 `CssOutlined`、子项图标齐全、二级菜单节点数为 0、任务项源码为 `- [ ]`、有序编号为 1/2/3（A-8.1–A-8.3）

### Requirement: E-24 图片块编辑

MD 编辑态的图片 SHALL 在被点击后进入选中态：显示选中框与四角圆点，并在图片上方居中显示工具条，按钮顺序 SHALL 为「AI / 裁剪 / 评论 ｜ 左对齐 / 居中对齐 / 右对齐 ｜ 剪切 / 复制 / 删除」。图片 SHALL 以圆角呈现，圆角取设计系统卡片级数值。双击图片 SHALL 进入最大化查看，Esc、再次双击或点击遮罩 SHALL 退出且不改动文档。

图片 SHALL 默认居中；仅当用户显式选择左对齐或右对齐时才写出对齐标记，选回居中 SHALL 移除该标记。编辑态的尺寸与对齐 SHALL 以图片属性语法随图片一起保存，SHALL NOT 使用 HTML 注释，SHALL NOT 把标记写入图片路径。宽度与高度 SHALL 支持左右边、上下边与四角拖拽调整，范围为 40–2000px。

图片 SHALL 支持从剪贴板粘贴插入：图片字节写入文档同级 `assets/` 后插入引用，单张超过 20MB SHALL 拒绝并提示。裁剪 SHALL 为无损显示裁剪：只保存裁剪矩形并裁切显示，SHALL NOT 改写图片文件或图片引用，SHALL 支持反复调整与恢复整图。图片下方 SHALL 提供描述行：无描述时显示占位「输入图片描述」，输入提交后写入图片 title，再次点击描述行 SHALL 收起显示。

工具条 9 个按钮 SHALL 各渲染可绘制图标；插入的图片 SHALL 完成 src 加载（`naturalWidth` 大于 0）；剪切按钮 SHALL 使用通用剪切图形，其 path SHALL 与裁剪按钮不同。

#### Scenario: 点击图片出现选中态与工具条
- **WHEN** 用户点击编辑态的一张图片
- **THEN** 该图片进入选中态、四角显示圆点，工具条在图片上方居中出现且按钮数为 9（A-3.1–A-3.4），每个按钮各含一个图标

#### Scenario: 默认居中与显式对齐
- **WHEN** 用户插入或粘贴一张独占一行的图片，随后选择左对齐
- **THEN** 图片默认水平居中；选择左对齐后源码写出对齐标记且预览靠左；选回居中后标记移除（A-2.1、A-5.1）

#### Scenario: 四边与四角改尺寸
- **WHEN** 用户拖拽图片的右边或右下角
- **THEN** 图片宽度（及高度）随之变化，松手后源码写入属性且不出现 HTML 注释；一次撤销即恢复（A-4.1–A-4.3）

#### Scenario: 括号路径不被写坏
- **WHEN** 图片路径含空格或括号（如 `assets/image (1).png`）且用户拖拽改尺寸
- **THEN** 图片路径保持完整，标记不得插入路径内部（A-2.2）

#### Scenario: 裁剪与描述
- **WHEN** 用户点击工具条裁剪并确认，或点击描述行输入「雾山」
- **THEN** 图片引用保持不变、可见尺寸变为裁剪后大小、源码写入裁剪矩形；再次打开裁剪框还原为上次矩形；描述行显示「雾山」并在再次点击后收起（A-6.1–A-6.3、A-7.1–A-7.3）

#### Scenario: 插入图片可见
- **WHEN** 用户插入一张图片
- **THEN** 编辑态 `img` 的 `naturalWidth` SHALL 大于 0

#### Scenario: 剪切与裁剪图标不同
- **WHEN** 用户打开图片工具条
- **THEN** 剪切按钮图标 path SHALL 与裁剪按钮图标 path 不同

#### Scenario: 双击最大化
- **WHEN** 用户双击图片后按 Esc
- **THEN** 出现遮罩并在 Esc 后消失，文档内容不变（A-3.6）

### Requirement: 块手柄图标跟随块型

系统 SHALL 按块的真实类型选择块手柄图标：独占一行的图片 SHALL 显示图片图标，高亮块 SHALL 显示高亮图标，SHALL NOT 分别退化为段落图标或引用图标。图片块菜单 SHALL NOT 显示与其无关的「转为」网格，结构动作 SHALL 保留。

#### Scenario: 图片与高亮块的手柄图标
- **WHEN** 用户把指针移到图片块或高亮块的左侧召唤区
- **THEN** 两块手柄图标分别为 `ImageOutlined` 与 `CalloutOutlined`；图片块菜单含结构动作且无「转为」网格（A-1.1–A-1.3）

### Requirement: 轮盘召唤与动作搜索

编辑态 SHALL NOT 在选中文字时自动弹出轮盘；轮盘 SHALL 只由显式入口（开关快捷键 / 圆心等）召唤。轮盘 SHALL 提供动作搜索：按一/二级动作名称过滤，只展示匹配动作及其可执行子动作，SHALL NOT 展示层级名称、SHALL NOT 重复；结果最多 9 行，超出 SHALL 可滚动，首行 SHALL 默认选中。每行右侧 SHALL 显示快捷键（首行回车，其后 cmd/ctrl+2~9），滚动时快捷键列 SHALL NOT 跟着横向移动。

#### Scenario: 搜索与快捷键列
- **WHEN** 用户选中文字，或打开轮盘搜索并输入「一级」
- **THEN** 选中文字后轮盘节点数为 0；搜索结果行数 ≤9、首行选中、无层级名；滚动后快捷键列横向坐标不变（A-2.1、A-3.1–A-3.5）

### Requirement: 音视频静音与音频收尾

音视频的静音状态 SHALL 按文件（页签）独立控制，SHALL NOT 共用全局状态。音频静音 SHALL 立即暂停并静音，SHALL NOT 保留可听见的声音残留；播放列表 SHALL 自动识别文档同级目录下的音频文件。

#### Scenario: 独立静音与收尾
- **WHEN** 文档含两个音视频页签，用户静音第一个
- **THEN** 第二个 muted 仍为 false；第一个在 100ms 时已不处于播放态、无声音残留；同目录 3 个音频时列表项数为 3（A-6.1–A-7.2）

### Requirement: 轮盘历史与颜色二级

轮盘历史分组 SHALL 在复制与前进之间提供剪切。颜色二级面板的透明项 SHALL 以棋盘格或描边呈现，字色/底色标签 SHALL 保持可读。

#### Scenario: 剪切位置与透明项
- **WHEN** 用户打开轮盘历史分组与颜色二级面板
- **THEN** 剪切按钮索引为 2；透明项有棋盘格或描边；关闭后无残留节点（A-10.1–A-10.2）

### Requirement: E-23 块宽度统一

预览态引用块的文字列宽度 SHALL 与正文段落相同。编辑态引用块与围栏代码块的边框盒（border box）宽度 SHALL 与普通正文行的行盒相同，且三者左右边界 SHALL 与正文文本块对齐；因内边距与边框，其文字列宽度相应收窄，SHALL NOT 要求与正文文字列等宽。宽度补偿 SHALL 通过调整块自身最大宽度实现，SHALL NOT 改动 `.cm-line` 的基础 1080px 行宽。

#### Scenario: 预览引用块与段落等宽

- **WHEN** 用户打开一份含引用块与段落的文档并进入预览态
- **THEN** 引用块文字列的宽度与相邻段落文字列宽度差 SHALL 为 0px

#### Scenario: 编辑态引用块与正文等宽

- **WHEN** 用户在同一文档进入编辑态
- **THEN** `.cm-line.cm-quote` 的边框盒左右边界 x 与普通 `.cm-line` 边框盒左右边界 x 差 SHALL 为 0px

#### Scenario: 编辑态代码块与正文等宽

- **WHEN** 文档含围栏代码块且光标不在块内
- **THEN** `.cm-line.cm-fenced-code` 的边框盒左右边界 x 与普通 `.cm-line` 边框盒左右边界 x 差 SHALL 为 0px

### Requirement: E-24 编辑态公式与代码高亮

编辑态 SHALL 显示行内公式与块级公式的排版结果，光标进入公式块时 SHALL 显示源码。编辑态围栏代码块 SHALL 按围栏语言做语法高亮，SHALL 复用预览态的语言别名表。

#### Scenario: 非活跃公式出排版

- **WHEN** 用户打开含 `$E=mc^2$` 与 `$$\\int_0^1 x dx$$` 的文档且光标不在公式内
- **THEN** 编辑态 `.katex` 节点数 SHALL 为 2

#### Scenario: 进入公式块显示源码

- **WHEN** 用户把光标移入块级公式
- **THEN** 该块 SHALL 显示 `$$` 源码，其它公式 SHALL 仍为排版态

#### Scenario: 围栏代码有 token

- **WHEN** 文档含 ` ```js ` 围栏且光标在块外
- **THEN** 围栏内 `.tok-keyword` 节点数 SHALL 大于 0

### Requirement: E-25 转换手柄菜单稳定与拖块

转换手柄菜单 SHALL 在指针从父菜单移入子菜单再移回父菜单时保持打开。图片块与表格块的转换菜单 SHALL 以指针所在手柄为纵向锚点，菜单垂直中心与手柄中心偏差 SHALL 不超过 2px。按住转换手柄拖动时 SHALL 显示落点插入指示，松手后块 SHALL 移动到目标位置。

#### Scenario: 回移不关闭

- **WHEN** 用户悬停「在下方添加」展开子菜单，再把指针上移回父菜单并停留 300ms
- **THEN** 转换菜单节点数 SHALL 等于 1

#### Scenario: 图片菜单跟随手柄

- **WHEN** 用户打开图片块的转换菜单
- **THEN** 菜单垂直中心与手柄中心偏差 SHALL 不超过 2px

#### Scenario: 拖块有落点指示

- **WHEN** 用户按住第 3 段手柄拖到第 1 段上方
- **THEN** 拖拽期间插入指示线节点数 SHALL 等于 1，松手后该段落顺序 SHALL 变化且源位置不再含该段落

### Requirement: E-26 插入菜单表格与分栏

插入菜单的表格选择器 SHALL 在指针滑入任意格时选中「左上第一格到指针格」的完整矩形，滑动过程 SHALL 不重建网格。分栏入口 SHALL 渲染 5 根竖向柱子（无文字标签），指针自左向右滑过即选中第 1..i 根，单击第 i 根 SHALL 插入 `::: {.col-i}` 围栏。

#### Scenario: 滑入选中矩形

- **WHEN** 用户把指针滑到表格网格第 3 行第 4 列
- **THEN** 处于选中态的格子数 SHALL 为 12

#### Scenario: 回滑收缩矩形

- **WHEN** 用户从第 3 行第 4 列直接滑回第 1 行第 1 列
- **THEN** 处于选中态的格子数 SHALL 为 1

#### Scenario: 分栏横向选择

- **WHEN** 用户展开分栏菜单并把指针从左滑到第 3 根柱子
- **THEN** 柱子数 SHALL 为 5，选中柱子数 SHALL 为 3，单元 `textContent` SHALL 为空

#### Scenario: 单击插入分栏

- **WHEN** 用户单击第 3 根柱子
- **THEN** 文档 SHALL 插入 `::: {.col-3}` 围栏，浮层 SHALL 关闭且无残留

### Requirement: E-27 图片描述行

图片工具条的描述入口 SHALL 在图片下方展开可编辑输入框，SHALL NOT 插入引用块。提交后描述 SHALL 写入图片属性并在重新打开文档时回显；已有描述时再次点击 SHALL 进入编辑并回填原值。描述入口图标 SHALL 为「文本+笔」，图标与文字 SHALL 贴合。描述框默认隐藏、点「添加描述」切换为编辑态（见 E-35）。

#### Scenario: 描述入口展开输入

- **WHEN** 用户选中图片并点击描述入口
- **THEN** 图片下方 SHALL 出现输入框，文档 SHALL NOT 新增 `> 评论：` 行

#### Scenario: 提交后回显

- **WHEN** 用户输入「示意图」并提交，随后重新打开该文档
- **THEN** 图片属性 SHALL 含「示意图」，描述行 SHALL 显示该文字

#### Scenario: 已有描述可再编辑

- **WHEN** 用户对已有描述的图片再次点击描述入口
- **THEN** 输入框 SHALL 出现且值为「示意图」

### Requirement: E-28 图片裁剪正确性

裁剪写回 SHALL 清除图片尾部所有旧宽度注释（含 `-->` 与 `—>` 变体、跨行与任意前导空白），SHALL NOT 在正文留下字面注释。裁剪 SHALL 支持八个控制点，每点 SHALL 显示裁剪标识与对应方向光标。拖动左/上边界时裁剪框的变化方向 SHALL 与指针方向一致。裁剪浮层内拖动矩形本体 SHALL 平移整个裁剪区域，再次保存 SHALL 使用新矩形。

#### Scenario: 不再泄漏旧注释

- **WHEN** 用户对带 `<!--w=811—>` 尾注（含跨行）的图片裁剪并保存
- **THEN** 编辑态可见文本 SHALL NOT 含 `<!--w=`，图片下方空白高度 SHALL 不超过 8px

#### Scenario: 左上方向正确

- **WHEN** 用户拖动裁剪框左上角向右下移动
- **THEN** 裁剪宽度 SHALL 变小，方向与指针一致

#### Scenario: 控制点有裁剪语义

- **WHEN** 用户打开裁剪浮层
- **THEN** 至少 6 个控制点的计算 `cursor` SHALL 为 `nwse-resize` / `nesw-resize` / `ew-resize` / `ns-resize` 之一，且每点显示裁剪角标

#### Scenario: 二次裁剪按新矩形保存

- **WHEN** 用户再次打开裁剪、拖动矩形本体后保存
- **THEN** 文档中的 crop 值 SHALL 等于新矩形，图片可见区域 SHALL 随之变化

### Requirement: E-29 图片对齐与缩放锚点

编辑态图片 SHALL 按对齐属性渲染，新插入图片默认居中；工具条 SHALL 以激活态标示当前对齐，激活态 SHALL 与未激活态有可测色差。选中图片后拖动角部锚点 SHALL 调整尺寸，SHALL NOT 进入裁剪。

#### Scenario: 默认居中

- **WHEN** 用户新插入一张图片
- **THEN** 容器 `text-align` SHALL 为 `center`，工具条居中按钮 `aria-pressed` SHALL 为 `true`

#### Scenario: 对齐态切换

- **WHEN** 用户把图片改为左对齐
- **THEN** 仅左对齐按钮 `aria-pressed` SHALL 为 `true`，且该按钮背景色与未选中态差值 SHALL 不为 0

#### Scenario: 已裁剪图拖锚点缩放

- **WHEN** 用户选中已裁剪图片并拖动角部锚点
- **THEN** 裁剪浮层节点数 SHALL 为 0，图片宽高 SHALL 变化

### Requirement: E-30 图片预览浮层

双击图片打开的预览浮层 SHALL 支持滚轮缩放到 1–8 倍、放大后拖动平移、双指捏合、90° 步进旋转、下载与恢复原始尺寸。预览 SHALL 应用图片的裁剪矩形：`<img>` 的 `object-fit` SHALL 为 `none`，`object-position` SHALL 等于裁剪偏移，使预览呈现裁剪后的画面。

#### Scenario: 滚轮放大

- **WHEN** 用户在预览浮层内向上滚动滚轮
- **THEN** 图片 `scale` SHALL 大于 1

#### Scenario: 放大后平移

- **WHEN** 用户在放大状态下拖动图片
- **THEN** 平移量 SHALL 变化且不超出图片边界

#### Scenario: 旋转与复位

- **WHEN** 用户点一次旋转，再点恢复原始尺寸
- **THEN** 旋转后角度 SHALL 为 90°，复位后 `scale` SHALL 为 1

#### Scenario: 预览应用裁剪

- **WHEN** 用户双击一张已裁剪图片
- **THEN** 预览 `img` 的 `object-fit` SHALL 为 `none`，`object-position` SHALL 等于裁剪偏移

#### Scenario: 下载与关闭

- **WHEN** 用户点下载，再按 Esc
- **THEN** 下载 SHALL 触发 1 次，浮层 SHALL 关闭且无残留节点

### Requirement: E-31 块菜单与任务图标

编辑态任务列表的复选框 SHALL 为方框内打勾样式，圆角 SHALL 为 3px。图片块的转换菜单 SHALL 依序显示「对齐与缩进、剪切、复制、删除」，移除上移/下移。

#### Scenario: 任务复选框是方框

- **WHEN** 用户打开含任务列表的文档
- **THEN** `.cm-task-checkbox` 的 `border-radius` SHALL 为 3px，未选中态 SHALL 显示方框

#### Scenario: 图片菜单顺序

- **WHEN** 用户打开图片块的转换菜单
- **THEN** 菜单文本顺序 SHALL 为 对齐与缩进、剪切、复制、删除，SHALL NOT 含上移/下移

### Requirement: E-32 HTML 区块尺寸拖拽稳定

HTML 可视化编辑态的尺寸拖拽 SHALL 使用 pointer capture：在 handle 上 `setPointerCapture`，`pointermove` / `pointerup` / `pointercancel` / `lostpointercapture` 挂在 handle 上，SHALL NOT 依赖 window 事件穿过 iframe。guide SHALL 随拖拽边更新 `left` / `top` / `width` / `height` 四值，西侧拖拽 SHALL 同时更新 `left` 与 `width`。写入 SHALL 同时写 `width` / `height` 与 `box-sizing: border-box`。`pointercancel` / `blur` / Esc SHALL 结束拖拽并清空 guide。工具条 SHALL 提供「恢复尺寸」，清除 inline `width` / `height` / `box-sizing`。

#### Scenario: 右缘拖拽改宽

- **WHEN** 用户选中区块并拖动右缘
- **THEN** 元素宽度变化量 SHALL 与拖动距离一致

#### Scenario: 西侧拖拽更新 guide 左缘

- **WHEN** 用户拖动西侧手柄
- **THEN** guide 的 `left` SHALL 随拖动反向变化，`width` SHALL 同步变化

#### Scenario: pointercancel 清理

- **WHEN** 拖拽过程中触发 `pointercancel`
- **THEN** guide 节点数 SHALL 为 0，元素尺寸 SHALL 保持拖拽前值

#### Scenario: 恢复尺寸

- **WHEN** 用户点击工具条「恢复尺寸」
- **THEN** 元素 inline `width` / `height` / `box-sizing` SHALL 为空

### Requirement: E-33 HTML 工具条当前值与图标化

HTML 可视化编辑工具条的字号与字体族控件 SHALL 显示当前计算值；当前值不在预置选项内时 SHALL 作为额外 option 保留。文字级按钮（AI / 链接 / 截图 / 删除 / 对齐）SHALL 以图标呈现，并保留 `aria-label` 与 `title`。工具条 SHALL NOT 提供截图入口。

#### Scenario: 字号显示当前值

- **WHEN** 用户选中一段文字
- **THEN** 字号 `select` 的 `value` SHALL 严格等于该元素的计算字号

#### Scenario: 无截图入口

- **WHEN** 用户选中元素或文字
- **THEN** 工具条内截图按钮数 SHALL 为 0

#### Scenario: 文字标签改为图标

- **WHEN** 用户查看工具条文字级按钮
- **THEN** 带文字标签的按钮数 SHALL 为 0，每个按钮 `aria-label` 与 `title` SHALL 非空

### Requirement: E-34 视频块布局

MD 编辑态的视频块 SHALL 渲染为可播放的 `<video controls>`，默认宽度约为行宽的 2/3，并 SHALL 按图片属性语法支持 `align` 与 `width`。尺寸调整 SHALL 复用图片的 8 向 handle 与 `applyImageSize`。块手柄 SHALL 按引用扩展名显示 `VideoOutlined` / `AudioOutlined` 图标。

#### Scenario: 视频可播放且默认 2/3 宽

- **WHEN** 用户打开含视频块的文档
- **THEN** `video.controls` SHALL 为 `true`，容器宽与行宽之比 SHALL 约等于 2/3

#### Scenario: 拖 handle 调宽

- **WHEN** 用户拖动视频块手柄
- **THEN** 容器宽度 SHALL 变化

#### Scenario: 视频手柄图标

- **WHEN** 用户悬停视频块手柄
- **THEN** 手柄 `data-icon` SHALL 为 `VideoOutlined`

### Requirement: E-35 图片描述默认隐藏与切换

图片工具条的描述输入框 SHALL 默认隐藏；点击「添加描述」SHALL 切换为编辑态并显示输入框，再次点击或提交 SHALL 收起。描述按钮的图标与文字 SHALL 贴合。描述按钮图标 SHALL 为 ic-image-caption 语义图标（按 `src/editors/icons.ts` 命名约束选定），SHALL NOT 与文字分离。

#### Scenario: 默认隐藏

- **WHEN** 用户选中一张图片
- **THEN** 描述输入框的 `display` SHALL 为 `none`

#### Scenario: 点击添加描述后显示

- **WHEN** 用户点击「添加描述」
- **THEN** 描述输入框的 `display` SHALL 不为 `none`

#### Scenario: 添加描述图标贴合

- **WHEN** 用户选中一张图片并查看「添加描述」按钮
- **THEN** 按钮图标 SHALL 为 ic-image-caption 语义图形，图标与文字间距 SHALL ≤2px

### Requirement: E-36 斜杠菜单回显与逗号触发

斜杠菜单删除查询字母回到空查询时 SHALL 恢复完整列表。行首输入半角 `,` 或全角 `，` SHALL 归一为 `/` 并打开菜单；代码块、行内代码、链接地址与公式内 SHALL NOT 转换。

#### Scenario: 行首逗号触发菜单

- **WHEN** 用户在行首输入 `,h1`
- **THEN** 斜杠菜单节点数 SHALL 为 1，源码 SHALL 严格等于 `/h1`

#### Scenario: 删字母恢复完整列表

- **WHEN** 用户把 `/h1` 删到 `/`
- **THEN** 列表行数 SHALL 严格等于完整列表行数

#### Scenario: 代码块内不转换

- **WHEN** 用户在围栏代码块内输入 `,`
- **THEN** 源码 SHALL 保留 `,`，斜杠菜单节点数 SHALL 为 0

### Requirement: E-37 菜单完整显示与窗口适配

转换手柄菜单 SHALL 默认完整显示全部项；窗口可用高度不足时 SHALL 按比例压缩行高（保留最小可读行高），仍不足才启用纵向滚动。菜单宽度 SHALL 保持既有宽度常量。

#### Scenario: 默认完整显示

- **WHEN** 用户在默认视口打开转换手柄菜单
- **THEN** 可见行数 SHALL 等于总行数

#### Scenario: 窗口不足时适配

- **WHEN** 用户在可用高度不足的视口打开转换手柄菜单
- **THEN** 菜单底边 SHALL 不超过视口可用高度下限，图标与文字 SHALL 保持最小可读尺寸

### Requirement: E-38 图片工具条贴边

图片选中工具条 SHALL 始终位于视口内：定位时做 8px 边距夹取；当图片锚点完全离开视口时工具条 SHALL 隐藏，滚回后重新显示。

#### Scenario: 图片滚出视口

- **WHEN** 用户滚动文档使选中图片离开视口
- **THEN** 工具条 SHALL 隐藏或与视口保持非空交集，右/下边 SHALL NOT 超出视口

### Requirement: E-39 图片内联裁剪

图片裁剪 SHALL 在图片上直接进行：显示裁剪框与边角手柄，拖动时实时显示裁剪结果，松手写回 `crop`；SHALL NOT 弹出独立对话框，SHALL NOT 提供确认/取消/还原按钮。把裁剪框拖回整图范围 SHALL 移除 `crop` 属性。

#### Scenario: 无对话框与按钮

- **WHEN** 用户点击图片工具条的裁剪
- **THEN** 页面 SHALL NOT 出现裁剪对话框，确认/取消/还原按钮数 SHALL 严格等于 0

#### Scenario: 实时裁剪与恢复

- **WHEN** 用户拖动裁剪框后松手，再拖回整图范围
- **THEN** 显示区域与 `crop` 数值差 SHALL ≤ 2px，图片下方空白高度 SHALL ≤ 8px；拖回整图后源码 `crop` 属性 SHALL 变为不存在

#### Scenario: 取消恢复原状

- **WHEN** 用户在裁剪中按 Esc
- **THEN** 图片 SHALL 恢复裁剪前状态，且无残留裁剪框

### Requirement: 文本与脚本文件行号

编辑态对非 Markdown 的纯文本 / 脚本（代码）文件 SHALL 显示行号；Markdown 编辑态 SHALL NOT 显示行号槽（沿用 E-8）。行号槽宽度 SHALL 取设计系统间距 token，行号文字 SHALL 使用次级色且不参与文本选择。

#### Scenario: 文本与脚本文件显示行号

- **WHEN** 用户以编辑态打开一个 `.txt` 或 `.js` 文件
- **THEN** 行号槽节点数 SHALL ≥1，且每个可见行对应一个行号

#### Scenario: Markdown 编辑态无行号槽

- **WHEN** 用户以编辑态打开一个 `.md` 文件
- **THEN** 行号槽节点数 SHALL 为 0

### Requirement: E-40 编辑器内容同步与输入吞吐

编辑器与页签内容之间的同步 SHALL 按「写入者归属 + 修订号」协议执行，杜绝旧快照全文覆盖用户刚敲的字。内容快照 SHALL 经节流写入 store，键入时 SHALL NOT 每键全量写；所有以 store 快照为准的出口 SHALL 先从 live 编辑器取全文再落盘。

每个页签 SHALL 持有 `contentRevision`（单调递增）与 `lastWriter`（面板 id 或 `"external"`）；每个 EditorView SHALL 记录 `lastAppliedRevision`。写入者自身回声（`lastWriter === 本面板`）SHALL 被跳过；其余变化 SHALL 按公共前后缀裁剪为最小 diff 应用，事务附 `annotations: [Transaction.addToHistory.of(false), isolateHistory.of("before")]`，应用前 SHALL 校验 view 归属且位置 clamp 到文档范围。整篇灌入 SHALL 仅发生在页签首次装载或可见性首次置真。

store 内容快照 SHALL 采用 300ms 防抖 + 2000ms 截止；`dirty` SHALL 在首次键入时立即置位。保存、另存为、导出（PDF/HTML/PNG/docx/mdpkg）、打印、切页签、进入预览、组件卸载、窗口关闭与外部回灌前，SHALL 强制 flush，flush SHALL 从 live `EditorView.state.doc` 取全文写 store。

#### Scenario: 双面板同页签镜像一致

- **WHEN** 同一页签在两个面板同时可见，面板 A 连续输入 5 次
- **THEN** 面板 B 的文本 SHALL 与面板 A 相同（差异字符数为 0），且不出现互相覆盖导致的分叉

#### Scenario: 外部回灌后一次撤销不清空正文

- **WHEN** 外部内容回灌到当前页签后，用户按一次撤销
- **THEN** 正文 SHALL NOT 被清空（文档长度 ≥ 1），回灌事务 SHALL NOT 进入撤销历史，撤销 SHALL 只回退用户真实编辑步

#### Scenario: 键入快照节流

- **WHEN** 用户在 200ms 内连续键入 10 次
- **THEN** store 内容快照的更新次数 SHALL ≤ 2，且首次键入后 `dirty` SHALL 为 true

#### Scenario: 保存前 flush 与节流截止收敛

- **WHEN** 用户键入后在 50ms 内触发保存
- **THEN** 落盘内容与编辑器全文 SHALL 差异字符数为 0，保存 SHALL 读取 flush 后的 live 全文而非过期快照
- **AND** 键入后等待超过 2100ms，store 内容快照与编辑器全文 SHALL 差异字符数为 0

### Requirement: E-41 撤销历史边界与键位语义

编辑器的撤销历史 SHALL 遵循三原则：用户可感知变更 SHALL 带 `userEvent`；程序回灌 SHALL NOT 进入历史但 SHALL 以 `isolateHistory` 切断与相邻分组的连接；结构命令 SHALL 每意图一个独立 undo 步。键位 SHALL 恢复 CodeMirror `defaultKeymap` 的缩进语义，SHALL NOT 将 `Mod-[`/`Mod-]` 误绑为撤销/重做。

结构命令（标题升降、列表缩进、智能回车、智能退格、块转换）SHALL 通过结构事务助手 `structureTransaction` 执行，事务 SHALL 附加 `userEvent: "app.structure"` 与 `isolateHistory.of("full")`。撤销/重做主键位 `Mod-Z`/`Ctrl-Z` SHALL 保持由 `historyKeymap` 与历史绑定承载，不受键位纠偏影响。

#### Scenario: 结构命令一次意图一次撤销

- **WHEN** 用户对一段文本执行一次标题降级，随后按一次 ⌘Z
- **THEN** 文档 SHALL 与操作前字符差异数为 0，标题降级 SHALL 作为单一 undo 步完全还原

#### Scenario: 连续结构命令只回退最后一次

- **WHEN** 用户连续执行两次结构命令，随后按一次 ⌘Z
- **THEN** SHALL 仅回退最后一次结构命令，回退字符数 SHALL 等于第二次 change 的长度，第一次结构命令 SHALL 保持不变

#### Scenario: Mod-[ 恢复减少缩进语义

- **WHEN** 用户在有序列表上按 `Mod-[`
- **THEN** 该行缩进 SHALL 减少一级（减少的缩进级数为 1），列表内容 SHALL NOT 回退，键位表 SHALL NOT 存在 `Mod-[` 绑定 undo 的条目

#### Scenario: 撤销主键位不受纠偏影响

- **WHEN** 用户按 `Mod-Z`/`Ctrl-Z` 执行撤销与重做
- **THEN** 撤销与重做 SHALL 正常生效，其键位绑定 SHALL 由历史键位承载，不受 `Mod-[`/`Mod-]` 移除影响

### Requirement: E-42 块手柄增量对账与块型图标

编辑态块手柄 SHALL 按「顶层块序号 + 块类型」键做增量对账：纯内容变更（键不变）SHALL 只重算几何、不重建手柄 DOM；插入/删除/类型变化 SHALL 只重建受影响块及其后的手柄。文本行块（段落 / 列表项 / 待办 / 标题 / 引用）SHALL 按可视文本行显示手柄，每行一个并随该行滚动跟随；非文本行块（表格 / 代码块 / mermaid / html 块）SHALL 保留块级手柄。手柄位置 SHALL 以对应行（行手柄）或块首行（块手柄）渲染元素的行盒为准，SHALL NOT 以多层 `coordsAtPos` 兜底作为主路径；块不在视口内时 SHALL NOT 渲染手柄。

每个块型 SHALL 映射到唯一的手柄图标：既有 `blockHandleIcon` / `BLOCK_ICON_NAME` 已按 heading 级别取 H1–H6、按有序 / 无序取**可区分**的有序编号图标与无序图标（有序 SHALL NOT 退化为无序图标）、按图片首行扩展名取 Video/Audio/Image；附件块 SHALL 按引用扩展名映射为附件类图标，SHALL NOT 沿用图片图标；本批 SHALL 为 `htmlBlock` 与 `yamlFrontMatter` 补齐明确条目，使其不再回退默认拖拽图标。表格与高亮块的手柄 SHALL 位于块左侧垂直居中，SHALL NOT 落在左上角。文档末尾 SHALL 提供不落盘的「+」入口，点击插入空段落并聚焦；该入口 SHALL NOT 写入文档、SHALL NOT 进入撤销历史。

#### Scenario: 输入后手柄贴住块首行且不重建

- **WHEN** 用户在一个多行文本行块中连续输入若干字符
- **THEN** 手柄矩形上沿与其所属行行盒上沿的垂直偏差 SHALL ≤ 1px（行手柄贴所在行、块级手柄贴块首行），且手柄根节点的 DOM 标识在输入前后保持不变

#### Scenario: 块型变化只重建受影响手柄

- **WHEN** 用户把一个段落转换为标题，再插入一个新段落
- **THEN** 仅该段落与受影响之后的节点被替换，其余手柄节点复用；文档中不被影响的块手柄数 SHALL 严格等于转换前减去受影响的数量

#### Scenario: 文末「+」插入段落

- **WHEN** 用户在文档最末块之后点击「+」入口
- **THEN** SHALL 新增一个空段落且光标落入其中，文档末尾严格等于「原末尾内容 + 一个空段」；按一次撤销后该空段消失

#### Scenario: 有序列表手柄图标可区分

- **WHEN** 用户把指针移到有序列表块与无序列表块的左侧召唤区
- **THEN** 两者的手柄 `data-icon` SHALL 分别为有序编号图标与无序图标，且严格不相等

#### Scenario: 附件手柄图标按扩展名

- **WHEN** 用户把指针移到附件块的左侧召唤区
- **THEN** 手柄图标 SHALL 按引用扩展名映射为附件类图标，SHALL NOT 等于图片图标

#### Scenario: 表格与高亮块手柄垂直居中

- **WHEN** 用户把指针移到表格块或高亮块的左侧召唤区
- **THEN** 手柄垂直中心与块渲染矩形垂直中心偏差 SHALL ≤ 2px，SHALL NOT 落在块左上角

### Requirement: E-43 拖拽重排只作用于被移动区间

用块手柄拖拽重排 SHALL 只对被移动区间做换行规范化，其余字节 SHALL 逐字保留。一次拖拽重排 SHALL 是单个 undo 步，撤销一步 SHALL 完全还原本次移动且不产生其它空行变化。

#### Scenario: 拖块后仅区间规范化

- **WHEN** 用户把第 2 段拖到第 1 段之前并松手
- **THEN** 除两段之外文档其余字节严格等于操作前，且一次撤销后文档与操作前逐字节相同

### Requirement: E-44 图片裁剪坐标系与保存可靠性

进入图片裁剪前 SHALL 等待图片加载完成（`img.complete` 或 load 事件），2s 超时 SHALL 放弃并提示，SHALL NOT 在 `scale <= 0` 时静默失败。框选、拖动与写回 SHALL 使用同一显示坐标系。编辑态已裁剪图片 SHALL 统一用「外盒 `overflow:hidden`（尺寸 = 可见裁剪显示尺寸）+ 内图按整图缩放平移」结构渲染；`width` 属性 SHALL 表示可见裁剪宽度，`scale` SHALL 等于 `width / cropWidth`；无 `width` 时 `scale` SHALL 由整图当前显示宽度与自然宽度之比求得。保存 SHALL 把显示矩形换算为原图像素矩形一次，并 SHALL 同步写回可见 `width/height`（取整），使确认前后显示宽高比严格为 1。保存 SHALL 同时由显式保存按钮与 window 级 `pointerup` 触发，SHALL NOT 依赖裁剪框存活；Esc SHALL 取消且不写回。

#### Scenario: 裁剪缩放不跳变

- **WHEN** 用户打开裁剪、拖动裁剪框后保存
- **THEN** 保存前后图片显示宽度的比值 SHALL 严格等于 1，裁剪框矩形与 `crop` 值 SHALL 一一对应

#### Scenario: 带 width 的图片确认后区域一致

- **WHEN** 对带 `{width=…}` 的图片拖出左上子区域并确认
- **THEN** 确认后 `img` 的可见宽高 SHALL 等于确认前裁剪盒的显示宽高（比值 1 ±0.02），显示内容区域 SHALL 与拖拽预览一致；`object-fit` SHALL 为 `none`，内图 SHALL 以 `scale` 缩放并以 `-left*scale / -top*scale` 平移

#### Scenario: 拖回整图恢复

- **WHEN** 用户把裁剪框拖回整图范围后确认
- **THEN** 源码 `crop` 属性 SHALL 被移除，图片显示 SHALL 恢复为裁剪前尺寸

#### Scenario: 保存不随裁剪框销毁丢失

- **WHEN** 用户在裁剪过程中触发一次装饰重建（裁剪框被销毁）后再松手
- **THEN** 裁剪结果 SHALL 仍被写回，源码 `crop` 属性 SHALL 等于最终显示矩形换算值；若最终取消则 SHALL NOT 残留裁剪框

### Requirement: E-45 列表层级缩进与编号一致性

列表 Tab/Shift-Tab SHALL 按当前 marker 宽度递进/回退，非列表行 SHALL 保持默认行为。深度上限 SHALL 为 6。空项回车 SHALL 三态判定：空项且有子项 → 退一层；空项且无子项 → 退出列表；非空项 → 同级新项。有序列表编号 SHALL 在编辑态按同级序号计算显示，并在列表结构变化（回车、缩进、删除、转换）时同步重写源码字面量，使编辑态与预览一致。

#### Scenario: 缩进到第六层

- **WHEN** 用户在同一列表项上连续按 5 次 Tab
- **THEN** 该项深度 SHALL 等于 5（相对首层），第 6 次 Tab 后深度不再增加（上限 6）

#### Scenario: 空项逐级退出

- **WHEN** 用户在一个有子项的空列表项上按回车，随后在无子项的空项上按回车
- **THEN** 第一次回车后该项退一层且子项保留；第二次回车后该项退出列表成为同级段落，列表项数减少 1

#### Scenario: 编号随结构重算

- **WHEN** 用户在两个有序项之间插入一个新项并回车
- **THEN** 编辑态显示编号 SHALL 依次为 1、2、3，源码中的有序编号字面量 SHALL 与显示一致

### Requirement: E-46 分栏编辑防双活与 stale 提交

分栏单元格的编辑窗口与宿主 SHALL NOT 同时接收输入：存在 `.cm-column-editor` 时 SHALL 冻结该分栏 widget 的销毁/重建，关闭后 SHALL 强制刷新一次。`commit` SHALL 用围栏首行内容或 `cols:` 属性串匹配目标栏，SHALL NOT 只依赖打开时的 `from` 偏移；匹配失败 SHALL 把 textarea 文本回填宿主并 toast 提示，SHALL NOT 静默丢弃。

#### Scenario: 编辑期间位移不丢字

- **WHEN** 用户在分栏单元格 A 输入内容，期间文档在 A 之前插入了一个新块使 A 的偏移改变，然后切走焦点触发 commit
- **THEN** A 的新内容 SHALL 落回正确单元格，页面 SHALL 出现可见提示；未匹配到栏位时文本 SHALL 回填且不含丢失

#### Scenario: 只有一个输入窗口

- **WHEN** 用户打开某分栏单元格的编辑窗口后再点击同一单元格
- **THEN** `.cm-column-editor` 节点数 SHALL 严格等于 1，且两个窗口不同时接收输入

### Requirement: E-47 块类型图标一致性

本批触及的块类型图标 SHALL 按设计系统 §2 收敛：语义唯一、笔画密度 ≤6、尺寸落在 14/18/24 档、成对语义一致。同一语义在手柄与块菜单 SHALL 取同一个 `data-icon` 名：表格块统一改用网格语义图标，SHALL NOT 使用图表语义的 `TableChartOutlined`；引用块 SHALL 统一为 `FormatQuoteOutlined`。`htmlBlock` 与 `yamlFrontMatter` SHALL 各有明确的自有图标条目。全部图标 SHALL 来自本仓图标词表与自有 SVG，SHALL NOT 复用 Quiet.md 的图形资产。

#### Scenario: 图标词表唯一

- **WHEN** 用户召唤任一受支持块型的手柄与块菜单
- **THEN** 同一语义在手柄与菜单的 `data-icon` 名 SHALL 严格相等，且引用块 `data-icon` SHALL 为 `FormatQuoteOutlined`

#### Scenario: 表格图标为网格语义

- **WHEN** 用户查看表格块的柄/菜单图标
- **THEN** `data-icon` SHALL 指向网格图标条目，SHALL NOT 为 `TableChartOutlined`；该条目满足 §2 笔画与尺寸约束

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。**标注**（13 个语义类型）SHALL 共享同一颜色编辑能力；**高亮**（纯高亮块）SHALL 使用独立色系：8 个色相（红 / 橙 / 黄 / 绿 / 青 / 蓝 / 紫 / 灰），每个色相提供浅填充与同色系深边框两档，色值取既有 `mdb-bg-*` token，不新增色值。

块族名 SHALL 二分为「高亮」与「标注」两项：**高亮** SHALL 为无左边框、无标题栏、1px 全边框、4px 圆角、强荧光叠底（`color-mix` 约 38%）的纯高亮块；**标注** SHALL 为带 3px 左边框与标题栏的 13 语义类型 callout。斜杠菜单、块菜单「转为」、转换手柄菜单与选区轮盘四处入口 SHALL 只呈现这两项。四个入口选「高亮」SHALL 直落 `> [!highlight]`；选「标注」SHALL 展开 13 个语义类型。`> [!highlight]` 的 markdown 序列化格式 SHALL 与既有 callout 一致。

纯高亮块的工具条 SHALL 水平居中于块盒（中心偏差 ≤ 2px）并使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变。纯高亮颜色面板 SHALL 使用独立色系，自上而下 SHALL 为：字体颜色（字母 A 色块，右上角「随机」）、边框颜色、填充颜色（浅色行 / 深色行）、恢复默认。「随机」SHALL 在一次事务内同时更换边框与填充、二者 SHALL 属同一色相族、文字色 SHALL 保持不变；「恢复默认」SHALL 清空三色属性。字体色色块 SHALL 使用字母「A」字形（`FormatColorTextOutlined`），SHALL NOT 使用荧光笔字形；标注类型 SHALL 按色相映射到目标类型可用色板。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；标注填充 SHALL 为软色。

转换手柄菜单中「高亮」SHALL 使用荧光笔图标、「标注」SHALL 使用 callout 图标，二者图标 SHALL 不同；「标注」展开的 13 类类型 SHALL 复用新增菜单的同一份图标（emoji）。新增手柄菜单中的标注项标签 SHALL 为「标注」，SHALL NOT 为「高亮」。

#### Scenario: 纯高亮无边框无标题栏

- **WHEN** 通过斜杠菜单选择「高亮」插入块
- **THEN** 块计算 `border-inline-start-width` SHALL 为 `0px`，块内 `.cm-callout-header` 节点数 SHALL 为 0，`border-top-width` SHALL 为 `1px`，`border-radius` SHALL 为 `4px`，页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

#### Scenario: 菜单两项收敛

- **WHEN** 用户打开斜杠菜单「常用」段、块菜单「转为」网格、转换手柄「高亮」组或选区轮盘「转换 → 高亮」三层
- **THEN** 四处 SHALL 只出现「高亮」与「标注」两项，SHALL NOT 出现第三项；选「标注」SHALL 展开 13 个语义类型

#### Scenario: 旧语法保持不变

- **WHEN** 打开含 `> [!NOTE] 标题` 的文档
- **THEN** 渲染结果 SHALL 与本要求引入前字符差异数为 0，不出现属性块，仍归入「标注」

#### Scenario: 三色属性渲染

- **WHEN** 打开含 `> [!NOTE]{bg=green border=red text=gray} 标题` 的文档
- **THEN** 卡片背景 SHALL 为 green 的软色（`color-mix` ~10%），边框与文字色 SHALL 分别等于 red / gray 调色板 token，属性顺序改变后结果不变

#### Scenario: 类型转换保留属性与一步撤销

- **WHEN** 把 `{bg=green border=red text=gray}` 的 NOTE 块类型改为 TIP，随后按一次 ⌘Z
- **THEN** 属性块与折叠标记 SHALL 原样保留，撤销 SHALL 只回退最后一次操作，改色前状态完全还原

#### Scenario: 纯高亮预设

- **WHEN** 通过斜杠菜单选择「高亮」
- **THEN** 插入块 SHALL 为 `> [!highlight]`，无左边框与标题栏、1px 全边框、底色为荧光笔半透明黄；页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

#### Scenario: 纯高亮与标注视觉不同

- **WHEN** 打开同时含 `> [!highlight]` 与 `> [!NOTE]` 的文档
- **THEN** 高亮块计算 `border-inline-start-width` SHALL 为 `0px`、`border-top-width` SHALL 为 `1px`、`border-radius` SHALL 为 `4px`、背景色不透明度 SHALL 高于标注；标注块 `border-inline-start-width` SHALL 为 `3px`

#### Scenario: 高亮工具条居中且为荧光笔

- **WHEN** 点击纯高亮块
- **THEN** 工具条水平中心与块盒水平中心偏差 SHALL ≤ 2px，按钮图标 SHALL 为荧光笔

#### Scenario: 随机同时换边框与填充

- **WHEN** 在纯高亮颜色面板点击「随机」
- **THEN** 首行 `bg` 与 `border` SHALL 同时改变且色相相同，`text` SHALL 保持不变；一次 ⌘Z SHALL 同时还原两项

#### Scenario: 恢复默认

- **WHEN** 在纯高亮颜色面板点击「恢复默认」
- **THEN** 首行属性块 SHALL 为空，颜色回落类型 tone

#### Scenario: 字体色恢复字母 A

- **WHEN** 打开块菜单颜色面板的字体色行
- **THEN** 每个色块内 SHALL 渲染字母 A 字形，SHALL NOT 渲染荧光笔字形；色块容器计算 `justify-content` SHALL 为 `center`

#### Scenario: 菜单图标分家与标注类型复用

- **WHEN** 打开块菜单「转为」网格与「标注」浮层
- **THEN** 高亮格与标注格图标 SHALL 不同；标注浮层 13 项的 emoji SHALL 与新增菜单对应项一致

#### Scenario: 新增菜单命名

- **WHEN** 打开新增手柄菜单
- **THEN** 标注项标签 SHALL 为「标注」，菜单中 SHALL NOT 出现标签为「高亮」的标注项

#### Scenario: 类型切换色相映射

- **WHEN** 用户把 NOTE 块的填充改为红色后切换到 TIP
- **THEN** 填充色相 SHALL 仍为红

### Requirement: E-49 公式编辑体验

点击公式 SHALL 打开锚定在下方的源码浮层，并实时渲染 KaTeX 预览；Esc 或点击外部 SHALL 提交且正文无定界符残留。键入闭合的 `$…$` SHALL 立即渲染。display 判定 SHALL 在 tex 含换行、含 `\tag` 或以 `\begin{equation|align|gather|split|alignat|CD}` 开头时为块级；`\begin{align*}` SHALL NOT 视为块级。空公式 SHALL 显示「添加 LaTeX 公式」占位；渲染失败 SHALL 显示「无效公式」与警告图标，且无渲染残渣。

#### Scenario: 点击打开源码浮层

- **WHEN** 点击正文中的公式
- **THEN** 公式下方 SHALL 出现源码浮层（节点数为 1），输入过程中预览实时更新；按 Esc 或点击外部后浮层关闭、源码保留、正文不含残留 `$` 定界符

#### Scenario: display 判定

- **WHEN** 公式 tex 含换行，或以 `\begin{align}` / `\begin{equation}` 开头
- **THEN** 该公式 SHALL 按块级渲染；tex 为 `\begin{align*}` 时 SHALL NOT 带块级外框

#### Scenario: 空与无效占位

- **WHEN** 公式源码为空，或 KaTeX 渲染失败
- **THEN** 分别 SHALL 显示「添加 LaTeX 公式」与「无效公式」（占位文本数为 1），且页面不含 `.katex-error` 或半渲染残渣

### Requirement: E-50 附件卡与音频

非图片媒体文件引用 SHALL 渲染为附件卡，含类型图标、文件名与非空大小文本；点击附件卡 SHALL 用系统默认程序打开。音频引用 SHALL 渲染为 `<audio controls>`。pdf / md / html / web SHALL 保持内嵌 `fileEmbed`；其中 md 附件 SHALL 默认展开，宽度与正文同宽，高度随内容自适应且上限 600px，超出部分 SHALL 内部滚动并于底缘渐隐提示截断。md / docx 附件 SHALL 提供样式调整面板（对齐 + 宽度）；docx 附件 SHALL 提供显示位置（对齐）调整。附件引用行首出现前导空格时 SHALL NOT 使整块退化为源码。本要求 SHALL NOT 引入把附件复制进库的行为。

内嵌文件卡 SHALL 提供三种显示方式：**卡片**（只显示头部：文件类型图标 + 文件名主标题 + 描述副标题）、**预览**（头部 + 限高内容）、**嵌入**（全尺寸内嵌）。工具条 SHALL 只含展开全屏、对齐（左 / 中 / 右）与三态切换，SHALL NOT 含下载、SHALL NOT 含宽窄 +/- 按钮；尺寸调整 SHALL 唯一由拖边框完成，写回 `{width=… height=…}` 属性语法。

嵌入 md 的排版 SHALL 与独立预览态逐项一致：字号取 `--type-font-size`（17px）、行高取 `--type-line`（1.78）、段距与标题间距取同一 `.preview-content` 规则；嵌入宿主 SHALL NOT 覆盖这些排版值。预览态对 md / pdf / html / 附件引用 SHALL 渲染真实内嵌内容或附件卡，SHALL NOT 输出 `naturalWidth === 0` 的 `<img>` 裂图占位。

#### Scenario: 内嵌文件卡三态

- **WHEN** 用户选中嵌入文件卡并点击工具条的「卡片」/「预览」/「嵌入」
- **THEN** 三种状态 SHALL 各自可见；「卡片」态 `.cm-embed-body` 计算 `display` SHALL 为 `none`，头部显示文件名与描述副标题；「预览」态 body 可见且高度 ≤ 上限；「嵌入」态 body 全尺寸显示

#### Scenario: 工具条无下载无宽窄

- **WHEN** 用户选中嵌入文件卡并打开工具条
- **THEN** 工具条按钮数 SHALL 为 7（展开全屏 + 左 / 中 / 右 + 卡片 / 预览 / 嵌入），含「下载」字样的按钮数 SHALL 为 0，含 +/- 的按钮数 SHALL 为 0

#### Scenario: 头部图标与描述

- **WHEN** 嵌入文件卡处于「卡片」态
- **THEN** 头部 SHALL 含文件类型图标节点、文件名主标题节点与描述副标题节点（有描述时），主标题文本 SHALL 严格等于文件名

#### Scenario: 拖边框写回尺寸

- **WHEN** 用户拖动嵌入文件卡边框超过 3px
- **THEN** 文档属性 `{width=…}` 或 `{height=…}` SHALL 随之变化

#### Scenario: 嵌入 md 排版保真

- **WHEN** 同一段落分别显示在嵌入 md 与独立预览态
- **THEN** 两者的计算 `font-size` SHALL 相等（17px）、`line-height` SHALL 相等（1.78）、段距 SHALL 相等

#### Scenario: 预览态嵌入可渲染

- **WHEN** 预览态打开含 md / pdf / html / 附件引用的文档
- **THEN** 嵌入区 `naturalWidth === 0` 的 `<img>` 节点数 SHALL 为 0，嵌入内容或附件卡节点数 SHALL ≥ 1

#### Scenario: 附件卡渲染与打开

- **WHEN** 打开含非图片文件引用的文档，并点击该附件卡
- **THEN** 正文 SHALL 出现一张附件卡（节点数为 1），图标按扩展名映射，大小文本非空；系统打开调用数 SHALL 为 1

#### Scenario: 音频内嵌播放

- **WHEN** 打开含音频引用的文档
- **THEN** 正文 SHALL 出现 `<audio>` 节点（节点数为 1）且不含「文件不存在」占位，点击控件可播放

#### Scenario: 内嵌文件不受影响

- **WHEN** 打开含 pdf / md / html / 网页引用的文档
- **THEN** 这些引用 SHALL 保持内嵌渲染，SHALL NOT 退化为附件卡；文档同目录内 SHALL NOT 新增附件副本

#### Scenario: md 附件默认展开与尺寸上限

- **WHEN** 打开含 md 附件引用的文档
- **THEN** md 附件 SHALL 默认展开，宽度 SHALL 与正文文本块同宽；高度 SHALL 随内容自适应且不超过 600px，超出部分 SHALL 可内部滚动，底缘 SHALL 有渐隐提示

#### Scenario: md 与 docx 样式调整面板

- **WHEN** 用户选中 md 或 docx 附件并打开样式调整面板
- **THEN** 面板 SHALL 提供对齐（左 / 中 / 右）与三态切换；宽度调整 SHALL 只由拖边框完成，面板 SHALL NOT 含 +/- 按钮

#### Scenario: docx 显示位置调整

- **WHEN** 用户选中 docx 附件并调整显示位置
- **THEN** 附件对齐 SHALL 随之变化，写回 `align` 属性并在预览态保持一致

#### Scenario: 前导空格不退化

- **WHEN** 用户在附件引用行首添加前导空格
- **THEN** 该引用 SHALL 保持内嵌 / 卡片渲染，SHALL NOT 退化为源码文本

### Requirement: 菜单快捷键列与圆角统一

块菜单、浮条、轮盘与文件名右键菜单的每一行 SHALL 在右侧显示该动作的可见快捷键区（kbd 样式）；无快捷键的动作该行右侧 SHALL 留白，SHALL NOT 只依赖悬停 `title` 呈现快捷键。全部菜单与浮窗容器圆角 SHALL 取菜单圆角 token，行圆角 SHALL 取行 token；文件名右键菜单 SHALL 接入同一 token，SHALL NOT 保留旧的小圆角字面量。

#### Scenario: 菜单行显示可见快捷键区

- **WHEN** 用户打开块菜单、浮条、轮盘或文件名右键菜单
- **THEN** 每个动作行右侧 SHALL 出现 kbd 样式的快捷键显示区；无快捷键的动作行右侧 SHALL 留白，SHALL NOT 出现占位文字

#### Scenario: 文件名右键菜单圆角与其它菜单一致

- **WHEN** 用户右键文件名打开右键菜单并读取菜单容器与行
- **THEN** 容器计算圆角 SHALL 等于菜单圆角 token，行计算圆角 SHALL 等于行圆角 token，且与块菜单容器圆角一致

#### Scenario: 悬停 title 与可见列并存

- **WHEN** 用户悬停一个既有悬停 `title` 的动作行
- **THEN** 可见快捷键区 SHALL 仍存在，悬停提示 SHALL NOT 取代可见列

### Requirement: 高亮块调色入口与高亮类型行

点击高亮块 SHALL 在其上方浮条出现颜色图标；点击该图标 SHALL 展开填充 / 边框 / 文字三色面板与「恢复默认」，并复用批次 3 已交付的三色面板与「一次改色一步撤销」。标注类子菜单（浮条 / 轮盘的高亮转换组）顶部 SHALL 新增「高亮类型」单行，展开既有类型预设（含「纯高亮」），选择即转换。

#### Scenario: 点击高亮块出现颜色入口

- **WHEN** 用户点击一个高亮块
- **THEN** 其上方浮条 SHALL 出现颜色图标；点击该图标 SHALL 展开三色面板，面板含填充 / 边框 / 文字三行与「恢复默认」

#### Scenario: 改色为一步撤销

- **WHEN** 用户在颜色面板中改动高亮块的填充色
- **THEN** 块计算样式随之变化，且按一次撤销 SHALL 只回退本次改色

#### Scenario: 高亮类型行位于顶部且含纯高亮

- **WHEN** 用户展开标注类子菜单
- **THEN** 「高亮类型」单行 SHALL 位于顶部，展开项 SHALL 含「纯高亮」，选择某类型后块类型 SHALL 转换

### Requirement: 豆包式行手柄层级联动转换

文本行块（段落 / 列表项 / 待办 / 标题 / 引用）的手柄 SHALL 按可视文本行显示，每行一个并随该行滚动跟随。上级行手柄触发转换时 SHALL 联同其下级子树一起转换；末级行手柄只转换当前行；联动转换时子级 SHALL 按自身层级的编号规则排号。有序 / 无序列表转高亮 SHALL 在列表外套高亮格式、列表行保持原标记。表格 / 代码块等非文本行块 SHALL NOT 产生行手柄。

#### Scenario: 每行一个手柄并跟行走

- **WHEN** 用户把指针移入一个多行文本行块
- **THEN** 该块每个可视文本行 SHALL 出现一个手柄，手柄垂直位置 SHALL 随所在行行盒移动

#### Scenario: 上级联动下级一起转换

- **WHEN** 用户对一个两层无序列表的上级行触发「转为有序」
- **THEN** 上级与下级 SHALL 一起转为有序；1 级与 2 级都显示有序编号，且 2 级按 2 级编号规则排号

#### Scenario: 末级行只转当前行

- **WHEN** 用户对一个无子级的末级行触发转换
- **THEN** 只有当前行转换，其兄弟行与上级行 SHALL 不变

#### Scenario: 列表转高亮保留列表格式

- **WHEN** 用户对一个有序或无序列表触发「转为高亮」
- **THEN** 列表体外层 SHALL 套上高亮格式，列表行 SHALL 保持原标记与结构

#### Scenario: 非文本行块不产生行手柄

- **WHEN** 用户把指针移入表格或代码块
- **THEN** 不产生行级手柄，仍按块显示手柄

### Requirement: 图片编辑 Quiet 对标

图片编辑态 SHALL 与 Quiet 对标：进入编辑时编辑图标 SHALL 呈选中态；编辑态图片 SHALL 保持原渲染尺寸，SHALL NOT 自动缩小；裁剪角标 SHALL 加大至明显可点；裁剪拖动柄 SHALL 使用裁剪样式图标；进入裁剪态 SHALL 常驻，单次拖动 SHALL NOT 弹回选中态；裁剪区下方 SHALL NOT 显示多余「保存」文字，保存 SHALL 走工具条既有入口；描述区 SHALL 默认隐藏、仅由工具条按钮控制显隐，裁剪态 SHALL 强制隐藏；含图片的文档中每张图片 SHALL 稳定出现手柄。

#### Scenario: 编辑图标选中态

- **WHEN** 用户进入图片编辑态
- **THEN** 编辑按钮 SHALL 呈选中态，且与未选中态有可测色差

#### Scenario: 编辑态图片不缩小

- **WHEN** 用户选中一张图片进入编辑态
- **THEN** 图片渲染宽度 SHALL 等于进入编辑前的宽度，SHALL NOT 自动缩小

#### Scenario: 裁剪角标加大与拖动柄图标

- **WHEN** 用户打开裁剪态
- **THEN** 角标尺寸 SHALL 大于既有默认值且命中区明显；拖动柄 SHALL 使用裁剪样式图标

#### Scenario: 裁剪态常驻

- **WHEN** 用户进入裁剪态后拖动裁剪边界一次
- **THEN** 裁剪态 SHALL 保持，SHALL NOT 弹回普通选中态

#### Scenario: 裁剪区下方无保存文字

- **WHEN** 用户进入裁剪态
- **THEN** 裁剪区下方 SHALL NOT 出现「保存」文字按钮；保存入口 SHALL 位于工具条

#### Scenario: 描述区默认隐藏与裁剪态强制隐藏

- **WHEN** 用户选中图片且不点击描述按钮，随后进入裁剪态
- **THEN** 描述区默认 SHALL 隐藏；点击工具条描述按钮 SHALL 切换显隐；裁剪态下描述区 SHALL 强制隐藏

#### Scenario: 图片手柄不缺失

- **WHEN** 用户打开含多张图片的文档并逐张把指针移到图片左侧召唤区
- **THEN** 每张图片 SHALL 出现手柄，SHALL NOT 出现偶发缺失

### Requirement: E-51 IME 组合稳定性与大文档键入

编辑器装饰集 SHALL 始终与当前文档范围一致。IME 组合期间发生文档变更时，装饰集 SHALL 通过 `tr.changes` 映射后再返回，SHALL NOT 返回按旧文档计算的未映射集合。文档长度 ≥ 50,000 字符时，普通键入（`input.type` 且行数不变）SHALL 走映射快路径，并在最后一次键入后不超过 300ms 内补一次全量重建；结构变更、选区跳转、折叠切换与组合结束 SHALL 立即重建。键入路径 SHALL NOT 抛出异常、SHALL NOT 造成可见内容塌陷或媒体节点消失。

#### Scenario: 组合期不崩溃

- **WHEN** 在含图片 / 视频 / 高亮块的文档正文用 IME 连续输入
- **THEN** 页面 SHALL NOT 出现 `TypeError`/`RangeError`；`scrollHeight` 前后差 SHALL ≤ 5%；图片与视频节点数 SHALL NOT 减少

#### Scenario: 大文档键入不每键全量重建

- **WHEN** 在 ≥50,000 字符文档中连续键入 10 个字符
- **THEN** 每次键入 SHALL 以映射保持装饰有效，全量重建次数 SHALL ≤ 1（延迟补建）

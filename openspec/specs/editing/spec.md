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

编辑模式 SHALL 提供块手柄、统一菜单栈、锚点化浮层与 hover 门控。浮层生命周期 SHALL 由单一菜单栈管理：滑入即显示、离开整栈即收起、**不 retarget**（栈打开期间指针移动到其它块不得改变锚点，也不得召唤其它手柄）、滚动容器滚动即收起。块菜单位置 SHALL 横向贴触发手柄右缘、纵向以指针所在行为中心；越界时先翻转再夹取，高度 SHALL 封顶到锚点较大一侧并允许滚动，不得被推离锚点。块手柄 SHALL 为 42×26 药丸（块型图标 + 拖拽把手），空行退化为「+」入口；块菜单 SHALL 为 264px 宽、行高 36px、图标 20px，按块型裁剪「转为」项，且每一行 SHALL 带图标。「在下方添加」SHALL 在悬停后向右展开二级面板并保留父菜单，父菜单高度 SHALL NOT 因二级内容变化；点击手柄 SHALL 等价于悬停召唤。

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

### Requirement: E-14 浮层定位：最短路径为默认，最优与统一优先

指针触发的浮层（块菜单、二级插入面板、斜杠菜单、大纲浮层、单元格插入菜单、表格边界气泡）SHALL 出现在触发元素近旁：浮层矩形与触发元素矩形之间的最近距离 SHALL 不超过 8px，且 SHALL NOT 覆盖触发元素本身。

**最短路径不是无条件的。** 当它与其他定位目标冲突时，按下述优先级裁决：

1. **不遮挡、不越界**：浮层 SHALL NOT 覆盖触发元素，SHALL NOT 超出可视区；越界时先翻转、再夹取。
2. **同类一律对齐**：属于同一定位组的浮层 SHALL 使用同一对齐边与同一相对偏移。组内任何成员不得为了"更近几像素"而单独偏移——那会让同一入口在不同时刻出现在不同位置。
3. **最短路径**：以上两条都满足后，取最近的位置。

由此，属于「统一定位组」的浮层（例如固定在内容区右上角的工具类入口）允许距离大于 8px，但组内 SHALL 位置一致。这类例外 SHALL 在实现里显式标注，不得靠"碰巧一样"。

该判据以**矩形最近距离**度量，不以中心点距离度量——中心点距离随浮层高度增长，会逼着浮层做小，与「指针不必长途跋涉」的目标相反。

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

MD 编辑态的块手柄 SHALL 仅在指针位于正文左侧四分之一区域或手柄自身时召唤；指针位于其余区域 SHALL NOT 显示手柄。指针滑入手柄后 SHALL 自动显示块菜单，无需点击。

#### Scenario: 左侧四分之一召唤
- **WHEN** 指针进入正文左侧四分之一区域
- **THEN** 对应块手柄 SHALL 淡入

#### Scenario: 右侧不召唤
- **WHEN** 指针仅在正文右侧区域移动
- **THEN** 块手柄 SHALL 保持隐藏

#### Scenario: 滑入即菜单
- **WHEN** 指针从正文滑入已显示的手柄
- **THEN** 块菜单 SHALL 自动打开

### Requirement: E-18 正文选区胶囊

MD 编辑态与阅读态的正文选区 SHALL 显示胶囊工具条；编辑态 SHALL 提供改写/翻译/润色，阅读态 SHALL 提供复制/解释/翻译。胶囊形状 SHALL 与文件类型 chip、活跃页签高亮一致。

#### Scenario: 阅读态选区
- **WHEN** 用户在阅读态选中一段正文
- **THEN** 选区上方 SHALL 显示胶囊工具条

#### Scenario: 编辑态选区
- **WHEN** 用户在编辑态选中一段正文
- **THEN** 选区上方 SHALL 显示改写/翻译/润色胶囊

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 颜色 与 合并后的「对齐与缩进」入口——缩进（增加 / 减少）与对齐（左 / 中 / 右）SHALL 收在同一个入口的二级菜单内，SHALL NOT 各占一行。对齐三项 SHALL 各带图标。缩进图标 SHALL 使用语义正确的缩进/反缩进图形（SHALL NOT 复用好似「左对齐/清除」的错位图标）。颜色 SHALL 使用共享调色板（字色 8 色 + 底色 15 色的实色观感），SHALL NOT 呈现为偏淡的浅色块。菜单项图标 SHALL 为 20px，行高 SHALL 为 36px，菜单宽 SHALL 为 264px（2026-11-03「放大一档」，与 E-7 一致）；新增手柄菜单与转换手柄菜单 SHALL 共用该宽度常量，SHALL NOT 出现两级菜单宽度不一致。菜单内标题行与无序列表项之间的前两行间距 SHALL 收紧，小于其它相邻行间距。「在下方添加」行 SHALL 带图标与右侧展开指示，形态与其它行一致。

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

#### Scenario: 对齐与缩进合并在二级菜单

- **WHEN** 用户打开块菜单
- **THEN** 菜单中 SHALL 只有一个「对齐与缩进」入口；展开其二级菜单后 SHALL 含 左对齐 / 居中 / 右对齐 / 减少缩进 / 增加缩进 五项，且对齐三项 SHALL 各带图标

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

### Requirement: E-12 单元格富文本编辑

表格单元格进入编辑态 SHALL 提供行内 markdown 能力：输入 `/` SHALL 打开锚定插入菜单，SHALL 支持 粗体、斜体、链接、行内代码 的源码写入，并 SHALL 在提交落定后按行内子集渲染（编辑态为原生 `<input>`，显示原始 markdown；渲染发生在落定后的单元格显示态）。提交时 SHALL 保持 GFM 单元格单行约束（不含换行与裸管道符）。Enter SHALL 提交，Tab SHALL 提交并移至右侧单元格，Esc SHALL 取消并还原，失焦 SHALL 提交。

#### Scenario: 单元格内斜杠菜单

- **WHEN** 用户在单元格编辑态输入 `/`
- **THEN** SHALL 出现锚定插入菜单，选中项插入后单元格仍保持单行

#### Scenario: 单元格内行内格式

- **WHEN** 用户在单元格编辑态输入 `**粗**`
- **THEN** 显示为粗体，源码为 `**粗**`

#### Scenario: 单元格提交/取消

- **WHEN** 用户在编辑态按 Enter / Esc
- **THEN** Enter 提交并落盘，Esc 还原到编辑前的内容

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

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素后提供可操作入口，支持：**替换标签**、**修改样式**、**修改属性**（`class` / `id`）、**删除元素**、**区域截图**（见 E-21）。HTML 的**源码编辑态**（CM6）SHALL 使用与 md 编辑态相同的选区轮盘；HTML **可视化编辑态**的元素工具条 SHALL 保持既有横向实现（`.html-edit-toolbar`），不改为轮盘。源码编辑态 SHALL NOT 渲染 `.html-edit-toolbar`。

入口 SHALL 跟随选中元素定位，且 SHALL NOT 遮挡被选中元素本身。

入口产生的改动 SHALL 折算回文档 `content`（样式写内联 `style`、属性写对应属性），并 SHALL 立即在渲染结果中可见。保存 SHALL 沿用 E-16 的清洗链路：写回文件不得残留 `data-cm-*` 属性、`cmid` 注释锚点、`contenteditable`、注入的运行时脚本/样式。

#### Scenario: HTML 源码编辑态使用轮盘

- **WHEN** 用户在 HTML 源码编辑态选中一段文字
- **THEN** SHALL 出现径向轮盘，`.html-edit-toolbar` 横向条节点数 SHALL 为 0

#### Scenario: HTML 源码编辑态加粗写入内容

- **WHEN** 用户在 HTML 源码编辑态通过轮盘加粗选中行
- **THEN** 文档 `content` SHALL 出现 `**` 包裹，渲染与分析链路 SHALL 不残留 `.html-edit-toolbar`

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

### Requirement: E-20 HTML 可视化编辑：拖拽移动节点

`.html` 可视化编辑态 SHALL 支持用户按住元素拖到另一个元素的位置，松手后该元素（含其子树）在文档中换到目标元素之前或之后。位移小于阈值（4px）时 SHALL 按点击处理，SHALL NOT 触发移动。

拖拽过程 SHALL 显示插入位置指示；落点为目标元素自身或其子孙时 SHALL 拒绝移动并保持文档不变。移动结果 SHALL 折算回 `content`，保存产物 SHALL NOT 残留编辑期属性或锚点。

#### Scenario: 把后一段拖到前一段之前

- **WHEN** 用户按住第二个 `<p>` 拖到第一个 `<p>` 的上半部并松手
- **THEN** 渲染结果里第二段 SHALL 排在前面，`content` 中两段顺序 SHALL 同步调换，且父容器与兄弟结构不受影响

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

MD 编辑态与阅读态的正文选区 SHALL 显示胶囊工具条；编辑态 SHALL 提供改写/翻译/润色，阅读态 SHALL 提供复制/解释/翻译。胶囊形状 SHALL 与文件类型 chip、活跃页签高亮一致。

**编辑态**的选区工具条 SHALL 为径向轮盘（Selection Roulette），SHALL NOT 再渲染横向 `.cm-floating-toolbar`：根环 SHALL 有 8 个扇区（按 12:00 起顺时针：智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色），每扇区 SHALL 显示 14px 图标与 11px 两字标签。轮盘圆心 SHALL 取鼠标落点（键盘选区取末端 client rect），SHALL 有 24px 圆心死区，420×420 包围盒 SHALL 夹进视口安全区。选区稳定 SHALL 至少 90ms 后才出现轮盘，SHALL NOT 在 `mouseup` 当场出现。

二级 / 三级选项 SHALL 只在父扇区方向就近展开成等宽扇形：每格 15°，环带 92–122px，纯图标 + `title`，总跨度 SHALL NOT 超过 136°；三级 SHALL 在原位替换第二层，圆心 SHALL 变为返回。颜色扇区 SHALL 展开为双圈：内圈文字色 9 格（默认 + 8，每格渲染着色字母 A，默认项加斜杠），外圈背景色 16 格（无 + 15，色块 16px）。

轮盘 SHALL 提供：行内代码、链接、分栏 1–5（各画栏数图标）、转换三层（段落/标题/列表/高亮/引用/代码块/表格/分割线，选项随光标块类型变化）、复制、文字色与背景色、缩进/减少缩进、清除格式、后退/前进、格式刷（圆心）、删除。格式类动作执行后 SHALL 保持展开；破坏性/历史/插入类执行后 SHALL 收起。滚轮或方向键 SHALL 在当前层移动高亮，`Enter` 执行；`Ctrl+F` / `⌘F` SHALL 在圆心展开过滤输入框；数字键 `1–8` SHALL 直接进入对应扇区；`Esc` SHALL 逐层后退。

格式刷 SHALL 读取当前选区的行内包装，之后每次新选区自动套用（幂等）并显示已刷次数；刷完 SHALL 仍展开轮盘；`Esc` 或再点圆心退出。清除格式 SHALL 只解包与选区相交的节点并保留链接，一次提交可撤销。后退/前进 SHALL 映射 CodeMirror 的 undo/redo，与 `Mod-z` / `Mod-Shift-z` 共用同一份历史。轮盘 SHALL 为 `role="menu"`，每扇区 `role="menuitem"` 且 `aria-label` 为中文名。

#### Scenario: 编辑态出现轮盘而非横条

- **WHEN** 用户在 markdown 编辑态选中一段文字并保持 120ms
- **THEN** SHALL 出现径向轮盘，8 个扇区可见，页面中 `.cm-floating-toolbar` 节点数 SHALL 为 0

#### Scenario: 圆心与越界夹取

- **WHEN** 用户用鼠标选中靠近窗口右下角的文字
- **THEN** 轮盘圆心 SHALL 与鼠标落点偏差 ≤1px（未被夹取时），整体包围盒 SHALL 完整落在视口内

#### Scenario: 就近扇形不绕整圈

- **WHEN** 用户悬停「格式」扇区
- **THEN** 展开的 6 项扇形总跨度 SHALL 不超过 136°，SHALL NOT 绕满整圈

#### Scenario: 三级原位替换

- **WHEN** 用户在「转换」中悬停「标题 ›」
- **THEN** 第二层 SHALL 在同一扇形区域替换为 H1–H6，圆心 SHALL 显示返回；按返回后 SHALL 回到第二层

#### Scenario: 颜色双圈

- **WHEN** 用户悬停「颜色」扇区
- **THEN** 内圈 SHALL 有 9 个字符 A 格，外圈 SHALL 有 16 个色块，两者同时可见

#### Scenario: 分栏与高亮写入源码

- **WHEN** 用户选择「分栏 3」并随后选择「警告」高亮
- **THEN** 文档源码 SHALL 含 `::: {.col-3}` 与 `> [!warning]`

#### Scenario: 格式刷跨选区幂等

- **WHEN** 用户在加粗选区点击圆心，再选中另一段并重复选中同一段
- **THEN** 两段 SHALL 都被加粗，已刷次数 SHALL 为 2，重复套用 SHALL NOT 叠加标记

#### Scenario: 清除格式保留链接

- **WHEN** 用户对含 `**粗**` 与 `[链接](url)` 的选区执行清除格式
- **THEN** 源码中 `**` 与 `mdb-color-` SHALL 消失，`[链接](url)` SHALL 保留

#### Scenario: 后退与快捷键共用历史

- **WHEN** 用户在轮盘点「后退」后按 `Mod-Shift-z`
- **THEN** 文档 SHALL 重做同一次改动（两者共用同一份历史）

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

### Requirement: 颜色面板二级保持

块菜单的颜色入口展开二级调色板后，指针离开父项 SHALL NOT 使调色板消失；调色板 SHALL 仅在选择颜色、按 Esc 或点击菜单外部时关闭。

#### Scenario: 指针移出父项后调色板仍在

- **WHEN** 用户展开颜色二级调色板后把指针移出该父项
- **THEN** 调色板 SHALL 仍然可见

#### Scenario: 点击外部关闭

- **WHEN** 调色板展开时用户点击菜单外部
- **THEN** 调色板 SHALL 关闭

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


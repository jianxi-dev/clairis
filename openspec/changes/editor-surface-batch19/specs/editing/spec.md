## MODIFIED Requirements

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

### Requirement: E-22 编辑态悬停提示胶囊化

界面中一切自绘悬停提示 SHALL 为胶囊形（圆角半径 ≥ 提示高度的一半）；SHALL NOT 使用系统原生的矩形 `title` 提示。编辑态的选区轮盘 SHALL 在每个扇区（根扇区、二级单元、色条）被悬停时显示其中文名称提示。同一类提示（按钮提示、轮盘扇区提示、页签名信息窗）SHALL 共用同一胶囊外壳常量，SHALL NOT 出现矩形外壳。

#### Scenario: 按钮提示为胶囊

- **WHEN** 用户把指针停在任一功能按钮上 600ms
- **THEN** SHALL 出现提示元素，其计算 `border-radius` SHALL ≥ 提示高度的一半
- **AND** 页面 SHALL NOT 弹出系统原生矩形提示

#### Scenario: 轮盘扇区显示提示

- **WHEN** 用户在 MD 编辑态唤出选区轮盘并把指针停在「转换」扇区上
- **THEN** SHALL 出现文案为「转换」的胶囊提示

#### Scenario: 同类提示外壳一致

- **WHEN** 分别悬停功能按钮、轮盘扇区与页签名
- **THEN** 三者提示外壳 SHALL 均为胶囊，计算 `border-radius` 均 ≥ 各自高度的一半，SHALL NOT 出现矩形外壳

### Requirement: E-8 编辑态与预览态同貌

编辑模式 SHALL 与预览模式呈现同一份排版。二者 SHALL 共享纸面宽度、内边距、纸面底色与投影、正文字体族、字号、行高、标题配色与阅读强调色；编辑态正文 SHALL 与预览正文同宽（同一窄栏），宽内容（表格/分栏/图片/媒体）SHALL 走满纸宽。

编辑模式 SHALL NOT 出现只有编辑器才有的外壳：行号槽、折叠箭头、活动行高亮。

语法高亮 SHALL 只用于代码 token，SHALL NOT 改写标题与正文的排版（不得给标题加下划线或覆盖字重）。

块级渲染 SHALL 与预览一致：

1. 连续 `>` 行 SHALL 渲染为**一张**引用卡片，行距与预览一致，不得逐行加纵向内边距。
2. `> [!TYPE]` 高亮块 SHALL 只有高亮块自身的一层卡片，不得再叠加引用底色。
3. 围栏代码块 SHALL 不因开启/闭合围栏行而多出空白行。
4. 缩进列表 SHALL 保持嵌套缩进与项目符号，不得把 `- ` 原样显示。

代码块、引用块与 mermaid 块在编辑态的左右边框 SHALL 与正文文本块的左右边框对齐，且三者彼此一致；宽度补偿 SHALL 通过块自身最大宽度 / 内边距实现，SHALL NOT 改动 `.cm-line` 的基础行宽。

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

## ADDED Requirements

### Requirement: 文本与脚本文件行号

编辑态对非 Markdown 的纯文本 / 脚本（代码）文件 SHALL 显示行号；Markdown 编辑态 SHALL NOT 显示行号槽（沿用 E-8）。行号槽宽度 SHALL 取设计系统间距 token，行号文字 SHALL 使用次级色且不参与文本选择。

#### Scenario: 文本与脚本文件显示行号

- **WHEN** 用户以编辑态打开一个 `.txt` 或 `.js` 文件
- **THEN** 行号槽节点数 SHALL ≥1，且每个可见行对应一个行号

#### Scenario: Markdown 编辑态无行号槽

- **WHEN** 用户以编辑态打开一个 `.md` 文件
- **THEN** 行号槽节点数 SHALL 为 0

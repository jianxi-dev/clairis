## MODIFIED Requirements

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。**标注**（13 个语义类型）SHALL 共享既有颜色编辑能力（9 格字体色 + 15 格背景色）；**高亮**（纯高亮块）SHALL 使用**独立 24 格色板**：字体 8 格 / 边框 8 格 / 填充 2×8 格（深档 8 + 中档 8），色值取豆包像素核准表（见下），SHALL NOT 复用 `mdb-bg-*` 文字背景板。旧色名（darkred / brown / olive / darkgreen / navy / indigo / slate / yellow / green / blue…）SHALL 在 `parseCalloutAttrs` 保留兼容映射，旧文档不失效。

**高亮 24 格色板（豆包像素核准，唯一真相源）**：

- 字体 8 格：默认 #ebebeb / 灰 #757575 / 红 #fa7873 / 橙 #f5a54a / 黄 #fcd456 / 绿 #6dd162 / 蓝 #71a0ff / 紫 #a472fc。
- 边框 8 格：无（斜线）#2d2d2d / 灰 #434343 / 红 #9e3836 / 橙 #bd7017 / 黄 #c7b302 / 绿 #339428 / 蓝 #2951a3 / 紫 #6532bd。
- 填充深档 8 格：无（斜线）#303031 / 深灰 #2b2b2b / 暗红 #4a1d1b / 暗橙 #57330a / 暗黄 #5c5514 / 暗绿 #1f471b / 暗蓝 #192a4c / 暗紫 #361d61。
- 填充中档 8 格：灰 #363636 / 灰 #3c3c3c / 红 #6b2827 / 橙 #845117 / 黄 #877b10 / 绿 #296b22 / 蓝 #213e78 / 紫 #4d2691。

块族名 SHALL 二分为「高亮」与「标注」两项：**高亮** SHALL 为无左边框、无标题栏、1px 全边框、4px 圆角、强叠底的纯高亮块；**标注** SHALL 为带 3px 左边框与标题栏的 13 语义类型 callout。斜杠菜单、块菜单「转为」、转换手柄菜单与选区轮盘四处入口 SHALL 只呈现这两项。四个入口选「高亮」SHALL 直落 `> [!highlight]`；选「标注」SHALL 展开 13 个语义类型。`> [!highlight]` 的 markdown 序列化格式 SHALL 与既有 callout 一致。

纯高亮块的工具条 SHALL 水平居中于块盒（中心偏差 ≤ 2px）并使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变。纯高亮颜色面板 SHALL 使用独立 24 格色板，自上而下 SHALL 为：字体颜色（8 格，字母 A 色块，行尾「随机」）、边框颜色（8 格）、填充颜色深档（8 格）、填充颜色中档（8 格）、恢复默认。**每行 SHALL 严格 8 格且 `flex-wrap: nowrap`，SHALL NOT 换行**。当前值对应的色块 SHALL 带 `data-active` 选中态。「随机」SHALL 在一次事务内同时更换边框与填充、二者 SHALL 属同一色相族、文字色 SHALL 保持不变；「恢复默认」SHALL 清空三色属性。字体色色块 SHALL 使用字母「A」字形（`FormatColorTextOutlined`），SHALL NOT 使用荧光笔字形；块菜单「颜色」行图标 SHALL 同为 `FormatColorTextOutlined`（A 字形），SHALL NOT 使用 `FontcolorOutlined`。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；标注填充 SHALL 为软色。

**面板触发与关闭**：块上方居中调色板图标 SHALL 在**鼠标滑入（pointerenter）时即展开**面板，SHALL NOT 要求先点击一次。面板 SHALL 只由 ① 点击面板外部 ② 按 Esc 关闭；「随机」「选色」「恢复默认」执行后 SHALL NOT 关闭面板。

**空态高度**：空 `> [!highlight]` 块 SHALL NOT 塌陷成细条；单行内容高度 SHALL 约 3.2em（≈52px @16px），空块 `min-height` SHALL ≥ 44px 且点击空态 SHALL 落入内部输入区（textarea）而非卡片容器。空块 SHALL 保留左侧 emoji、SHALL NOT 显示类型名标题栏、SHALL 有 1px 全边框 + 圆角 + 填充。

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

#### Scenario: 24 格色板数量与排布

- **WHEN** 用户打开纯高亮颜色面板
- **THEN** 面板 SHALL 含 4 行色板，各行色块数 SHALL 依次为 8 / 8 / 8 / 8；每行计算 `flex-wrap` SHALL 为 `nowrap`，行内色块右缘 SHALL NOT 换行到第二行；色块色值 SHALL 等于本要求色板表

#### Scenario: 当前值选中态

- **WHEN** 块首行含 `{bg=red border=red}` 时用户打开纯高亮颜色面板
- **THEN** 填充中档「红」与边框「红」两个色块 SHALL 带 `data-active` 选中态，其余色块 SHALL NOT

#### Scenario: 随机同时换边框与填充

- **WHEN** 在纯高亮颜色面板点击「随机」
- **THEN** 首行 `bg` 与 `border` SHALL 同时改变且色相相同，`text` SHALL 保持不变；面板 SHALL 保持打开；一次 ⌘Z SHALL 同时还原两项

#### Scenario: 选色与恢复默认不关闭

- **WHEN** 在纯高亮颜色面板点击一个色块，或点击「恢复默认」
- **THEN** 块颜色 SHALL 更新 / 三色属性清空，面板 SHALL 保持打开；按 Esc 或点击面板外部后 SHALL 关闭

#### Scenario: hover 即展开

- **WHEN** 用户把指针滑入纯高亮块上方居中的调色板图标（不点击）
- **THEN** 颜色面板 SHALL 展开；点击面板外部或按 Esc 后 SHALL 关闭

#### Scenario: 恢复默认

- **WHEN** 在纯高亮颜色面板点击「恢复默认」
- **THEN** 首行属性块 SHALL 为空，颜色回落类型 tone

#### Scenario: 字体色恢复字母 A

- **WHEN** 打开块菜单颜色面板的字体色行
- **THEN** 每个色块内 SHALL 渲染字母 A 字形，SHALL NOT 渲染荧光笔字形；色块容器计算 `justify-content` SHALL 为 `center`

#### Scenario: 颜色行图标为 A 字形

- **WHEN** 用户打开块菜单并查看「颜色」行
- **THEN** 该行图标 SHALL 为 `FormatColorTextOutlined`（A 字形），SHALL NOT 为 `FontcolorOutlined`

#### Scenario: 菜单图标分家与标注类型复用

- **WHEN** 打开块菜单「转为」网格与「标注」浮层
- **THEN** 高亮格与标注格图标 SHALL 不同；标注浮层 13 项的 emoji SHALL 与新增菜单对应项一致

#### Scenario: 新增菜单命名

- **WHEN** 打开新增手柄菜单
- **THEN** 标注项标签 SHALL 为「标注」，菜单中 SHALL NOT 出现标签为「高亮」的标注项

#### Scenario: 类型切换色相映射

- **WHEN** 用户把 NOTE 块的填充改为红色后切换到 TIP
- **THEN** 填充色相 SHALL 仍为红

#### Scenario: 转换菜单高亮直落 highlight

- **WHEN** 用户在转换手柄菜单点击「高亮」
- **THEN** 块首行 SHALL 变为 `> [!highlight]`，SHALL NOT 变为 `> [!NOTE]`

#### Scenario: 空高亮块不塌陷

- **WHEN** 用户插入一个空的 `> [!highlight]` 块
- **THEN** 块计算高度 SHALL ≥ 44px（单行内容时约 3.2em），SHALL NOT 呈现为一条细横线；点击块内空区 SHALL 落入内部输入区，块左侧 SHALL 显示 emoji，SHALL NOT 显示类型名标题栏

#### Scenario: 旧色名兼容

- **WHEN** 打开含 `> [!highlight]{bg=darkred border=brown}` 的旧文档
- **THEN** 块 SHALL 正常渲染（色值经兼容映射回落），SHALL NOT 因未知色名而丢失颜色或报错

### Requirement: E-44 图片裁剪坐标系与保存可靠性

进入图片裁剪前 SHALL 等待图片加载完成（`img.complete` 或 load 事件），2s 超时 SHALL 放弃并提示，SHALL NOT 在 `scale <= 0` 时静默失败。框选、拖动与写回 SHALL 使用同一显示坐标系。编辑态已裁剪图片 SHALL 统一用「外盒 `overflow:hidden`（尺寸 = 可见裁剪显示尺寸）+ 内图按整图缩放平移」结构渲染；`width` 属性 SHALL 表示可见裁剪宽度，`scale` SHALL 等于 `width / cropWidth`；无 `width` 时 `scale` SHALL 由整图当前显示宽度与自然宽度之比求得。保存 SHALL 把显示矩形换算为原图像素矩形一次，并 SHALL 同步写回可见 `width/height`（取整），使确认前后显示宽高比严格为 1。保存 SHALL 同时由显式保存按钮与 window 级 `pointerup` 触发，SHALL NOT 依赖裁剪框存活；Esc SHALL 取消且不写回。

**裁剪态交互（quiet 式）**：进入裁剪态 SHALL 显示**整图**（非框内预览），框外区域 SHALL 覆盖压暗蒙层（`rgba(0,0,0,0.3)` 四块暗罩）；裁剪框 SHALL 为 1px 白色虚线框，含 8 个 24px 热区控制点与 2 个移动热区。拖动控制点或裁剪框本体 SHALL 改选区，蒙层 SHALL 随选区实时更新。点击「确定」SHALL 才写回 `crop` 与 `width/height`；SHALL NOT 在拖动过程中写回。**二次进入裁剪** SHALL 显示整图 + 上次裁剪矩形（框内亮、框外蒙层），SHALL NOT 只显示框内预览。

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

#### Scenario: 裁剪态显示整图与蒙层

- **WHEN** 用户进入裁剪态
- **THEN** 页面 SHALL 显示整图（非框内预览），框外区域 SHALL 有压暗蒙层，裁剪框为 1px 白色虚线框；拖动控制点期间 SHALL NOT 写回源码

#### Scenario: 二次进入显示上次矩形

- **WHEN** 用户对同一张图片再次进入裁剪态
- **THEN** 页面 SHALL 显示整图 + 上次裁剪矩形（框内亮、框外蒙层），矩形位置 SHALL 与上次保存的 `crop` 一致

### Requirement: E-39 图片内联裁剪

图片裁剪 SHALL 在图片上直接进行：显示裁剪框与边角手柄，拖动时实时显示裁剪结果，松手写回 `crop`；SHALL NOT 弹出独立对话框。把裁剪框拖回整图范围 SHALL 移除 `crop` 属性。

图片工具条 SHALL 在已有 `crop` 属性时提供「重置图片」按钮；点击 SHALL 清除 `crop` 并按原分数还原显示尺寸回整图。无 `crop` 属性时该按钮 SHALL NOT 出现（或禁用）。

#### Scenario: 无对话框与按钮

- **WHEN** 用户点击图片工具条的裁剪
- **THEN** 页面 SHALL NOT 出现裁剪对话框，确认/取消/还原按钮数 SHALL 严格等于 0

#### Scenario: 实时裁剪与恢复

- **WHEN** 用户拖动裁剪框后松手，再拖回整图范围
- **THEN** 显示区域与 `crop` 数值差 SHALL ≤ 2px，图片下方空白高度 SHALL ≤ 8px；拖回整图后源码 `crop` 属性 SHALL 变为不存在

#### Scenario: 取消恢复原状

- **WHEN** 用户在裁剪中按 Esc
- **THEN** 图片 SHALL 恢复裁剪前状态，且无残留裁剪框

#### Scenario: 工具条重置图片

- **WHEN** 用户选中一张已裁剪图片并点击工具条「重置图片」
- **THEN** 源码 `crop` 属性 SHALL 被移除，图片显示尺寸 SHALL 按原分数还原回整图尺寸；未裁剪图片的工具条 SHALL NOT 出现该按钮

### Requirement: E-24 图片块编辑

MD 编辑态的图片 SHALL 在被点击后进入选中态：显示选中框与四角圆点，并在图片上方居中显示工具条，按钮顺序 SHALL 为「AI / 裁剪 / 评论 ｜ 左对齐 / 居中对齐 / 右对齐 ｜ 剪切 / 复制 / 删除」。图片 SHALL 以圆角呈现，圆角取设计系统卡片级数值。双击图片 SHALL 进入最大化查看，Esc、再次双击或点击遮罩 SHALL 退出且不改动文档。

图片 SHALL 默认居中；仅当用户显式选择左对齐或右对齐时才写出对齐标记，选回居中 SHALL 移除该标记。编辑态的尺寸与对齐 SHALL 以图片属性语法随图片一起保存，SHALL NOT 使用 HTML 注释，SHALL NOT 把标记写入图片路径。宽度与高度 SHALL 支持左右边、上下边与四角拖拽调整，范围为 40–2000px。

图片 SHALL 支持从剪贴板粘贴插入：图片字节写入文档同级 `assets/` 后插入引用，单张超过 20MB SHALL 拒绝并提示。裁剪 SHALL 为无损显示裁剪：只保存裁剪矩形并裁切显示，SHALL NOT 改写图片文件或图片引用，SHALL 支持反复调整与恢复整图。图片下方 SHALL 提供描述行：无描述时显示占位「输入图片描述」，输入提交后写入图片 title，再次点击描述行 SHALL 收起显示。

工具条 9 个按钮 SHALL 各渲染可绘制图标；插入的图片 SHALL 完成 src 加载（`naturalWidth` 大于 0）；剪切按钮 SHALL 使用通用剪切图形，其 path SHALL 与裁剪按钮不同。

**放大层工具条**：双击放大的查看层工具条 SHALL 在既有 4 按钮（旋转 / 下载 / 恢复原始尺寸 / 关闭）基础上补「重置图片」，与图片工具条按钮语义一致；「重置图片」SHALL 清除 crop 并还原显示尺寸回整图。

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

#### Scenario: 放大层工具条含重置图片
- **WHEN** 用户双击一张已裁剪图片进入放大查看层
- **THEN** 工具条 SHALL 含旋转 / 下载 / 恢复原始尺寸 / 重置图片 / 关闭；点击「重置图片」后 `crop` SHALL 被移除且显示尺寸回整图

#### Scenario: 插入图片可见
- **WHEN** 用户插入一张图片
- **THEN** 编辑态 `img` 的 `naturalWidth` SHALL 大于 0
#### Scenario: 剪切与裁剪图标不同
- **WHEN** 用户打开图片工具条
- **THEN** 剪切按钮图标 path SHALL 与裁剪按钮图标 path 不同
#### Scenario: 双击最大化
- **WHEN** 用户双击图片后按 Esc
- **THEN** 出现遮罩并在 Esc 后消失，文档内容不变（A-3.6）

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

**对齐整体校准（本批收口）**：

- 表格：编辑态 `.cm-table-wrap` SHALL 有 `max-width` 约束，表格渲染宽度 SHALL NOT 超过正文纸宽（宽内容走满纸宽，但不得超出）。
- 有序列表：编辑态有序 marker（`.cm-list-marker`）SHALL 与无序 marker 缩进一致（补负外边距），编辑态与预览态左缘 SHALL 对齐。
- 引用块：编辑态引用块左右缘 SHALL 与预览态一致（`max-width` 取 `calc(var(--type-measure) + 2em + 2px)`）。
- 代码块：编辑态代码块纵向内边距 SHALL 与预览态统一。

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

#### Scenario: 表格不超正文纸宽

- **WHEN** 文档含一个宽表格，用户进入编辑模式
- **THEN** 表格渲染宽度 SHALL ≤ 正文纸宽（`.cm-table-wrap` 计算 `max-width` 生效），SHALL NOT 超出正文右缘

#### Scenario: 有序列表与无序缩进一致

- **WHEN** 文档含同级有序列表与无序列表，用户进入编辑模式
- **THEN** 有序 marker 与无序 marker 的左缘 x 差 SHALL ≤ 2px，且与预览态左缘差 SHALL ≤ 2px

#### Scenario: 引用块编辑态与预览态同缘

- **WHEN** 文档含引用块，用户分别在编辑态与预览态测量其左右缘
- **THEN** 编辑态引用块左缘 x 与预览态差 SHALL ≤ 2px，右缘 x 差 SHALL ≤ 2px

#### Scenario: 代码块纵向内边距与预览统一

- **WHEN** 文档含围栏代码块，用户分别在编辑态与预览态测量代码块上下内边距
- **THEN** 两者差 SHALL ≤ 2px

### Requirement: E-1 源码模式

应用 SHALL 提供预览与源码模式的一键切换；切换 SHALL 保留编辑状态（不 remount 编辑器实例，undo 栈、选区、光标位置均保留）。

源码模式 SHALL 为可切换开关：格头 ⋯ 菜单的「源码模式」项在选中态 SHALL 显示对勾 ✓ 且 `aria-pressed` 为 `true`；再次点击 SHALL 取消选中并回到编辑模式（`aria-pressed` 回到 `false`）。

#### Scenario: 模式切换保留编辑状态

- **WHEN** 用户在编辑态已输入内容并产生 undo 历史后切换到源码模式，再切回
- **THEN** 编辑器内容、选区与 undo 历史 SHALL 保持不变（编辑器实例未重建）

#### Scenario: 源码模式对勾选中态

- **WHEN** 用户点击格头 ⋯ 菜单的「源码模式」
- **THEN** 该菜单项 SHALL 显示对勾 ✓ 且 `aria-pressed` 为 `true`；再次点击后对勾消失、`aria-pressed` 为 `false`，模式回到编辑

### Requirement: E-17 块手柄召唤区域与滑入菜单

MD 编辑态的块手柄 SHALL 仅在指针位于正文左侧四分之一区域或手柄自身时召唤；指针位于其余区域 SHALL NOT 显示手柄。非空块手柄滑入后 SHALL 自动显示块菜单。空行「+」手柄 SHALL 只在按压时打开插入菜单，指针悬停 SHALL NOT 打开转换菜单。

转换手柄的二级菜单（对齐与缩进、在下方添加行）显示后，指针移出「父菜单 ∪ 二级面板」并集时 SHALL 自动消失；菜单栈打开期间 SHALL 进入全局禁召唤会话，指针在下层文字移动 SHALL NOT 触发新的新增 / 转换手柄，栈关闭后恢复召唤。mermaid 块手柄 SHALL 以块装饰的屏幕矩形为锚，SHALL NOT 停在其边框右上角；「使用图标增强表现」等含图标增强语法的小节 SHALL 能识别出手柄；「伪动画时间轴」展开的转换菜单垂直中心与手柄中心偏差 SHALL ≤2px。图片 / 视频转换手柄 SHALL 显示六点拖拽手柄（含四点），显示位置与标题手柄对齐（同一召唤区与中心线，纵向中心差 ≤2px）。

**纯高亮颜色面板触发**：块上方居中调色板图标 SHALL 由鼠标滑入（pointerenter）即展开颜色面板，SHALL NOT 要求点击；面板打开期间 SHALL 屏蔽选区轮盘抢触发。

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

#### Scenario: 高亮面板 hover 展开不抢轮盘

- **WHEN** 用户把指针滑入纯高亮块的调色板图标
- **THEN** 颜色面板 SHALL 展开，且选区轮盘 SHALL NOT 同时出现

### Requirement: E-34 视频块布局

MD 编辑态的视频块 SHALL 渲染为可播放的 `<video controls>`，默认宽度约为行宽的 2/3，并 SHALL 按图片属性语法支持 `align` 与 `width`。尺寸调整 SHALL 复用图片的 8 向 handle 与 `applyImageSize`。块手柄 SHALL 按引用扩展名显示 `VideoOutlined` / `AudioOutlined` 图标。

**首帧 poster**：未播放的视频块 SHALL 显示首帧 poster（取帧），SHALL NOT 呈现黑屏；取帧失败 SHALL 回落到类型色占位而非黑屏。

#### Scenario: 视频可播放且默认 2/3 宽

- **WHEN** 用户打开含视频块的文档
- **THEN** `video.controls` SHALL 为 `true`，容器宽与行宽之比 SHALL 约等于 2/3

#### Scenario: 拖 handle 调宽

- **WHEN** 用户拖动视频块手柄
- **THEN** 容器宽度 SHALL 变化

#### Scenario: 视频手柄图标

- **WHEN** 用户悬停视频块手柄
- **THEN** 手柄 `data-icon` SHALL 为 `VideoOutlined`

#### Scenario: 未播放显示首帧

- **WHEN** 用户打开含视频块的文档且视频未播放
- **THEN** 视频块 SHALL 显示首帧画面（poster 或取帧），SHALL NOT 为黑屏

## ADDED Requirements

### Requirement: 内嵌文件三视图交互

Markdown 编辑态的内嵌文件块 SHALL 支持三视图：`embed`（文本视图）/ `card`（卡片视图）/ `preview`（预览视图）。工具条 SHALL 以三个图标切换（列表 / 卡片 / 图片，顺序固定），当前视图 SHALL 高亮。

各视图点击语义 SHALL 如下：

- `embed`（文本视图）：鼠标滑入显示工具条，点击文件名 SHALL 打开文件。
- `card`（卡片视图）：单击显示工具条，再点文件名 SHALL 打开；SHALL NOT 单击即打开。
- `preview`（预览视图）：单击先选中，再点文件名 SHALL 打开；SHALL NOT 单击即打开。

内嵌块头部 `.cm-embed-name` 的 click SHALL NOT 无条件劫持为打开（`openInNewTab`）；SHALL 按当前视图的点击语义分发。

#### Scenario: 三图标切换

- **WHEN** 用户选中一个内嵌文件块并查看工具条
- **THEN** 工具条 SHALL 含三个图标（列表 / 卡片 / 图片），顺序固定；点击任一图标 SHALL 切换对应视图，当前视图图标 SHALL 高亮

#### Scenario: 文本视图点击打开

- **WHEN** 内嵌块处于文本视图，用户鼠标滑入后点击文件名
- **THEN** 工具条 SHALL 显示，文件 SHALL 被打开

#### Scenario: 卡片视图单击不打开

- **WHEN** 内嵌块处于卡片视图，用户单击卡片
- **THEN** 工具条 SHALL 显示，文件 SHALL NOT 被打开；再次点击文件名后 SHALL 打开

#### Scenario: 预览视图先选中再打开

- **WHEN** 内嵌块处于预览视图，用户单击预览区
- **THEN** 该块 SHALL 进入选中态，文件 SHALL NOT 被打开；再次点击文件名后 SHALL 打开

### Requirement: 模式切换保留滚动位置

edit / preview / source 三种模式之间切换时，内容区 SHALL 保留当前阅读位置，SHALL NOT 滚回顶部。位置映射 SHALL 基于「当前视口中心行的文档偏移」（行锚点），切回时按同一偏移恢复；SHALL NOT 依赖 `scrollTop` 像素值（预览层重建会导致高度塌陷、像素值被夹到 0）。

#### Scenario: 编辑态切预览不回顶

- **WHEN** 用户在编辑态滚动到文档中部后切到预览态
- **THEN** 预览态 SHALL 定位到与切换前同一文档偏移（视口中心行差异 ≤ 2 行），SHALL NOT 回到顶部

#### Scenario: 预览态切编辑不回顶

- **WHEN** 用户在预览态滚动到文档中部后切到编辑态
- **THEN** 编辑态 SHALL 定位到与切换前同一文档偏移，SHALL NOT 回到顶部

#### Scenario: 源码模式往返不回顶

- **WHEN** 用户在编辑态滚动到中部，切到源码模式再切回编辑
- **THEN** 编辑态 SHALL 回到切换前的文档偏移，SHALL NOT 回到顶部

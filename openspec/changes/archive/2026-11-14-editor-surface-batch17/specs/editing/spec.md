## ADDED Requirements

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

图片工具条的描述输入框 SHALL 默认隐藏；点击「添加描述」SHALL 切换为编辑态并显示输入框，再次点击或提交 SHALL 收起。描述按钮的图标与文字 SHALL 贴合。

#### Scenario: 默认隐藏

- **WHEN** 用户选中一张图片
- **THEN** 描述输入框的 `display` SHALL 为 `none`

#### Scenario: 点击添加描述后显示

- **WHEN** 用户点击「添加描述」
- **THEN** 描述输入框的 `display` SHALL 不为 `none`

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

## MODIFIED Requirements

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮；每个单元 SHALL 只显示图标，SHALL NOT 显示文字标签。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 颜色 与 合并后的「对齐与缩进」入口——缩进（增加 / 减少）与对齐（左 / 中 / 右）SHALL 收在同一个入口的二级菜单内，SHALL NOT 各占一行。「对齐与缩进」行 SHALL 显示图标；二级菜单内的对齐三项 SHALL 各带图标。缩进图标 SHALL 使用语义正确的缩进/反缩进图形。颜色 SHALL 使用共享调色板并在触发行下方展开，指针从行移入面板 SHALL NOT 关闭。菜单项图标 SHALL 为 20px，行高 SHALL 为 36px，菜单宽 SHALL 为 176px；新增手柄菜单与转换手柄菜单 SHALL 共用该宽度常量。新增手柄菜单的「插入 CSS」行 SHALL 渲染 `CssOutlined` 图标，图标边界框宽高 SHALL 大于 0。

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

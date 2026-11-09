## MODIFIED Requirements

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

### Requirement: 选区浮动工具条

MD 编辑态的正文选区 SHALL 显示径向轮盘（Selection Roulette），SHALL NOT 渲染横向 `.cm-floating-toolbar`（HTML 源码编辑态除外，见 E-19）。

轮盘 SHALL 为 420×420 的 SVG 扇形盘面，根环 SHALL 有 8 个 45° 扇区（按 12:00 起顺时针：智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色），根环内半径 30px、外半径 86px、扇区间隙 0.35°；每扇区 SHALL 显示 14px 图标与 11px 两字标签，标签中心位于半径 60px。圆心 SHALL 为独立按钮（格式刷 / 返回），半径 31px。

轮盘圆心 SHALL 取鼠标落点（键盘选区取选区末端 client rect），整轮包围盒 SHALL 夹进视口安全区。按住鼠标拖选期间轮盘 SHALL NOT 出现；选区稳定 SHALL 至少 90ms 后才出现，SHALL NOT 在 `mouseup` 当场出现；圆心 SHALL NOT 设置死区。

二级选项 SHALL 只在父扇区方向就近展开成等宽扇形：环带 92–122px，每格固定 15°、间隙 0.35°，纯图标 + `title`，项少不摊开。分组项（标题 / 列表 / 高亮）的三层 SHALL 画在二层外环 126–152px，使用同一套 15° 扇形、以被点击二层区块的中心角为中心，SHALL NOT 替换二层；三层出现时二层 SHALL 保留并降到 0.7 不透明度，圆心 SHALL 变为 `‹` 返回。展开下级后根环 SHALL 降到 0.7 不透明度。

颜色扇区 SHALL 展开为双圈窄色条：内圈 90–106px、文字色 9 段（默认 + 8，每段渲染平切于圆的字母 A，默认项加斜杠），外圈 111–127px、背景色 16 段（无 + 15）；SHALL NOT 使用独立色板浮层或色卡。点击色条 SHALL 立即套用且轮盘保持展开。

轮盘 SHALL 提供：行内代码、链接、分栏 1–5（各画栏数图标）、转换二层（代码块 / 表格 / 标题 › / 列表 › / 高亮 › / 引用 / 分割线；光标已在标题时多「正文」）、标题三层 H1–H6、列表三层（无序 / 有序 / 待办）、高亮三层五类（提示 / 信息 / 注意 / 警告 / 危险，分别落 `> [!tip]` / `[!info]` / `[!note]` / `[!warning]` / `[!danger]`）、复制、文字色与背景色、缩进 / 减少缩进、清除格式、后退 / 前进、格式刷、删除。格式二层顺序 SHALL 为：链接 / 下划线 / 斜体 / 加粗 / 行内代码 / 删除线。对齐二层 SHALL 为左 / 中 / 右 / 增加缩进 / 减少缩进五项。

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
- **THEN** H1–H6 SHALL 出现在 126–152px 外环，二层 SHALL 仍可见并降到 0.7 不透明度，圆心 SHALL 显示 `‹`

#### Scenario: 颜色双圈

- **WHEN** 用户点击「颜色」扇区
- **THEN** 内圈 SHALL 有 9 个字母 A 色段，外圈 SHALL 有 16 个背景色段，两者同时可见且无浮层色板

#### Scenario: 标注类型齐备

- **WHEN** 用户在「转换」中展开「高亮」与「标题」
- **THEN** 高亮三层 SHALL 有提示 / 信息 / 注意 / 警告 / 危险 5 项，标题三层 SHALL 有一级至六级 6 项

#### Scenario: 分栏与高亮写入源码

- **WHEN** 用户选择「分栏 3」并随后选择「注意」高亮
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
- **THEN** 三层 SHALL 画在 126–152px 外环并保留二层（0.7），圆心 SHALL 显示返回；按返回后 SHALL 回到二层

#### Scenario: 选中文字出现工具条

- **WHEN** 用户在 MD 编辑态选中一段文字
- **THEN** SHALL 出现径向轮盘（不是横向 12 项工具条），含 8 个根扇区与圆心

#### Scenario: 图标按钮生效于选区

- **WHEN** 用户选中文字并点击「格式」里的加粗
- **THEN** 选区文字 SHALL 被 `**…**` 包裹，未选中部分 SHALL 不受影响

#### Scenario: 未选中调整整块

- **WHEN** 光标在区块内且未选中文字，用户点击「对齐」里的居中
- **THEN** 该区块 SHALL 整体应用居中对齐

### Requirement: E-19 HTML 可视化编辑工具条

`.html` 文件的编辑态 SHALL 在用户选中元素或文字后提供横向工具条，SHALL NOT 使用选区轮盘。工具条按节点类型分化：

- 文字节点与文字选区 SHALL 显示：AI、字号、加粗、斜体、下划线、删除线、链接、对齐、文字颜色、截图、删除。
- 非文字区块 SHALL 显示：AI、背景色、边框色、删除。

HTML 的**源码编辑态**（CM6）SHALL 使用横向文字工具条（`.cm-floating-toolbar`），SHALL NOT 渲染选区轮盘；该横条 SHALL 提供 AI 改写 / 翻译 / 润色与加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接 / 对齐 / 文字颜色 / 清除格式，按钮 SHALL 作用于当前选合并写回源码。

工具条 SHALL 跟随选中元素 / 选区定位且 SHALL NOT 遮挡目标。改动 SHALL 折算回 `content` 并立即可见；保存 SHALL 零残留（无 `data-cm-*`、`cmid`、`contenteditable`、注入脚本/样式）。

#### Scenario: HTML 文字节点显示文字工具条

- **WHEN** 用户在 HTML 可视化编辑态点选一个 `<p>`
- **THEN** 工具条 SHALL 含 AI、字号、粗体、斜体、下划线、删除线、链接、对齐、文字颜色、删除，且 SHALL NOT 含背景色与边框色

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

拖拽越过阈值后 SHALL 显示跟随指针的元素幽灵（半透明、不接收指针事件），原元素 SHALL 降透明度；落点指示 SHALL 稳定，指针在目标中线附近移动时 SHALL NOT 来回切换 before / after。落点为目标元素自身或其子孙时 SHALL 拒绝移动并保持文档不变。移动结果 SHALL 折算回 `content`，保存产物 SHALL NOT 残留编辑期属性或锚点。

#### Scenario: 把后一段拖到前一段之前

- **WHEN** 用户按住第二个 `<p>` 拖到第一个 `<p>` 的上半部并松手
- **THEN** 渲染结果里第二段 SHALL 排在前面，`content` 中两段顺序 SHALL 同步调换，且父容器与兄弟结构不受影响

#### Scenario: 拖拽有跟随反馈

- **WHEN** 用户按住一个元素移动超过 4px
- **THEN** SHALL 出现跟随指针的幽灵节点，原元素 SHALL 变半透明

#### Scenario: 落点指示稳定

- **WHEN** 用户把指针停在目标元素中线附近小幅移动
- **THEN** 落点 before / after SHALL 保持不抖动

#### Scenario: 微小位移仍算点击

- **WHEN** 用户在元素上按下并只移动 3px 就松手
- **THEN** 文档 SHALL 保持不变，选中状态 SHALL 按点击处理

#### Scenario: 拒绝把自己拖进自己的子树

- **WHEN** 用户把一个容器元素拖到它自己的子元素上松手
- **THEN** `content` SHALL 保持不变，文档结构 SHALL NOT 出现节点丢失

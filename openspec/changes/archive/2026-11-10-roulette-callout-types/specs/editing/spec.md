## MODIFIED Requirements

### Requirement: 选区浮动工具条

MD 编辑态的正文选区 SHALL 显示径向轮盘（Selection Roulette），SHALL NOT 渲染横向 `.cm-floating-toolbar`（HTML 源码编辑态除外，见 E-19）。

轮盘 SHALL 为 420×420 的 SVG 扇形盘面，根环 SHALL 有 8 个 45° 扇区（按 12:00 起顺时针：智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色），根环内半径 30px、外半径 86px、扇区间隙 0.35°；每扇区 SHALL 显示 14px 图标与 11px 两字标签，标签中心位于半径 60px。圆心 SHALL 为独立按钮（格式刷 / 返回），半径 31px。

轮盘圆心 SHALL 取鼠标落点（键盘选区取选区末端 client rect），整轮包围盒 SHALL 夹进视口安全区。按住鼠标拖选期间轮盘 SHALL NOT 出现；选区稳定 SHALL 至少 90ms 后才出现，SHALL NOT 在 `mouseup` 当场出现；圆心 SHALL NOT 设置死区。

二级选项 SHALL 只在父扇区方向就近展开成等宽扇形：环带 92–122px，每格固定 15°、间隙 0.35°，纯图标 + `title`，项少不摊开。分组项（标题 / 列表 / 高亮）的三层 SHALL 画在二层外环 126–152px，使用同一套 15° 扇形、以被点击二层区块的中心角为中心，SHALL NOT 替换二层；三层出现时二层 SHALL 保留并降到 0.7 不透明度，圆心 SHALL 变为 `‹` 返回。展开下级后根环 SHALL 降到 0.7 不透明度。

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
- **THEN** H1–H6 SHALL 出现在 126–152px 外环，二层 SHALL 仍可见并降到 0.7 不透明度，圆心 SHALL 显示 `‹`

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

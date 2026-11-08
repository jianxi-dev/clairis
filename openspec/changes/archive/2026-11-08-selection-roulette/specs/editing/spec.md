## MODIFIED Requirements

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


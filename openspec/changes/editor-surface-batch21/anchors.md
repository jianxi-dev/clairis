# 验收锚点 — editor-surface-batch21

锚点来源：spec issue #1038（用户故事 1–18 + 阻塞缺陷 #1034）+ design.md D1–D4 与「数据面」；原型引用 `docs/design/explorations/frontmatter-search/prototype.html`。R-1…R-15 对应 tasks.md 1.1–4.5。断言值取自 #1038 明示数值、原型条款、主规格条款或一手代码观察；视觉观感类一律用可机检的状态或计算样式，不写未定义的像素值。

## R-1 字段行胶囊化 + 空值无占位 + 叉号删除 + 锁定锁图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 字段名输入框计算高度为单行（不随内容撑高）的字段行数下限 | 1 | #1038 故事2 / prototype §字段行操作 |
| A-1.2 | exact | 空值字段的值节点内 `—` / 占位横线出现次数 | 0 | #1038 故事3 / code obs ValueView ~:498 |
| A-1.3 | exact | 行尾删除控件为叉号（关闭语义）而非垃圾桶的节点数下限 | 1 | #1038 故事5 / design D1 |
| A-1.4 | state-machine | 锁定字段（created/updated）：显示锁图标，且删除/改名入口节点数 | 锁定→锁图标存在、入口 0 | doc-property-panel P-6 / #1038 故事7 |
| A-1.5 | exact | 单个字段胶囊内 DOM 顺序为「类型图标 → 类型名 → 字段名 → 值 → 叉号」 | 1 | #1038 用户截图 / prototype §字段行操作 |

## R-2 属性面板圆角卡片化 + 宽度对齐正文测量宽度

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 面板卡片计算 `border-radius` > 0 | 1 | #1038 故事6 / 设计系统 §圆角 |
| A-2.2 | exact | 面板卡片宽度与 `--type-measure` 之差（px，容差） | ≤2 | reading A-10 / design D1 |
| A-2.3 | state-machine | 视口 1280/900/640/300 四档：卡片宽度跟随正文且页面横向溢出宽度 | 变化→溢出 0 | #1038 Testing Decisions |
| A-2.4 | exact | 300px 视口下页面横向溢出宽度（px） | 0 | #1038 故事6、17 |

## R-3 控件区拖拽添加字段

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 点「添加字段」→ 控件区出现；拖入落点 → 对应类型空字段出现并进入字段名编辑态 | 展开→插入 | #1038 故事1 / prototype §决策 |
| A-3.2 | exact | 新字段类型与所拖控件类型一致的布尔 | 1 | #1038 故事1 |
| A-3.3 | state-machine | 插入后一次 Ctrl+Z 回到初始态（frontmatter 文本相等） | 插入→撤销还原 | #1038 Testing Decisions |

## R-4 全选按钮改全选/反选二态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 3 个可选字段行时连点两次：选中集合由「全部」变为「补集」 | 全选→反选 | #1038 故事8 |
| A-4.2 | exact | 全选/反选均排除标题与标签后的可选字段数 = 选中集合大小 | 1 | doc-property-panel P-4 |
| A-4.3 | exact | 按钮文案在「全选」「反选」两取值间切换 | 2 | #1038 故事8 |

## R-5 新建字段按钮位次

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | B 模式新建字段按钮在标题右侧按钮区的索引 | 0 | #1038 故事10 |
| A-5.2 | exact | A 模式新建字段按钮为其按钮区末位索引 | 1 | #1038 故事10 |
| A-5.3 | exact | 两种模式下其余按钮相对顺序一致的布尔 | 1 | #1038 故事10 |

## R-6 时间字段选择器可选时间（gated）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | 日期/日期时间字段值编辑器可选择到时间分量（小时/分钟） | 打开→可选时间 | #1038 故事4 / Open Question 2 |
| A-6.2 | exact | 选定 14:30 后 YAML 写回含时间字面量的布尔 | 1 | doc-property-panel P-3 |

## R-7 模板内置「通用」字段类型被别称覆盖（#1034，blocking）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | state-machine | 套用内置「通用」模板后，模板定义类型优先于别称推断（不被改写） | 套用→类型保持 | issue #1034 / propTemplates.ts:152-157 |
| A-7.2 | exact | 模板定义类型与实际渲染类型不一致的字段数 | 0 | issue #1034 |
| A-7.3 | state-machine | 先加失败用例（红）→ 修复后转绿 | 红→绿 | #1038 Testing Decisions |

## R-8 多文件拖入打开 + 自动魔法布局 + 一次性动效

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | 一次拖入 N 个支持文件 → N 个页签/栏全部打开 | 拖入→N 全开 | #1038 故事11 |
| A-8.2 | exact | 含一个不支持文件时整体不打开（all-or-nothing）的被拒文件数 | 0 | #1038 Implementation Decisions |
| A-8.3 | state-machine | 自动布局动效类出现一次并在结束后移除 | 出现→移除 | #1038 Testing Decisions |
| A-8.4 | exact | 布局结果符合既有自动布局形状规则（栏形与 navigation 一键自动布局一致） | 1 | navigation 一键自动布局栏目 |

## R-9 MD 编辑态行内代码显示

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 编辑态行内代码计算 background/圆角/`font-family` 与预览态一致的布尔 | 1 | #1038 故事12 / editing E-8 |
| A-9.2 | state-machine | 先写失败用例（红）→ 修复后转绿 | 红→绿 | #1038 Testing Decisions |

## R-10 视频串台

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | state-machine | 同格先后打开两个不同视频 → 显示的 URL/标题 = 最近打开者 | 切换→源更新 | #1038 故事13 / file-management C-6 |
| A-10.2 | exact | 两个不同视频路径渲染的 `<video>` `src` 不相等的布尔 | 1 | #1038 故事13 |
| A-10.3 | state-machine | 先复现（红）→ 修复（绿） | 红→绿 | #1038 Further Notes |

## R-11 预览态选区工具条对齐鼠标落点 + 视口钳制

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 工具条水平中心与鼠标落点 x 的偏差上限（px） | 4 | #1038 故事15 / Testing Decisions |
| A-11.2 | exact | 近右缘时工具条右缘 ≤ 视口宽且左缘 ≥ 0 的布尔 | 1 | #1038 故事15 |
| A-11.3 | exact | 工具条下缘位于选区上缘之上（top 关系）的布尔 | 1 | #1038 故事15 |
| A-11.4 | exact | 无鼠标落点时工具条回落对齐选区中心的布尔 | 1 | design D4 |

## R-12 大纲拖动轨迹 + 正文顺序同步 + 同级 H 徽标仅首个且弱化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | state-machine | 拖动大纲条目期间出现轨迹元素（ghost/占位） | 拖动→轨迹出现 | #1038 故事16 |
| A-12.2 | state-machine | 松手后正文顺序与新大纲顺序一致 | 松手→正文同步 | #1038 故事16 / Open Question 3 |
| A-12.3 | exact | 三个连续同级二级标题中渲染 `H2` 徽标的标题数 | 1 | #1038 故事16 |
| A-12.4 | exact | 同级 H 徽标计算 `color` 等于次级文字色的布尔 | 1 | #1038 故事16 |

## R-13 文本文件预览态行号 + 字体配色 + 间隙

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | 预览态 `.txt`/`.js` 行号槽节点数下限 | 1 | #1038 故事14 / reading 文本与脚本预览语法 |
| A-13.2 | exact | 行号计算 `font-family`/颜色 token 与编辑态一致的布尔 | 1 | #1038 故事14 / editing 文本与脚本文件行号 |
| A-13.3 | exact | 行号与分隔线之间水平间距 > 0 的布尔 | 1 | #1038 故事14 |
| A-13.4 | exact | Markdown 预览态行号槽节点数 | 0 | editing E-8 / #1038 |

## R-14 主窗口最小宽度 600→300

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | exact | 主窗口最小宽度（px） | 300 | #1038 故事17 / tauri.conf.json |
| A-14.2 | exact | 300×600 视口下页面横向溢出宽度（px） | 0 | #1038 Testing Decisions |
| A-14.3 | exact | 主窗口最小高度（px） | 400 | src-tauri/tauri.conf.json:20-21 |

## R-15 页签去省略号 + 页签间距按指针尺寸

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | exact | 相邻页签间距（px，容差 ±2） | 16 | #1038 故事18 |
| A-15.2 | exact | 生效 `text-overflow: ellipsis` 的页签标题节点数 | 0 | #1038 故事18 / code obs TabBar |
| A-15.3 | exact | 长页签名按可用宽度收缩/换行且页签条可滚动的布尔 | 1 | #1038 故事18 |

## R-16 浮窗外框/状态栏同构 + 缩放贴底

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-16.1 | exact | 缩放窗口后状态栏与浮窗底边的间距（px） | 0 | #1038 追加 Testing Decisions / design D5 |
| A-16.2 | state-machine | 状态栏隐藏态切换后残留占位高度 | 隐藏→占位 0 | #1038 追加 Testing Decisions |
| A-16.3 | exact | 边框/顶栏计算样式与阅读空间文件卡片悬浮窗一致的布尔 | 1 | #1038 故事19 / ReadingRail 悬浮卡 |

## R-17 键盘选择 + 选中行徽标「回车」

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-17.1 | state-machine | ArrowDown / ArrowUp → activeIndex 高亮行变化 | 按键→高亮变 | #1038 追加 Testing Decisions |
| A-17.2 | exact | 高亮行行尾徽标文本（严格相等） | "回车" | #1038 追加 Testing Decisions |
| A-17.3 | state-machine | Enter → 打开当前高亮结果并滚动到可视区 | 回车→定位命中 | #1038 故事20 |

## R-18 搜索结果与悬浮预览为预览态渲染

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-18.1 | exact | 结果与悬浮预览文本中源码标记（`##` / `---` / 围栏 ```）出现次数 | 0 | #1038 追加 Testing Decisions |
| A-18.2 | exact | 命中高亮节点数下限（渲染态下保留） | 1 | search-replace-float S-3 |

## R-19 结果容器 9 行上限 + 快捷键列常驻

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-19.1 | exact | 命中 >9 条时结果容器高度 / 单行高（±2px） | 9 | #1038 追加 Testing Decisions |
| A-19.2 | state-machine | 滚动到底部后行尾快捷键列仍可见 | 滚动→列可见 | #1038 故事22 |
| A-19.3 | exact | 结果容器 `scrollHeight > clientHeight` 的布尔 | 1 | #1038 追加 Testing Decisions |

## R-20 搜索浮窗宽度减半

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-20.1 | exact | 浮窗默认宽度（px，容差 ±2；基准 `min(600px, calc(100% - 48px))` 的一半） | 300 | #1038 追加 Open Question 6 |
| A-20.2 | exact | 窄窗下页面横向溢出宽度（px） | 0 | #1038 追加 Testing Decisions |

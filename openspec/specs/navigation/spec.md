# navigation — 导航体系当前规格

## Purpose

navigation 域定义标月桌面端"无侧栏"方向下的导航体系：启动面板/欢迎页、统一文件面板（Cmd+P 上下文浏览器）及其三视图切换、条目直开与历史前进后退。导航职责由 Cmd+P 承担，不再依赖左右侧栏（界面层面的无边栏决策见 application-shell 域）。本规格是 navigation 域可验收功能行为的唯一真相源；条目编号（B-1、B-3、B-6、B-7、B-8）与 `docs/MVP-需求跟踪表.md` 模块 B / B+ 一一对应。

## 设计来源与参考

- B-1 批准设计：`docs/design/approved/empty-state/spec.md`（启动面板/欢迎页部分）
- B-3 / B-6 / B-7 / B-8 批准设计：`docs/design/approved/navigation/spec.md`（经由跟踪表 B-3/B+ 行登记）
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口表）、4.2（统一文件面板规则）、§三 快捷键体系（Cmd+P、Ctrl+1~9、Cmd+[/Cmd+]）；`docs/MVP-需求跟踪表.md` 模块 B 与 B+（均标 ✅）
- 空状态的"继续上次/最近保存"分块（B-2）、示例文件释放（B-4）与空状态设计规则（B-5）归属 application-shell 域
## Requirements
### Requirement: B-1 启动面板（欢迎页）

用户启动应用时 SHALL 首先进入门户启动首屏（布局规格 v1.0 §2）：顶部问候语+日期（安静无装饰）、继续阅读 1 张 hero 卡（上次文件+阅读进度+打开）、最近文件 4–6 张富卡片（标题/父路径/时间/1–2 行真摘要/进度）、分类磁贴 8 类（Markdown/HTML/文本/PDF/视频/图片/代码/音频+计数，点击→网格并按类型过滤）、快速动作（新建文档/打开文件/生成学习页/AI 指令，图标+文字，主入口唯一带字处）、底部 ⌘P 搜索全部提示。门户 SHALL 无「来源」概念（组织维度=时间/类型/主题）。首次启动（无任何文件）SHALL 显示引导三动作（新建/打开/导入）替代 hero 与磁贴数据。`0-welcome.md` 欢迎页职责 SHALL 由门户空态引导承接；原「继续上次/最近保存」分块数据（application-shell 域 B-2）SHALL 由门户「继续阅读/最近文件」承接。

#### Scenario: 首次启动渲染欢迎页

- **WHEN** 用户首次启动标月且无任何打开文档
- **THEN** 启动面板 SHALL 进入门户空态：门户显示问候语与引导三动作（新建/打开/导入），不渲染空的 hero 卡与磁贴计数（原 `0-welcome.md` 欢迎页职责由门户承接）

#### Scenario: 首次启动渲染门户空态

- **WHEN** 用户首次启动且无任何文件
- **THEN** 门户 SHALL 显示问候语与引导三动作（新建/打开/导入），不渲染空的 hero 卡与磁贴计数

#### Scenario: 门户四块齐全

- **WHEN** 存在历史文件时用户启动应用
- **THEN** 门户 SHALL 齐备：问候语+日期、继续阅读 hero 卡、最近文件 4–6 卡、分类磁贴 8 类、快速动作与 ⌘P 提示，且无「来源」入口

### Requirement: B-3 统一文件面板（Cmd+P 上下文浏览器）

应用 SHALL 提供 `Cmd+P` 统一文件面板作为唯一的文件导航入口。面板 SHALL 依据打开时的上下文呈现不同视图（空查询 = 当前上下文视图，输入搜索词 = 全局搜索视图，带选中文本 = 局部相关视图，触发规则见 B-6）。空查询时的默认上下文视图 SHALL 分为三组：「继续」（当前任务现场文档：引用/分屏/跳转过的，≤5 条）、「待处理」（状态风险文档：未保存/读到一半/失效的，≤5 条）、「全部」（工作目录所有文件按 mtime 倒序，行为见 file-management 域 C-5）。条目交互 SHALL 支持：Enter 打开、Space Peek、Cmd+Enter 旁开、Tab 固定、hover 显示路径详情。R 阶段搜索范围 SHALL 为文件名 + frontmatter title + H1 + 父目录，不搜索正文全文。

#### Scenario: 空查询呈现默认上下文分组

- **WHEN** 用户按 `Cmd+P` 且无查询词、无选中文本
- **THEN** 面板 SHALL 显示「继续」（≤5 条）、「待处理」（≤5 条）、「全部」三组默认上下文视图

#### Scenario: 条目交互

- **WHEN** 面板内某条目获得焦点
- **THEN** Enter SHALL 打开该条目；Space SHALL 预览（Peek）；Cmd+Enter SHALL 在旁栏打开；Tab SHALL 固定该条目；hover SHALL 显示其路径详情

#### Scenario: 搜索范围限定

- **WHEN** 用户在面板中输入搜索词
- **THEN** 匹配范围 SHALL 限于文件名、frontmatter title、H1 与父目录，不搜索文档正文全文

### Requirement: B-6 三视图切换

统一文件面板 SHALL 按查询状态动态切换三种视图：无查询词且无选中文本时显示当前上下文视图；输入搜索词时切换为全局搜索视图；打开面板时带有选中文本时显示局部相关视图。

#### Scenario: 输入搜索词切换全局搜索

- **WHEN** 面板已打开（当前上下文视图），用户输入搜索词
- **THEN** 面板 SHALL 从当前上下文视图切换为全局搜索视图

#### Scenario: 带选中文本进入局部相关

- **WHEN** 用户在正文中选中一段文本后按 `Cmd+P`
- **THEN** 面板 SHALL 以该选中文本为线索显示局部相关视图

### Requirement: B-7 Ctrl+1~9 直开条目

面板打开时，数字键 `Ctrl+1` 至 `Ctrl+9`（桌面端同时保留 `Cmd+1~9` 同义映射）SHALL 直接打开面板中对应序号的条目，无需按 Enter 确认。

#### Scenario: 数字键直开

- **WHEN** 面板已打开且结果不少于 3 条，用户按 `Ctrl+3`
- **THEN** 面板 SHALL 直接打开第 3 条条目，无需 Enter 确认

### Requirement: B-8 后退/前进历史导航

应用 SHALL 提供 `Cmd+[` 与 `Cmd+]` 作为标准历史栈导航：`Cmd+[` 后退到上一个导航位置，`Cmd+]` 前进，行为遵循标准历史栈语义。

#### Scenario: 后退与前进

- **WHEN** 用户在文档间完成多次导航后按 `Cmd+[`
- **THEN** 视图 SHALL 回退到上一个导航位置；随后按 `Cmd+]` SHALL 前进到下一个导航位置

### Requirement: 工作区 pane 递归树

工作区 SHALL 以 pane 递归树组织分栏：`node = { id, dir: 'row'|'col', ratio, children }`、`leaf = { id, tabs, activeTabId }`。用户 SHALL 可对聚焦 leaf 右分（⌘⌥→）与下分（⌘⌥↓），新 leaf SHALL 获得焦点；关闭最后一页签 SHALL 删除该 leaf 且兄弟扩展，根 leaf SHALL 不显示关闭按钮；格最小尺寸 SHALL 为 240px（宽与高），分隔条 SHALL 双向拖拽；⌘⇧↵ 或格头按钮 SHALL 全屏当前格（隐藏其他格与分隔条，再按或 Esc 恢复）；布局树（结构/比例/页签/活动页签/焦点）SHALL 持久化并重启恢复。

#### Scenario: 分裂与最小尺寸

- **WHEN** 用户对聚焦格按 ⌘⌥→ 后拖动分隔条至小于 240px
- **THEN** 新格出现并获得焦点，分隔条拖动 SHALL 被 240px 下限钳制

#### Scenario: 布局持久化

- **WHEN** 用户分裂出多格、调整比例后重启应用
- **THEN** 布局树 SHALL 按重启前结构、比例、页签与活动页签恢复

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 7 项（导出/分享/右分/下分/源码模式/定位/复制路径，均带图标，不含全屏）。

#### Scenario: 页签生命周期

- **WHEN** 用户在一格内按 ⌘T 两次再按 ⌘W 至最后一签关闭
- **THEN** 该格经历 1→2→3→2→1→0 个页签，最后一签关闭时格被删除且兄弟扩展

#### Scenario: ⋯ 菜单项

- **WHEN** 用户点开格头 ⋯ 菜单
- **THEN** 菜单 SHALL 渲染恰好 7 项且每项带图标，不出现全屏项

### Requirement: 拖拽换位与四向落区

拖动格标题栏 SHALL 支持换位：落别格中心=互换、落四边=移动重排、落窗口边缘=移到根层、Esc 取消；拖文件到某格 SHALL 出现四向落区，落区=在该格分裂/替换。两种拖拽语义 SHALL 严格区分（格拖拽源=格标题栏，文件拖拽源=文件条目）。

#### Scenario: 中心互换

- **WHEN** 用户拖 A 格标题栏至 B 格中心释放
- **THEN** A 与 B 的位置 SHALL 互换（含各自页签与比例）

#### Scenario: 文件四向落区

- **WHEN** 用户拖文件条目悬停于某格右半区
- **THEN** 该格 SHALL 显示右侧落区指示，释放后文件在原格右侧分裂成新格

### Requirement: 阅读空间竖排栏

工作区左侧 SHALL 提供阅读空间竖排栏，三态：折叠（12px 边缘条+文件计数徽标+chevron，正文满宽）、悬停浮层（240px absolute 覆盖不挤压正文，移开 300ms 收回）、钉住（240px flex 常驻，正文 min-width:0）。头部 SHALL 为标题/模式签+滑杆下拉（布局/密度/快照/设为默认）+钉住+收起。布局 SHALL 两式（堆叠：段叠放+粘性段头；标签：分段页签+单列表）；段 SHALL 为 现在/置顶/最近/分类，分类 SHALL 为过滤 chips（全部+8 类带计数），SHALL NOT 使用瀑布式分类行。顶部 SHALL 粘性搜索（即时过滤+命中高亮+× 清除+Esc 先清后收），与网格搜索完全独立。

#### Scenario: 三态切换

- **WHEN** 栏处于折叠态时用户悬停边缘条 250ms 内不移开，随后移开指针
- **THEN** 栏 SHALL 以 240px 浮层展开（不挤压正文），移开 300ms 后收回折叠态

#### Scenario: 分类过滤

- **WHEN** 用户点击「分类」段中的 HTML chip
- **THEN** 列表 SHALL 只显示 HTML 类型条目且 chip 显示计数

### Requirement: 阅读空间密度与卡片规格

密度 SHALL 三档：紧凑 32px（类型图标+标题 1 行+时间）、舒适 56px（+第二行父路径·时间+置顶标）、卡片 112px（默认；cardHeight 可调 88–160）。卡片 SHALL 含：左侧彩色类型图标 18px+粗体标题（1–2 行）、真内容摘要 2 行（无缩略图时通栏）、右侧 4:3 缩略图 72×54（有图 MD 首图/HTML 橙页/PDF 红文档页/视频紫海报+播放/图片真图/音频粉波形；纯文本与无图 MD 无缩略图）、类型 chip+置顶标、meta（任务进度或阅读进度+日期+可点路径文字，路径点击 SHALL 在 Finder 中显示，无 folder 图标）。hover 动作 SHALL 为右上角纯图标三钮（打开/分屏→/分屏↓），不压缩略图。「设为默认」SHALL 写入视图规格（默认密度=卡片、布局=堆叠）。

#### Scenario: 卡片密度默认

- **WHEN** 用户首次打开阅读空间
- **THEN** 密度 SHALL 为卡片（112px）、布局 SHALL 为堆叠

#### Scenario: 缩略图比例

- **WHEN** 有首图的 MD 文件渲染为卡片
- **THEN** 缩略图 SHALL 为 72×54（4:3），位于卡片右侧

### Requirement: 悬浮预览窗

应用 SHALL 提供悬浮预览窗渲染真文档内容（标题/段落/引用/列表/代码/媒体占位）且内部滚动；最小 260×200，SHALL 支持四边+四角拖拽缩放与贴边翻转（锚定边互换）。锚定 SHALL 为：阅读空间 x 恒定=栏右缘+12、y 跟随悬停行（不随鼠标横移）；网格贴卡片右缘+12、y 贴卡顶。标题栏拖动位置 SHALL 保持到关闭，重开回默认锚定；底部动作区 SHALL hover 才显（打开/分屏→/分屏↓、路径文字可点）。开关 SHALL 双轨独立：阅读空间悬停（默认开，250ms 延时）、网格（悬停/点击（默认）/关闭）；⌘⇧V SHALL 切换悬浮预览开关。

#### Scenario: 阅读空间锚定

- **WHEN** 用户在钉住态阅读空间从第 3 行卡片悬停到第 8 行
- **THEN** 悬浮窗 x SHALL 保持栏右缘+12 不变，y SHALL 跟随到第 8 行

#### Scenario: 拖动保持

- **WHEN** 用户拖动悬浮窗到新位置后关闭再重新触发预览
- **THEN** 关闭前位置 SHALL 不保留（重开回默认锚定），关闭前拖动过程 SHALL 无跳动

### Requirement: AI 两形态

AI SHALL 有全产品唯一入口：顶栏星芒图标。小窗形态 SHALL 为 285×260、默认右下角距边 16px、标题栏可拖动、四边四角可缩放、× 可关闭；「停靠到右侧」SHALL 将其嵌入分栏树（默认右侧 28% 宽，可拖宽/关闭/再分），⋯ 菜单 SHALL 提供「脱离为小窗」；两形态 SHALL 共享同一对话历史。⌘⇧A SHALL 切换 AI 小窗（⇄ 停靠窗格）。AI 改动 SHALL 有确认卡（人话描述，禁技术语言；三档密度：每次必弹/本会话总是后静默（默认）/不弹只靠撤销）+ 撤销条（3s 淡出、hover 重现）+ 快照（最近 10 份）。AI 视图改写 SHALL 覆盖布局/密度/卡片高度/区块颜色/图标内外显隐/预览开关/面板宽窄，并提供 6 条预设（按主题分组/只留置顶和最近/置顶段放大/网格改列表/网格按类型分组/加未读筛选）。

#### Scenario: 停靠与脱离

- **WHEN** 用户在小窗头部点击「停靠到右侧」，再从停靠窗格 ⋯ 选择「脱离为小窗」
- **THEN** AI SHALL 先成为右侧分栏窗格（约 28% 宽），脱离后回到小窗形态，对话历史 SHALL 保持连续

#### Scenario: 确认卡与撤销

- **WHEN** AI 执行一次视图改写（默认档）
- **THEN** 首次 SHALL 弹人话确认卡，本会话后续同类操作 SHALL 静默执行且出现撤销条（3s 淡出），撤销后视图 SHALL 完整还原

### Requirement: 设置左导航 10 区

设置（⌘,）SHALL 为左导航 10 区：外观、编辑器、阅读空间、网格概览、悬浮预览、AI 服务、扩展、快捷键、数据与备份、关于。外观区 SHALL 含主题（浅/深/暖）、字号、跟随系统外观（默认开）；悬浮预览区 SHALL 含阅读空间悬停开关与网格预览模式（悬停/点击/关闭）；AI 服务区 SHALL 列 DeepSeek/通义/Kimi/GLM/WorkBuddy/OpenCode/Pi/自定义，本地 LLM 与多 agent SHALL 标「规划中」，key SHALL 只存钥匙串；快捷键区 SHALL 显示核心 7 条与「查看完整列表」。

#### Scenario: 跟随系统外观

- **WHEN** 跟随系统外观为默认开且系统切换到深色
- **THEN** 应用主题 SHALL 跟随切换为深色，无需用户操作

#### Scenario: 左导航分区

- **WHEN** 用户按 ⌘, 打开设置
- **THEN** 左导航 SHALL 渲染恰好 10 区且当前区高亮

### Requirement: 扩展管理

扩展 SHALL 为文件夹形态（manifest.json + SKILL.md）可打包传播；导入 SHALL 支持拖入文件夹/.zip 或点击选择并即启用（无安装步骤）；管理列表 SHALL 含名称/来源徽章（内置|AI 生成）/启用开关/打开文件夹/卸载；SHALL 支持导出/分享自定义扩展打包；AI 生成 SHALL 为输入一句话→生成中→新扩展卡（默认启用）+ SKILL.md 预览。扩展目录扫描与列表命令 SHALL 消费既有扩展点基建，不重复实现。

#### Scenario: 拖入即启用

- **WHEN** 用户把含 manifest.json 与 SKILL.md 的文件夹拖入设置·扩展区
- **THEN** 扩展 SHALL 出现在列表且默认启用，无安装步骤

#### Scenario: 卸载

- **WHEN** 用户对某 AI 生成扩展点击卸载
- **THEN** 该扩展 SHALL 从列表消失且其文件被移除

### Requirement: 图标体系

全站图标 SHALL 使用静态 path 表（24×24 viewBox、`fill="currentColor"`、18px 密集/24px 主操作），SHALL NOT 引入图标库（含 universe-icon）、sprite、mask-CSS 或任何构建步骤。图标语言 SHALL 以描边为主（1.7、圆头圆角），实心仅用于播放/暂停、省略号（更多）、AI 星芒三处例外。SHALL 一概念一图标、同概念全产品同图标、不混风格、禁 emoji。可逆动作 SHALL 成对出现（全屏/退出、播放/暂停、音量/静音、钉住/取消钉住、循环三态），由成对 `IconName` 承载、调用点按下一个动作选择，SHALL NOT 给 `Icon` 组件加 state prop。类型色 SHALL 固定 8 类：Markdown #6366f1、HTML #f59e0b、文本 #64748b、PDF #ef4444、视频 #a855f7、图片 #10b981、代码 #06b6d4、音频 #ec4899。标签 SHALL 三级可设置（自动：主入口图标+文字、重复处仅图标/始终显示文字/仅图标）。设置内 SHALL 提供图标抽屉查看全部在用图标（名称/尺寸/已有-新绘）。

#### Scenario: 类型色一致性

- **WHEN** 同一 HTML 文件出现在门户磁贴、页签、阅读空间卡片与网格 tile
- **THEN** 四处类型图标 SHALL 使用同一 HTML 橙 #f59e0b 且形状一致

#### Scenario: 禁 emoji

- **WHEN** 审查全站图标渲染
- **THEN** SHALL 无任何 emoji 字符

#### Scenario: 描边与实心分工

- **WHEN** 审查图标抽屉中任一经描边渲染的图标
- **THEN** 该图标的 `<path>` SHALL 为 `fill="none"` 且带 `stroke="currentColor"`（线宽 1.7）
- **AND** 播放/暂停、更多、AI 星芒 SHALL 保持实心填充

#### Scenario: 可逆动作成对

- **WHEN** 打开任一可逆动作的两种状态（全屏中与未全屏、已钉住与未钉住、静音与未静音、播放与暂停）
- **THEN** 两种状态 SHALL 各对应一个独立 `IconName`，且形状为同一构图的反向/补全形态

#### Scenario: 不引入图标库

- **WHEN** 审查打包产物与 `src/ui/icons.ts`
- **THEN** 图标 SHALL 全部来自静态 path 表，SHALL NOT 存在图标库依赖或运行时生成

### Requirement: 快捷键家族与总览

应用 SHALL 落地完整快捷键家族：全局 ⌘P/⌘\ / ⌘⇧\ / ⌘K/⌘⇧A/⌘,/⌘⇧V/?/Esc 层级关闭（先清搜索→再关面板）；类型过滤 ⌥1–8=八类、⌥0=全部（阅读空间/网格/检索内）；模式 ⌘⇧M 循环；文件 ⌘O/⌘S/⌘N/⌘T/⌘W/⌘⇧P；工作区 ⌘↵/⌘⌥→/⌘⌥↓/⌘⇧↵/⌘⇧F；卡片直开按住 ⌘ 显示视口编号、⌘1–9 当前格/⌘⇧1–9 右分/⌘⌥1–9 下分。设计规则 SHALL 为单 ⌘ 高频/⌘⇧ 二级/⌘⌥ 分栏/⌥ 过滤/不用三修饰键；tooltip SHALL 显示键位。`?` SHALL 打开快捷键总览浮层。

#### Scenario: 类型过滤

- **WHEN** 用户在阅读空间按 ⌥4
- **THEN** 列表 SHALL 过滤为 PDF 类型；⌥0 SHALL 恢复全部

#### Scenario: 总览浮层

- **WHEN** 用户按 `?`
- **THEN** 快捷键总览浮层 SHALL 打开，Esc SHALL 关闭

### Requirement: N-1 本机最近文件自动发现

阅读空间 SHALL 在无用户选择的情况下自动展示本机最近文档，按文件修改时间倒序；来源 SHALL 限于用户主目录下常见文档目录与受支持扩展名。每条 SHALL 显示类型图标、文件名、父文件夹名与相对时间；SHALL NOT 显示完整路径 tooltip。点击父文件夹 SHALL 调用系统文件管理器打开该目录。

#### Scenario: 启动即显示最近文件
- **WHEN** 用户启动应用且本机存在最近文档
- **THEN** 阅读空间 SHALL 自动列出最近文档，按修改时间倒序，无需用户先打开文件

#### Scenario: 父文件夹可打开
- **WHEN** 用户点击某条目的父文件夹名
- **THEN** 系统文件管理器 SHALL 打开该文件所在目录

### Requirement: N-2 阅读空间预览触发区与列表回顶

阅读空间条目的悬浮预览 SHALL 仅在指针位于条目右半区时触发；指针位于左半区 SHALL NOT 打开预览。点击阅读空间三点菜单中的布局/密度/筛选项后，列表 SHALL 自动滚动回顶部。

#### Scenario: 左半区不触发
- **WHEN** 指针进入某条目的左半区
- **THEN** 悬浮预览 SHALL 保持关闭

#### Scenario: 右半区触发
- **WHEN** 指针进入某条目的右半区并停留 250ms
- **THEN** 悬浮预览 SHALL 打开并锚定到该条目

#### Scenario: 菜单切换后回顶
- **WHEN** 用户从阅读空间三点菜单切换布局或密度
- **THEN** 列表 SHALL 滚动到顶部

### Requirement: N-3 本机标题与正文检索

阅读空间搜索 SHALL 支持本机文件检索，范围包含文件名、frontmatter title、H1 与正文全文；SHALL 支持按文件类型与修改时间筛选。检索 SHALL NOT 改变当前打开文档或分栏结构。

#### Scenario: 正文命中
- **WHEN** 用户在本机检索框输入只出现在某文件正文中的词
- **THEN** 结果 SHALL 包含该文件并高亮命中片段

#### Scenario: 类型筛选
- **WHEN** 用户选择「Markdown」类型筛选
- **THEN** 结果 SHALL 只包含 Markdown 文件


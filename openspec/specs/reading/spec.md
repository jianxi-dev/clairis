# reading — 核心阅读体验当前规格

## Purpose

reading 域定义标月桌面端的核心阅读体验：文件打开后的可读性保障（冷启动性能、GFM/HTML 渲染、主题、滚动性能）、沉浸阅读模式、全局字号缩放与阅读进度恢复。本规格是 reading 域可验收功能行为的唯一真相源；条目编号（A-1 至 A-9）与 `docs/MVP-需求跟踪表.md` 模块 A 一一对应。

## 设计来源与参考

- A-5 批准设计：`docs/design/approved/immersive-reading/spec.md`（v2，2026-07-12 定稿，Codex R1 对抗复审）
- A-6 批准设计：`docs/design/approved/font-size-scaling/spec.md`（v3，2026-07-12 定稿，Codex 两轮对抗）
- A-9 批准设计：`docs/design/approved/reading-progress/spec.md`（v2，2026-07-12 定稿）
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵（Phase M / Phase R）、§三 快捷键体系；`docs/MVP-需求跟踪表.md` 模块 A（A-1 至 A-9 均标 ✅）
## Requirements
### Requirement: A-1 冷启动秒开

应用 SHALL 在冷启动后 1.0 秒内达到可交互状态（TTI < 1.0s），且从系统双击文件到内容可读 SHALL 在 1.5 秒内完成。

#### Scenario: 冷启动可交互时间

- **WHEN** 用户从关闭状态启动标月
- **THEN** 应用从冷启动到可交互（TTI）SHALL 小于 1.0 秒

#### Scenario: 双击文件可读时间

- **WHEN** 用户在 Finder 中双击一个 Markdown 文件打开标月
- **THEN** 文件内容 SHALL 在 1.5 秒内变为可读

### Requirement: A-2 GFM 完整渲染

预览/阅读模式 SHALL 完整渲染 GitHub Flavored Markdown：标题、有序/无序列表、代码块、表格、链接、图片、粗体/斜体、任务列表、分割线、引用块。

#### Scenario: GFM 元素齐全渲染

- **WHEN** 用户打开一篇包含标题、列表、代码块、表格、链接、图片、粗斜体、任务列表、分割线、引用块的 Markdown 文档
- **THEN** 以上全部元素 SHALL 以对应的排版样式渲染，无元素以纯文本形式回退

### Requirement: A-3 HTML 预览

`.html` 文件 SHALL 以 iframe 方式在预览模式打开，iframe SHALL 通过 asset 协议加载真实本地文件（`asset://localhost/<path>`）；无文件路径时 SHALL 回退为 srcdoc 渲染。脚本 SHALL 默认允许执行（内联脚本与外部 CDN 脚本均可运行），iframe 与主窗口跨源隔离（脚本 SHALL 无法访问父页面 DOM、应用状态与 Tauri 命令）。预览内相对路径资源（图片、CSS、字体、内嵌页面，含 `..` 引用）SHALL 由 asset 协议按文件相对路径加载。目录锚点链接（`#id`）SHALL 在 iframe 内正常导航不崩溃。复杂 CSS（布局、动画、变量、`@font-face`、媒体查询、Tailwind 等运行时生成样式）SHALL 正常渲染。

#### Scenario: HTML 文件 iframe 预览

- **WHEN** 用户打开一个 `.html` 文件
- **THEN** 内容 SHALL 通过 iframe（asset:// 直载）渲染

#### Scenario: 脚本默认允许

- **WHEN** 预览的 HTML 含内联脚本或外部 CDN 脚本（如 Tailwind Play CDN、内联 CSS 变量注入）
- **THEN** 脚本 SHALL 执行，依赖脚本的样式/组件（callout、调色板、Tailwind class）SHALL 正常显示

#### Scenario: 脚本跨源隔离

- **WHEN** 预览 HTML 的脚本尝试访问父窗口
- **THEN** 跨源限制 SHALL 阻止访问（脚本无法读取父页面 DOM、状态或调用 Tauri 命令）

#### Scenario: 相对资源加载

- **WHEN** 预览 HTML 引用同目录或上级目录（`..`）的图片、CSS、字体
- **THEN** 资源 SHALL 按相对路径经 asset 协议加载成功

#### Scenario: HTML 文件沙箱预览

- **WHEN** 用户打开一个 `.html` 文件
- **THEN** iframe SHALL 经 asset 协议直载真实文件；脚本 SHALL 默认允许执行但与主窗口跨源隔离（旧 srcdoc + `script-src 'none'` 禁脚本方案已不再用于 asset 直载分支，无路径时 srcdoc 回退分支仍维持禁脚本）

#### Scenario: 相对资源加载

- **WHEN** 预览 HTML 引用同目录或上级目录（`..`）的图片、CSS、字体
- **THEN** 资源 SHALL 按相对路径经 asset 协议加载成功

#### Scenario: 本地媒体不受拦截

- **WHEN** 预览 HTML 含 `<video>` / `<audio>` 本地媒体或 `@font-face` 本地字体
- **THEN** 媒体与字体 SHALL 不受 CSP 拦截正常加载（`font-src` / `media-src` 放行 `asset:` / `media:`）

#### Scenario: 内嵌页面延续禁脚本

- **WHEN** 预览 HTML 通过 iframe 内嵌同目录子文档
- **THEN** 内嵌子文档 SHALL 可加载，且与主窗口保持跨源隔离（脚本无法访问父页面 DOM、状态或 Tauri 命令）

#### Scenario: 目录锚点导航

- **WHEN** 用户点击预览内目录链接（`<a href="#id">`）
- **THEN** iframe SHALL 滚动到对应锚点，不崩溃不白屏

#### Scenario: 复杂 CSS 样式渲染

- **WHEN** 预览 HTML 含复杂 CSS（布局/动画/变量/`@font-face`/媒体查询/运行时生成样式）
- **THEN** 样式 SHALL 完整呈现

### Requirement: A-7 Dark/Light 主题

应用界面与正文渲染 SHALL 提供暗色/亮色两套主题，默认跟随系统外观，并 SHALL 支持手动切换；手动选择 SHALL 持久化。

#### Scenario: 默认跟随系统

- **WHEN** 主题设置为自动且操作系统切换为暗色外观
- **THEN** 应用 SHALL 跟随显示暗色主题

#### Scenario: 手动切换持久化

- **WHEN** 用户手动切换到亮色主题并重启应用
- **THEN** 应用 SHALL 仍显示亮色主题

### Requirement: A-8 滚动顺滑

正文滚动 SHALL 以 60fps 为目标保持顺滑；对超过 500KB 的文件 SHALL 自动降级渲染策略以维持滚动可用性（大文件保护，不绕过）。

#### Scenario: 常规文件滚动性能

- **WHEN** 用户在 500KB 以下的文档中连续滚动
- **THEN** 滚动 SHALL 保持顺滑（目标 60fps，无可感知卡顿）

#### Scenario: 大文件自动降级

- **WHEN** 用户打开一个超过 500KB 的文件
- **THEN** 应用 SHALL 自动关闭/降级装饰类渲染以维持滚动可用

### Requirement: A-5 沉浸阅读模式

应用 SHALL 提供二元沉浸阅读：`Cmd+\` 切换进入/退出，进入与退出各 SHALL 有 0.3 秒过渡动画（chrome 淡出/淡入，主文档区不动），`Esc` SHALL 直接退出。沉浸态 SHALL 不做状态快照——工具栏可见性是独立用户偏好，不随进出翻转；沉浸态不创建独立字号（字号即全局字号，见 A-6）。沉浸只隐藏界面 chrome，SHALL 不触发任何文件操作（不弹未保存确认、不自动保存）。

#### Scenario: 进入沉浸

- **WHEN** 用户在工具栏可见状态下按 `Cmd+\`
- **THEN** 工具栏/侧栏/Tab 栏 SHALL 在 0.3 秒内淡出并进入沉浸态

#### Scenario: Esc 退出沉浸

- **WHEN** 用户在沉浸态按 `Esc`
- **THEN** 应用 SHALL 在 0.3 秒内淡入退出沉浸，不做"轻退出/完全退出"区分

#### Scenario: 工具栏可见性不翻转

- **WHEN** 用户（工具栏偏好为显示）进入沉浸再退出
- **THEN** 工具栏 SHALL 回到用户设置的可见性状态，进出前后一致

#### Scenario: 编辑态进入不触发文件操作

- **WHEN** 用户在编辑态且文档有未保存修改时按 `Cmd+\`
- **THEN** 应用 SHALL 直接进入沉浸，不弹出未保存确认，不执行保存；退出后光标位置按现有 `cursorPos` 字段恢复

#### Scenario: 沉浸态浮出 chrome

- **WHEN** 用户在沉浸态将鼠标悬停在屏幕上边缘 2px 区域超过 400ms
- **THEN** 工具栏 SHALL 淡入显示；鼠标移出上边缘 2 秒后 SHALL 淡出
- **AND** `Shift+Cmd+T` SHALL 以 toggle 方式切换所有 chrome 的显示/隐藏

#### Scenario: 全屏下 Esc 只退沉浸

- **WHEN** 用户在 macOS 原生全屏 + 沉浸态下按 `Esc`
- **THEN** 应用 SHALL 只退出沉浸，保留全屏；退出全屏需再次使用系统全屏控制或 `Ctrl+Cmd+F`

#### Scenario: 分屏下沉浸

- **WHEN** 用户在双栏分屏下进入沉浸
- **THEN** 分割线 SHALL 隐藏，两个文档并排显示且字号相同（共享全局字号）

### Requirement: A-6 全局字号缩放

同一时间全应用 SHALL 只有一个全局字号（默认 17px），任何模式（阅读/编辑/预览/沉浸）下修改的都是同一个值；不存在每文档字号记忆、不存在"阅读字号/编辑字号"区分。范围 SHALL 为 12px ≤ fontSize ≤ 32px，步进 1px；入口 SHALL 仅为 `Cmd+=` / `Cmd+-`（同时拦截系统缩放，不触发 macOS 系统缩放）。字号 SHALL 以 CSS 自定义属性 + 固定倍率层级缩放（正文 1.0x、H1 1.85x、H2 1.6x、H3 1.4x、H4 1.25x、H5 1.15x、H6 1.1x、代码 0.9x），保持标题与正文的比例关系恒定。字号 SHALL 持久化到 `config.json` 现有 `fontSize` 字段（调整后 500ms debounce 写盘，零新文件零新字段）。字号调整 SHALL 无数字 toast 提示、边界处 SHALL 无额外提示。

#### Scenario: 层级比例缩放

- **WHEN** 用户在编辑态或预览态按 `Cmd+=`
- **THEN** 全局字号 SHALL +1px，且 H1 SHALL 恒为正文的 1.85 倍、代码 SHALL 恒为正文的 0.9 倍（所有元素按固定倍率同步缩放）

#### Scenario: 上下限钳制无提示

- **WHEN** 字号已为 32px 时用户再按 `Cmd+=`，或已为 12px 时再按 `Cmd+-`
- **THEN** 字号 SHALL 保持不变，且 SHALL 不出现任何数字提示或边界提示信息

#### Scenario: HTML 内容 rem 跟随、px 不变

- **WHEN** 用户在 HTML 预览中调整全局字号
- **THEN** 使用 rem/em/% 单位的元素 SHALL 随全局字号变化（通过向同源 iframe 注入根字号样式）
- **AND** 使用 px 写死字号的元素 SHALL 保持不变（尊重原作者意图）；跨域 iframe SHALL 静默放弃注入

#### Scenario: 持久化与沉浸联动

- **WHEN** 用户调整字号后重启应用
- **THEN** 字号 SHALL 恢复为上次关闭时的值（存于 `config.json.fontSize`，零新字段）
- **AND** 在沉浸态按 `Cmd+=`/`Cmd+-` SHALL 修改同一个全局字号，退出沉浸后字号不变

#### Scenario: 分栏字号统一

- **WHEN** 用户在左右/上下双栏下调整字号
- **THEN** 两个分栏 SHALL 共享同一个全局字号

### Requirement: A-9 阅读进度与位置恢复

阅读模式下 SHALL 常驻一条"墨线"进度指示：位于滚动区域右边缘（距右边距 3px）、宽 2px、高度覆盖整个文档滚动区域；已读部分（上）为 rgba(0,0,0,0.14)、未读部分（下）为 rgba(0,0,0,0.04)，以自然明暗过渡为分界，无额外标记。墨线 SHALL 在滚动时实时更新（requestAnimationFrame，约 16ms 节流），不 hover 展开、无章节节点、无剩余时间/字数面板；沉浸态与编辑态 SHALL 不显示墨线。位置恢复 SHALL 基于 tabs store 的 `tabs[].scrollPos` + `contentHeight` 运行时字段，跨会话持久化 SHALL 存放于现有 `config.json` 的 `scrollPositions` 映射（key 为文件路径，不新建 JSON 文件）：滚动停止 200ms debounce 写入，切换/关闭 tab 与关闭窗口时立即写入；恢复时高度未变按像素跳转、高度变化按百分比恢复、无记录跳顶部。

#### Scenario: 墨线随滚动更新

- **WHEN** 用户在阅读模式下滚动文档
- **THEN** 右边缘墨线 SHALL 实时反映已读/未读比例（上深下浅），快速滚动 SHALL 不卡顿

#### Scenario: 沉浸态与编辑态隐藏墨线

- **WHEN** 用户进入沉浸态或切换到编辑态
- **THEN** 墨线 SHALL 不显示
- **AND** 沉浸态按 Esc 浮出工具栏后（退出沉浸）墨线 SHALL 重新显示

#### Scenario: 关闭再打开恢复位置

- **WHEN** 用户关闭一篇已读到中部的文档后重新打开，且文档未被修改
- **THEN** 滚动位置 SHALL 恢复到关闭前的 `scrollPos`（像素级）

#### Scenario: 文档高度变化按百分比恢复

- **WHEN** 用户在文档增加段落后重新打开
- **THEN** 应用 SHALL 按 `scrollPos / 旧内容高度` 的百分比恢复位置（文档未大改时误差 < 5%）

#### Scenario: 无历史记录跳顶部

- **WHEN** 用户打开一篇没有保存过滚动位置的新文档
- **THEN** 视图 SHALL 定位到顶部

#### Scenario: 分栏墨线归属

- **WHEN** 用户处于"编辑 + 预览"左右分栏
- **THEN** 仅预览 pane SHALL 显示墨线，编辑区无墨线；上下双栏时两个 pane 各自显示自己的墨线

### Requirement: A-10 阅读宽度与标题配色

预览阅读宽度 SHALL 默认为 880px（`min(880px, 可用宽度 - 48px)`），标题 SHALL 应用用户配置的标题配色（`headingColors`，经 CSS 变量注入，明暗主题均生效）。

#### Scenario: 阅读宽度

- **WHEN** 用户打开 markdown 预览
- **THEN** 正文容器 SHALL 以 880px 为上限居中显示，窗口窄于 928px 时自适应留 24px 边距

#### Scenario: 标题配色

- **WHEN** 预览渲染 markdown 标题
- **THEN** h1-h6 SHALL 应用 `headingColors` 配置的颜色

### Requirement: A-11 预览表格宽度与自动换行

预览态表格 SHALL 占满内容区可用宽度（100%），表格宽度 SHALL 不随单元格内容长度横向延展；单元格文本 SHALL 自动换行，长句、长 URL、长英文单词/标识符 SHALL 可断行。常规文本内容 SHALL 不触发横向滚动；仅极端不可断内容（如内嵌固定宽度媒体）SHALL 以 `.table-wrap` 容器内横向滚动兜底，不得溢出内容区。

#### Scenario: 长内容表格不横向延展

- **WHEN** 用户预览含长句/长 URL 单元格的 Markdown 表格
- **THEN** 表格宽度 SHALL 不超过内容区可用宽度，SHALL 不出现横向滚动条

#### Scenario: 单元格内容自动换行

- **WHEN** 单元格文本超出该列可用宽度
- **THEN** 文本 SHALL 在单元格内自动换行（长单词/URL 可断行），SHALL 不撑宽表格

#### Scenario: 短内容表格满宽

- **WHEN** 用户预览内容较短的表格
- **THEN** 表格 SHALL 占满内容区可用宽度（不缩至内容宽度）

#### Scenario: 行宽设置联动

- **WHEN** 用户调整阅读行宽（紧凑/标准/宽松）或窗口宽度变化
- **THEN** 表格宽度 SHALL 随内容区宽度同步变化，SHALL 不出现横向延展

#### Scenario: 极端内容兜底

- **WHEN** 单元格含不可断的固定宽度内容（如内嵌宽图片）
- **THEN** 超出部分 SHALL 仅在 `.table-wrap` 容器内横向滚动，不得溢出内容区

### Requirement: A-13 悬浮预览的离开关闭与媒体渲染

悬浮预览窗 SHALL 在指针离开窗口且未钉住、未拖动、未缩放时自动关闭；SHALL 在指针仍位于阅读空间触发条目上时保持打开。预览 SHALL 对图片、视频、音频渲染真实媒体元素并支持播放；HTML SHALL 以沙箱 iframe 渲染，SHALL NOT 显示源码文本。

#### Scenario: 离开关闭
- **WHEN** 悬浮预览未钉住，指针移出预览窗且不在触发条目上
- **THEN** 预览窗 SHALL 自动关闭

#### Scenario: 媒体真实渲染
- **WHEN** 用户预览图片、视频或音频文件
- **THEN** 预览窗 SHALL 渲染 `img` / `video` / `audio` 元素而非纯文字占位

### Requirement: A-14 HTML 摘要文本化

阅读空间与门户中的 HTML 文件摘要 SHALL 显示去标签后的正文文字，SHALL NOT 显示 HTML 源码；缩略图 SHALL 显示中性占位图，不伪造 HTML 页面缩略图。

#### Scenario: HTML 摘要去标签
- **WHEN** 某 HTML 文件进入最近列表
- **THEN** 其摘要 SHALL 不包含 `<tag>` 形式的源码文本

### Requirement: A-15 阅读空间宽度可调

阅读空间（左侧栏）SHALL 在「钉住」与「悬浮」两种可见状态下都提供 4px 宽的垂直拖拽手柄；宽度 SHALL 钳制在 200–360px；松手后宽度 SHALL 持久化到视图配置，并在下次启动时恢复。折叠态 SHALL 仅保留 12px 边缘触发条，不渲染拖拽手柄。

#### Scenario: 悬浮态可拖宽

- **WHEN** 阅读空间处于悬浮（未钉住）状态，用户拖动其右缘手柄
- **THEN** 阅读空间宽度 SHALL 随指针变化，且 SHALL 保持在 200–360px

#### Scenario: 宽度持久化

- **WHEN** 用户把宽度拖到 300px 后重启应用
- **THEN** 阅读空间宽度 SHALL 恢复为 300px

### Requirement: A-16 正文行宽连续可调

设置「阅读空间」区 SHALL 提供连续行宽滑块：范围 480–2400px、步长 20px，并实时显示当前像素值；拖动滑块 SHALL 写入 `config.readerWidth` 并即时更新正文 `--type-measure`。既有 720 / 1080 / 1200 三档预设 SHALL 保留为快捷按钮，点击后滑块 SHALL 同步到对应值。

#### Scenario: 滑块改变正文行宽

- **WHEN** 用户在设置中把行宽滑块从 1080 拖到 1400
- **THEN** 正文容器的 `--type-measure` SHALL 为 `1400px`，且设置中显示的当前值 SHALL 为 1400

#### Scenario: 预设与滑块同步

- **WHEN** 用户点击「宽松」预设
- **THEN** 滑块值 SHALL 变为 1200，正文行宽 SHALL 随之更新

### Requirement: A-17 HTML 预览首屏不阻塞

打开 `.html` 文件且处于预览模式时，应用 SHALL NOT 将完整文档同步进隐藏的代码编辑器用于语法解析；编辑器内容 SHALL 在首次切换到编辑或源码模式时再同步。iframe 加载期间 SHALL 显示骨架占位，加载完成后 SHALL 移除。

#### Scenario: 预览态不同步编辑器

- **WHEN** 用户打开一个 50KB HTML 文件并停留在预览模式
- **THEN** 隐藏的 CodeMirror 文档长度 SHALL 为 0，预览 iframe SHALL 正常渲染

#### Scenario: 切到源码时再同步

- **WHEN** 用户在预览态打开同一文件后切换到源码模式
- **THEN** CodeMirror 文档 SHALL 等于文件完整内容

#### Scenario: 加载骨架

- **WHEN** HTML 预览 iframe 尚未触发 `load`
- **THEN** 预览区 SHALL 显示骨架占位；`load` 后骨架 SHALL 消失


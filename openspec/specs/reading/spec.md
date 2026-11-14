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

沉浸态下，每格页签条 SHALL 以**浮层**形式出现：`.app-chrome` SHALL 脱离流式布局（`position: absolute`），指针进入该格顶部热区后 SHALL 以背景、阴影与圆角浮出，SHALL NOT 改变正文区高度、SHALL NOT 推挤正文。

沉浸态下的 PDF 预览，其顶部按钮栏 SHALL 在 1.2 秒无指针交互后自动收起（计算 `opacity` 为 0、`transform` 上移），指针进入预览顶部 24px 区域或容器内移动 SHALL 使其复现；收起与复现 SHALL NOT 改变正文区高度（用 `transform`/`opacity`，SHALL NOT 用 `display: none`）。

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

#### Scenario: 沉浸态页签条为浮层

- **WHEN** 用户在沉浸态把指针移入某一格的顶部 16px 热区
- **THEN** 该格页签条 SHALL 可见，其计算 `position` SHALL 为 `absolute` 或 `fixed`
- **AND** 该格正文区高度 SHALL 与热区未触发时相同（浮层不占流式高度）

#### Scenario: 沉浸态 PDF 顶栏自动收起

- **WHEN** 用户在沉浸态打开 PDF 并把指针移出预览区 1.5 秒
- **THEN** PDF 顶部按钮栏的计算 `opacity` SHALL 为 0
- **AND** 正文区高度 SHALL 与收起前一致

#### Scenario: 沉浸态 PDF 顶栏复现

- **WHEN** 指针移入沉浸态 PDF 预览顶部 24px 区域
- **THEN** PDF 顶部按钮栏 SHALL 恢复可见（计算 `opacity` 为 1）

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

预览阅读宽度 SHALL 默认为 880px（`min(880px, 可用宽度 - 48px)`），标题 SHALL 应用用户配置的标题配色（`headingColors`，经 CSS 变量注入，明暗主题均生效）。用户可选的页面宽度最大值 SHALL 为 1400px；三档预设 SHALL 为 紧凑 720px / 标准 960px / 宽松 1200px。

#### Scenario: 阅读宽度

- **WHEN** 用户选择宽松档
- **THEN** 正文行宽变量 `--type-measure` SHALL 为 1200px，宽内容上限 `--type-measure-wide` SHALL 不超过 1400px

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

悬浮预览窗 SHALL 在指针离开窗口且未钉住、未拖动、未缩放时自动关闭；SHALL 在指针仍位于阅读空间触发条目上时保持打开。

预览 SHALL 对图片、视频、音频渲染真实媒体元素并支持播放。图片 SHALL 按预览内容区宽度适配：当图片原始宽度大于内容区宽度时，其渲染宽度 SHALL 等于内容区宽度，高度按比例自适应；当原始宽度小于内容区宽度时 SHALL 保持原始宽度，SHALL NOT 放大。内容区 SHALL 可纵向滚动，长图 SHALL NOT 被压缩到适应高度。该行为 SHALL 与主预览区的图片行为一致。

HTML SHALL 以本地资源地址直接载入沙箱 iframe，并 SHALL 允许脚本执行与同源访问；SHALL NOT 使用内联文档字符串（`srcDoc`）承载整份文件，SHALL NOT 禁用脚本。HTML 中引用的外链样式与脚本 SHALL 按浏览器默认策略执行；SHALL NOT 显示源码文本。对于已保存的 HTML、图片、视频、音频、PDF 文件，预览 SHALL NOT 先经 IPC 读取完整内容再渲染；仅 Markdown、纯文本与代码类 SHALL 读取文本内容。

#### Scenario: 离开关闭

- **WHEN** 悬浮预览未钉住，指针移出预览窗且不在触发条目上
- **THEN** 预览窗 SHALL 自动关闭

#### Scenario: 媒体真实渲染

- **WHEN** 用户预览图片、视频或音频文件
- **THEN** 预览窗 SHALL 渲染 `img` / `video` / `audio` 元素而非纯文字占位

#### Scenario: 长图按宽适配并可滚动

- **WHEN** 用户在悬浮窗中预览一张高度远大于窗口高度的图片
- **THEN** 图片渲染宽度 SHALL 等于预览内容区宽度，内容区的 `scrollHeight` SHALL 大于其 `clientHeight`，用户可向下滚动查看其余部分

#### Scenario: 小图不被放大

- **WHEN** 用户在悬浮窗中预览一张宽度小于内容区的图片
- **THEN** 图片渲染宽度 SHALL 等于其原始宽度，SHALL NOT 被拉伸到内容区宽度

#### Scenario: HTML 允许脚本

- **WHEN** 用户在悬浮窗中预览一个依赖内联脚本与外链样式构建布局的自包含 HTML 文件
- **THEN** iframe SHALL 以本地资源地址载入（无 `srcDoc`），沙箱 SHALL 允许脚本，页面 SHALL 按自身样式与脚本正常布局

#### Scenario: 不预读二进制内容

- **WHEN** 用户预览一张图片或一个 HTML 文件
- **THEN** 预览 SHALL NOT 先通过 IPC 读取完整文件内容；图片与 HTML SHALL 由渲染器直接加载

### Requirement: A-14 HTML 摘要文本化

阅读空间与门户中的 HTML 文件摘要 SHALL 显示去标签后的正文文字，SHALL NOT 显示 HTML 源码；缩略图 SHALL 显示中性占位图，不伪造 HTML 页面缩略图。HTML 卡片缩略图 SHALL 为**确定性**渲染结果：同一文件在任何滚动位置、任何挂载顺序下 SHALL 显示同一可见缩略图，SHALL NOT 依赖并发配额、加载成功或重试，SHALL NOT 渲染 `<iframe>`。

#### Scenario: HTML 摘要去标签

- **WHEN** 某 HTML 文件进入最近列表
- **THEN** 其摘要 SHALL 不包含 `<tag>` 形式的源码文本

#### Scenario: HTML 缩略图恒可见

- **WHEN** 最近列表含 6 个及以上 HTML 文件，用户逐个滚动到每张卡片
- **THEN** 每张卡片的缩略图区域 SHALL 显示可见的中性占位（类型色底 + 文档字形），SHALL NOT 为空白
- **AND** 卡片内 SHALL NOT 出现 `iframe` 节点

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

### Requirement: PDF 预览缩放

PDF 预览 SHALL 移除放大 / 缩小工具条按钮（SHALL NOT 在顶栏渲染独立的 +/− 缩放按钮），缩放 SHALL 由触控板双指捏合（或等价的缩放输入）驱动。缩放百分比输入 / 菜单 SHALL 保留可用。

#### Scenario: 无放大缩小按钮

- **WHEN** 用户打开一个 PDF
- **THEN** PDF 顶栏 SHALL NOT 出现独立的放大/缩小按钮

#### Scenario: 双指捏合缩放

- **WHEN** 用户在 PDF 上做双指捏合手势
- **THEN** PDF 缩放 SHALL 随之变化

### Requirement: PDF 页码工具条位置

PDF 的页码 / 翻页控件 SHALL 位于顶部按钮区，SHALL NOT 在滚动时于底部浮现页码工具条。页码区容器 SHALL NOT 绘制外边框——它是顶栏唯一不应带框的控件；PDF 外围背景 SHALL 跟随主题（`--app-bg`），在亮色 / 暗色 / 暖色之间切换时 SHALL 自动更新，SHALL NOT 固定为组件默认白或灰。PDF 页面纸面 SHALL NOT 被主题染色。

#### Scenario: 页码区无外框

- **WHEN** 用户打开一个 PDF
- **THEN** 顶栏页码区容器的计算 `border-width` SHALL 为 0px，页码 / 翻页控件 SHALL 仍可用

#### Scenario: PDF 外围底色跟随主题

- **WHEN** 用户把主题从亮色切到暗色
- **THEN** PDF 外围背景的计算颜色 SHALL 等于当前主题的 `--app-bg`，且页面纸面颜色 SHALL 不随之变暗

#### Scenario: 滚动不浮现底栏

- **WHEN** 用户滚动 PDF
- **THEN** SHALL NOT 在底部浮现页码/翻页工具条

#### Scenario: 顶部可翻页

- **WHEN** 用户需要翻页
- **THEN** 页码 / 上一页 / 下一页控件 SHALL 位于顶部按钮区可用

### Requirement: PDF 卡片缩略图

阅读空间与网格的 PDF 文件卡片 SHALL 显示真实的首页缩略图，SHALL NOT 只显示确定性的占位矩形（无内容的类型色块 + 线条）。

#### Scenario: PDF 卡片显示首页缩略图

- **WHEN** 用户查看一张 PDF 文件的卡片
- **THEN** 缩略图区域 SHALL 显示该 PDF 首页的真实图像

### Requirement: PDF 悬浮预览隐藏缩放条

PDF 悬浮预览 SHALL 与阅读空间卡片缩略图一致，隐藏 embedpdf 自带的放大 / 缩小工具条按钮；预览仍 SHALL 可滚动与翻页。

#### Scenario: 悬浮预览无缩放按钮

- **WHEN** 用户悬停一张 PDF 卡片唤出悬浮预览
- **THEN** 预览内 SHALL NOT 出现 `data-epdf-i="zoom-toolbar"` 的缩放按钮

### Requirement: 卡片缩略图高度

阅读空间卡片缩略图 SHALL 保持 4:3 比例并降低高度（宽 64 × 高 48），SHALL NOT 与上方标题/摘要或下方动作行重叠。

#### Scenario: 缩略图不与文字重叠

- **WHEN** 卡片处于最小高度
- **THEN** 缩略图矩形 SHALL NOT 与标题、摘要、底部动作行任一矩形相交

### Requirement: 页面宽度控件与 PDF 主题（第十一批）

状态栏页面宽度控件 SHALL 默认不可见，指针进入其区域时 SHALL 淡入，离开后 SHALL 淡出；控件 SHALL NOT 绘制虚线边框；三个宽度挡位 SHALL 使用强调色并保持可辨识。

PDF 查看器的文件选项、大纲/书签面板、页数、缩放菜单与按钮栏下边线 SHALL 使用应用主题 token，亮/暗/暖三主题下 SHALL 跟随主题变化。

#### Scenario: 页面宽度滑入显示

- **WHEN** 指针进入状态栏页面宽度区域
- **THEN** 控件计算 `opacity` SHALL 在 150ms 内变为 1；移出后 200ms 内回到 0

#### Scenario: PDF 跟随主题

- **WHEN** 用户在亮/暗/暖主题间切换并打开 PDF
- **THEN** 按钮栏下边线与面板文字颜色 SHALL 随主题变化，SHALL NOT 保持固定色值

### Requirement: 视频打开即自动播放且多路独立

系统 SHALL 在打开视频时自动开始播放，不显示等待点击的加载态；多个视频格各自独立播放与出声，互不影响。

#### Scenario: 两格同时播放

- **WHEN** 用户在两个格各打开一个视频
- **THEN** 800ms 内两个 `<video>` 均 `paused === false` 且 `muted === false`（A-8.1–A-8.2）

### Requirement: HTML 卡片真实缩略图

系统 SHALL 在阅读空间 HTML 卡片中渲染受控 iframe 首屏缩略图；加载失败时回退到可见的类型色占位，不得出现空白卡。

#### Scenario: 多个 HTML 卡片

- **WHEN** 最近列表含至少 3 个 HTML 文件
- **THEN** 每个卡片含 iframe 且加载后 opacity 为 1；失败项仍显示类型色占位（A-9.1–A-9.2）

### Requirement: PDF 工具栏显式收起与顶部悬浮

系统 SHALL 默认显示 PDF 工具栏；双击工具栏收起并让正文填充，再双击固定；收起后仅当指针从容器顶部 16px 滑入时以悬浮栏显示，正文区域滑入不触发；不得在沉浸模式自动收起。

#### Scenario: 双击收起与顶部滑入

- **WHEN** 用户双击 PDF 工具栏，随后分别从顶部与正文中部滑入指针
- **THEN** 收起后顶栏 opacity 为 0 且正文高度增加至少 24px；顶部滑入时顶栏以 absolute 悬浮显示，正文中部滑入仍为 0（A-10.1–A-10.5）

### Requirement: 悬浮小窗可切换预览/编辑

系统 SHALL 在 md/html/文本悬浮小窗的钉住按钮右侧提供预览/编辑切换，编辑态可修改并保存文件。

#### Scenario: 小窗编辑并保存

- **WHEN** 用户钉住 md 悬浮小窗并点击切换按钮修改内容后按 ⌘S
- **THEN** 出现 1 个编辑 textarea，写文件命令被调用，再次预览显示新内容（A-11.1–A-11.3）

### Requirement: 视频连播与画面适配

视频播放结束后 SHALL 自动播放下一个可播放项；带旋转元数据的视频 SHALL 按元数据转正，并 SHALL 在可用区域内完整显示（不横躺、不溢出容器）。

#### Scenario: 连播与竖拍视频
- **WHEN** 用户播放列表中的第一个视频直到结束，或打开一个竖拍视频
- **THEN** 当前播放项变为第 2 项；竖拍画面朝向正确且完整落在容器内（A-1.1–A-1.3）

### Requirement: PDF 按钮栏固定显隐

PDF 顶部按钮栏 SHALL 支持固定显示与固定隐藏两种状态，并 SHALL 提供对应快捷键；该状态 SHALL 只影响当前 PDF 视图，SHALL NOT 改写文档。快捷键 SHALL 在 PDF 视图内部（shadow DOM 焦点）也生效，SHALL 在 document capture 阶段处理并 `preventDefault`；快捷键条目 SHALL 在快捷键总览中可见。

#### Scenario: 固定隐藏与快捷键恢复

- **WHEN** 用户对 PDF 执行固定隐藏，再按快捷键
- **THEN** 按钮栏计算 display 为 none，快捷键切换后可见；切换文档后恢复默认且无残留（A-8.1–A-8.2）

#### Scenario: 视图内部快捷键生效

- **WHEN** 用户把焦点放进 PDF 视图的 shadow DOM 控件后按 `⌘⇧D`
- **THEN** 宿主 class 含 `pdf-chrome-pinned-hidden`；再按一次后不含；快捷键总览中 `mode-pdf-toolbar-pin` 行数 SHALL 为 1

### Requirement: A-18 预览宽度与字体同源

预览态引用块的文字列宽度 SHALL 与正文段落相同。预览态标题与正文的字体族 SHALL 与 md-bundle 预览（`packages/renderer/src/readerCss.ts` 的 `--type-font-sans`）逐字一致；等宽文本 SHALL 使用 `--type-font-mono`。

#### Scenario: 引用块与段落等宽

- **WHEN** 用户在预览态打开含引用块与段落的文档
- **THEN** 两者文字列宽度差 SHALL 为 0px

#### Scenario: 字体族一致

- **WHEN** 用户分别测量预览态正文、标题、行内代码的计算 `font-family`
- **THEN** 正文与标题 SHALL 等于 `--type-font-sans` 的解析值，行内代码 SHALL 等于 `--type-font-mono` 的解析值

### Requirement: A-19 预览图片圆角

预览态图片的四个角 SHALL 为 12px 圆角，上下两角半径 SHALL 相同。

#### Scenario: 四角半径一致

- **WHEN** 用户在预览态打开含图片的文档
- **THEN** 图片计算 `border-radius` SHALL 为 `12px`，四个角 SHALL 相同

### Requirement: 预览分栏渲染

预览态 SHALL 把 `::: {.col-N}`（兼容 `cols=N`）围栏渲染为 N 栏布局（N=1..6），输出 `.layout-col-N` 容器，栏数与顺序 SHALL 与编辑态一致。不支持的属性和不含 `col` 的 `:::` 围栏 SHALL 保持原样，SHALL NOT 吞掉内容。窄视口下多栏 SHALL 折叠为单列。

#### Scenario: 分栏渲染为多栏

- **WHEN** 用户打开含 `::: {.col-2}` … `:::` 的文档并进入预览态
- **THEN** `.preview-content .layout-col-2` 节点数 SHALL 为 1，可见文本含 `:::` 次数 SHALL 为 0，两栏子项的水平坐标差 SHALL 大于 0

#### Scenario: 无 col 围栏保持原样

- **WHEN** 文档含 `::: {.align-left}` 或普通 `:::` 围栏
- **THEN** 预览态 SHALL 按既有规则处理，SHALL NOT 生成 `.layout-col-*` 容器

### Requirement: 嵌入视频显示与播放

Markdown 预览/编辑态与 HTML 预览中嵌入的视频 SHALL 正常显示并可播放；内嵌播放控件的音量与进度滑块 SHALL 可见且可拖动，SHALL NOT 被白色色块覆盖。

#### Scenario: 两处视频可播放

- **WHEN** 用户打开含视频链接的 Markdown 与 HTML 文档
- **THEN** 两处 `video` 节点数 SHALL 各为 1，`controls` SHALL 为 `true`，播放后 `currentTime` SHALL 大于 0

#### Scenario: 滑块可见

- **WHEN** 用户查看内嵌视频控件
- **THEN** 音量滑块 thumb 的宽度 SHALL 大于 0，且与轨道颜色有可见对比

### Requirement: 含图片文档可滚动回顶部

预览中含图片（含裁剪属性、大尺寸图、以图片语法引用的视频）的 Markdown 文档 SHALL 能从任意滚动位置回到文档开头：向上滚动与把滚动条拖到顶端两种方式 SHALL 都能到达 `scrollTop = 0`，且文档首行 SHALL 进入视口。图片加载完成导致内容高度变化时 SHALL NOT 使可达的顶部位置丢失。图片裁剪在预览中的显示宽度 SHALL NOT 超过内容容器宽度，高度 SHALL 按裁剪矩形比例缩放。

#### Scenario: 滚轮回顶

- **WHEN** 用户把含图片文档滚到底部，再用滚轮/触控板持续向上滚动
- **THEN** 滚动容器的 `scrollTop` SHALL 到达 0，且文档第一个内容块 SHALL 进入视口

#### Scenario: 滚动条回顶

- **WHEN** 用户把含图片文档的滚动条拖到最上端
- **THEN** 滚动容器的 `scrollTop` SHALL 为 0，且文档第一个内容块 SHALL 可见

#### Scenario: 图片加载后仍可回顶

- **WHEN** 文档图片在打开后异步加载完成、内容高度增大
- **THEN** 用户仍 SHALL 能滚动到 `scrollTop = 0`，顶部位置 SHALL NOT 被图片加载挤掉

#### Scenario: 裁剪图不超出容器

- **WHEN** 文档图片带 `crop` 属性且裁剪宽度大于预览容器宽度
- **THEN** 图片渲染宽度 SHALL ≤ 容器宽度，高度 SHALL 保持裁剪矩形比例


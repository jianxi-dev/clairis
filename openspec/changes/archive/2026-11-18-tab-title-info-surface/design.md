## Context

页签条是应用最常被点击的表面之一。当前状态由两次近期交付叠成：

- **#1053**（2026-11-18）把页签标题改成「单行完整显示、去省略号」，并把页签条 `column-gap` 从 16px 拉到 32px 让长文件名撑得下。维护者复看后判定方向错误：单个长文件名会撑宽页签条、挤掉后面的页签，而「看完整名」应是悬停查看的按需行为。
- **#923**（2026-11-16）把「双击页签条空白」从「新建文档」改成「切窗口全屏」。空白区同时是窗口拖拽手柄（按下后位移 >4px 即 `startDragging()`），双击两次按下之间只要手抖超过阈值，第二次按下就转成拖窗，全屏静默丢失。

主规格与实现有三处漂移，本次一并收口：`application-shell` 同时保留「空白双击新建文档」与「空白双击切全屏（SHALL NOT 新建文档）」两条互斥要求；全屏条款 Scenario 仍断言 `isMaximized()`；「页签名 SHALL 单行完整显示」在 `application-shell` 与 `navigation` 各写一遍。另有 `editing` 的「一切自绘悬停提示 SHALL 胶囊、SHALL NOT 出现矩形外壳」并点名页签名信息窗——它直接阻断本次信息窗改矩形。

约束：视觉数值只在 `docs/design/system/spec.md` 与 `docs/design/system/decisions.md` 定义，实现只引用；本仓 macOS 为主力平台（CI `macos-latest`），Tauri 在 macOS 跑 WKWebView。

## Goals / Non-Goals

**Goals**

- 页签标题有固定上限（120px）、短名按实际长度、超长以省略号收尾；页签条间距不动。
- 完整文件名可在信息窗内换行读到；信息窗为 R8 矩形。
- 信息窗提供「复制路径」「复制文件」两个动作，后者把文件本身放进系统剪贴板。
- 空白双击切全屏不再被窗口拖拽夺走。
- 主规格三处漂移修正，且只保留一条权威定义。

**Non-Goals**

- 不做「⌃ + 双击页签任意位置」：macOS 把 ⌃+左键视为右键，实测 WebKit / Chromium 均不派发 `dblclick`（只有 `contextmenu`），该手势在主力平台不成立。
- 不改 macOS 菜单栏中英并存与 ⌃⌘F 入口（另票）。
- 不改面板全屏（⌘⇧↵）、沉浸模式（⌘\）、页签条 32px 间距、信息窗触发延时与定位算法。
- 不做「复制文件」的 Windows 实现（该平台不渲染按钮）。

## Decisions

### D1 标题宽度：固定 120px + 省略号

- 取 `max-width: 120px` + `white-space: nowrap` + `text-overflow: ellipsis`。120px 在 12px 字号下约容 10 个汉字，配合 18px 类型图标 + 关闭按钮，单个页签总宽约 180px，五个页签仍在常见窗口宽度内。
- 备选：160px（能多显示约 3 字，但页签更宽、可并存的页签更少）；按容器比例（响应式但让同一文件名在不同分栏下宽度不一致，不可预期）。均弃用。
- 省略号而非硬切：硬切会切在字形中间，看起来像渲染故障；用户已确认用省略号。备选「右缘渐隐」需额外 mask 层，收益不抵复杂度。
- 间距维持 32px：本次不改间距，避免同时改两处视觉变量后无法归因。

### D2 信息窗：固定 320px 宽 + R8 矩形 + 文件名换行

- 外壳圆角改用既有 `--radius-8`（8px，设计系统 §5「卡片 / 浮层 / 弹窗」档），取代 `--tip-shell-radius`（`--radius-full` 胶囊）。
- 宽度改为**固定 320px**（不再按内容收缩、也不再用 `min(360px, …)` 上限）；另配 `max-width: calc(100vw - 16px)`，保证主窗口收到 300px 最小宽度时信息窗不溢出——这是「固定宽度」唯一允许失效的边界，且失效方向是变窄、不是横向溢出。
  - 备选：360px（目前的上限值，但信息窗只在悬停时出现，360 在窄栏里偏宽）；按内容自适应（文件名长短不同会让同一部件的宽度跳动，观感不稳定）。均弃用。
- 文件名行 `white-space: normal` + `overflow-wrap: anywhere`，长串文件名按字符断行；固定宽度下换行是可预期的，不再依赖视口。

- 影响面：`editing` 规格要求「一切自绘悬停提示 SHALL 胶囊、SHALL NOT 出现矩形外壳」并点名本件，故必须为该件开豁免（其余提示仍胶囊）。这是本次唯一需要放宽既有通用条款的地方，写在 delta 里而非改通用规则。

### D3 复制动作：路径走前端，文件走原生

- 「复制路径」= `navigator.clipboard.writeText(path)`，与仓内既有路径复制（预览顶栏）同法。
- 「复制文件」= 新增 Tauri 命令 `copy_file_to_clipboard`：macOS 用 `osascript` 的 `on run argv` 处理程序把路径当 argv 传入并写入剪贴板（`POSIX file … as alias`），路径不拼进 AppleScript 源码，无注入面；零 unsafe，与 `reveal_path` 现有的 `open -R` 子进程风格一致。
- 备选：`NSPasteboard` + `writeObjects:`（现代 `public.file-url` 口味，但要引入 `msg_send!` unsafe 绑定，且失败模式更难在本地复现）；复制文件内容文本（语义不同，用户已明确要文件本身）。均弃用。
- 落地验证（一手输出）：`.artifacts/1105/clipboard-probe.txt` —— `clipboard info` 得到 `alias, 268`，`POSIX path of (the clipboard as «class furl»)` 回读 `/private/tmp/probe.txt`。
- 非 macOS 平台不渲染该按钮（而不是渲染后静默失败）：失败按钮比没有按钮更糟。命令本身仍返回明确错误，便于未来补 Windows 实现。
- 前置校验：路径不存在 → 命令返回错误、前端提示失败，不伪造成功。

### D4 空白双击与拖窗互斥

- 保留 4px 拖拽阈值与单击语义不变。修复点：双击判定窗口内（两次按下间隔与位移都在双击容差内）的第二记按下不启动 `startDragging()`，避免系统接管手势后 `dblclick` 不再到达页面。
- 备选：提高阈值（会让正常拖窗变迟钝）；给空白区加独立热区（新增可见元素，需新的视觉条款）。均弃用。

### D5 规范归属：application-shell 唯一权威

- 「页签标题显示宽度」与「空白双击全屏」的权威条款放 `application-shell`；`navigation` 里的重复条款同步为同一表述，不再各写一套阈值。
- 删除 `application-shell` 的「页签栏空白双击新建文档」整条（已被 #923 的 supersede，代码早已不新建文档），REMOVED 带 Reason / Migration。
- 全屏条款 Scenario 断言从 `isMaximized()` 改为 `isFullscreen()`，并补「双击不被拖窗夺走」的约束。

### D6 测试缝

- 复用三条既有 e2e 缝，不新建测试文件：`tab-selection.spec.ts`（标题宽度 / 省略号 / 间距 / 横向滚动）、`tab-info-popover.spec.ts`（圆角 / 换行 / 复制按钮）、`tab-context-menu.spec.ts`（空白双击全屏）。
- `tab-selection.spec.ts` 现有「无省略号、单行全显」断言与新行为直接相反，必须改写而不是叠加，禁止留下互相矛盾的断言。

## Risks / Trade-offs

- [120px 上限让最常用的长中文文件名经常被省略，信息窗成为唯一完整入口] → 省略号保证可辨识被截断；信息窗保留文件名完整换行，且复制动作就在同一处。
- [信息窗改矩形削弱「同类提示外壳一致」] → 豁免只针对本件并在 delta 显式声明；其余提示仍胶囊，测试仍断言按钮提示 / 轮盘提示为胶囊。
- [原生剪贴板命令引入 unsafe 与平台分支] → 命令面窄（一个路径入参、一个错误返回），失败路径明确；macOS 之外不渲染按钮，避免调用未实现分支。
- [双击抑制拖窗可能让用户「快速拖窗」变慢] → 抑制只在双击容差窗口内生效，超阈值仍是原拖拽路径；用「超阈值不触发全屏」对偶用例守住。
- [规范删除条款若对账不严会误删仍生效的要求] → 仅删除已被代码与 #923 supersede 的那一条，REMOVED 段写明 Reason / Migration，`openspec validate --strict` 兜底。

## Migration Plan

1. 前端与样式先落（标题宽度、信息窗形态），此时 e2e 旧断言转红——同步改写断言，一次性转绿。
2. 新增原生命令与前端桥接（先注册命令，再接按钮），复制按钮随路径存在与否条件渲染。
3. 双击稳定性与规范条款最后落，避免与前面两步的断言互相掩盖。
4. 回滚：本 change 无数据迁移；回滚 = revert 对应票的提交 + 删除 `decisions.md` 追加行。半态风险仅在「信息窗已改 R8 而 `editing` 豁免未同步」——因此两步同票交付。

## Open Questions

- 无。用户已在提议阶段裁决三项：复制文件语义 = 文件本身；超长标题 = 省略号；宽度 = 120px 且间距不动。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§5 | — | 信息窗圆角取 `--radius-8`（8px，§5 浮层档）；页签标题 120px 上限与信息窗 320px 固定宽度落 `docs/design/system/decisions.md` 台账两行（标题上限 / 信息窗形态），规范不留第二份 |
| 存储 | src/styles/tokens.css | --tab-title-max-width | 标题上限只此一处 token；组件与 e2e 均按变量名取值，不复制数字 |
| 校验 | src-tauri/src/commands/file.rs | copy_file_to_clipboard | 路径不存在或非文件时返回错误，不写入剪贴板 |
| 桥接 | src-tauri/src/lib.rs | copy_file_to_clipboard | 命令注册进 `invoke_handler`，前端 `invoke` 名称与注册名一致 |
| 消费 | src/lib/clipboard.ts | copyFileToClipboard | 信息窗「复制文件」按钮经此调用；非 macOS 或路径为空时不渲染按钮 |
| 回滚 | docs/design/system/decisions.md | 页签名信息窗 | 台账追加行与 `.tab-info` 圆角同批回退，二者不得只退其一 |

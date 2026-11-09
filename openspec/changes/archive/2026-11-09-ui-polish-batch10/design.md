# Design — ui-polish-batch10

## D-1 工具条归属

- MD 编辑态：删除 `blockToolbar()` 注册。文字选区继续使用选区轮盘（已批准设计），点空白不再出现任何块工具条。
- HTML 文字节点（`nodeKindOf === "text"`）：横向 `.html-edit-toolbar`，控件顺序固定为 AI / 字号 / 加粗 / 斜体 / 下划线 / 删除线 / 链接 / 对齐 / 字色 / 删除。文字选区（Range）也使用同一横向条，命令走 `rangeCommand`。
- HTML 非文字区块：横向工具条只保留 AI / 背景色 / 边框色 / 删除；不再显示字号、标签、class/id、截图、关闭。
- AI 按钮对文字节点取节点文本、对区块取子树纯文本，写入 `useAiEntryStore` 后打开浮层。

## D-2 视频多栏

`mediaPlayerState` 从单源单例改为按格（`paneId`，缺省 `filePath`）持有的 `sources` 映射与 `visible` 映射：

- `show(source)` 只写入该格，其他格不变；同格同源只切可见性。
- `minimize(paneId)` 只把该格移出视口，播放不中断。
- `stop(path)` 只移除匹配文件路径的格。
- `MediaPlayerHost` 渲染全部格的播放器；每格一个 `VideoPlayer`，key 为格键，互不换源。ContentSplitView 分栏态只保留一个宿主，避免重复实例。

## D-3 视频按钮

- 主倍速控件与二级每档都使用同一 `RateDial` 几何，仅 `data-angle` 不同。
- 全屏使用自绘 `fullscreen` 图标，线宽与 `pip` 一致，渲染 22px；不改变 ArtPlayer 的全屏行为。
- `timestampNote` 图标重绘为与 `camera` 同高的 22px 视觉盒；`playlist` 图标底部基线对齐 `image`。
- 快捷键补齐：截图、画中画、画面菜单、播放列表、循环、倍速、旋转、字幕、时间戳笔记、快捷键说明；总览「媒体」家族列出。

## D-4 菜单几何与图标

- `MENU_WIDTH` 264 → 176；颜色面板宽度 168；行高维持 36，网格前两行 gap 收紧。
- 插入菜单与转换菜单共用宽度常量，互替换不跳位。
- 去掉「插入 CSS」「对齐与缩进」行的图标；视频/文件改用 `video`，表格/内嵌网页改用新绘制的网格/浏览器框，分栏与轮盘 `columns` 图标同源。
- 颜色、对齐、缩放二级面板改为在触发行下方展开；指针移入面板或移出 240ms 内不关闭（keep-open）。
- 剪切块图标改为剪刀（新增 `ScissorsOutlined`）。

## D-5 折叠

- 编辑态 CSS 从 `.cm-summon-zone .cm-fold-toggle` 改为 `.cm-summon-zone .cm-line:hover .cm-fold-toggle`：只有指针所在行显示；自身 hover/focus/已折叠仍显示。
- 预览态在渲染后的标题前插入 `button.preview-heading-fold`；点击隐藏后续兄弟节点直到下一个同级/更高级标题；按钮默认 `opacity:0`，标题 hover 或已折叠时显示。

## D-6 表格

编辑态 `.cm-table th/td` 与预览态 `.preview-content th/td` 增加 `border-right: 1px solid color-mix(in srgb, var(--app-border) 45%, transparent)`（预览用 `--reader-line`），最后一列不画。

## D-7 其他

- ⌘O 过滤器：文档加 `sh/bash/zsh/fish/ps1`，图片加 `heif/heic`，新增音频过滤器；Rust `BINARY_EXTENSIONS` 与前端 `fileType`/`mediaUrl` 同步。
- 栏目「更多」增加 `refresh`：`open_file_direct` 后复用 `openFile(path, content)` 更新已有页签。
- 页签改名输入框 `width: 1.5 × 当前`（`16ch` → `24ch`）。
- 左侧栏 overlay `z-index` 35 → 60，高于媒体宿主 40。

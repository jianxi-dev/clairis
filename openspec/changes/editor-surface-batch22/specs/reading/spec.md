## MODIFIED Requirements

### Requirement: 嵌入视频显示与播放

Markdown 预览/编辑态与 HTML 预览中嵌入的视频 SHALL 正常显示并可播放；内嵌播放控件的音量与进度滑块 SHALL 可见且可拖动，SHALL NOT 被白色色块覆盖。

**首帧 poster**：未播放的视频块 SHALL 显示首帧 poster（取帧），SHALL NOT 呈现黑屏。取帧 SHALL 复用阅读空间卡片的做法（注册 `media://` → `preload` → `onLoadedMetadata` seek 取帧）；取帧失败 SHALL 回落到类型色占位而非黑屏。

#### Scenario: 两处视频可播放

- **WHEN** 用户打开含视频链接的 Markdown 与 HTML 文档
- **THEN** 两处 `video` 节点数 SHALL 各为 1，`controls` SHALL 为 `true`，播放后 `currentTime` SHALL 大于 0

#### Scenario: 滑块可见

- **WHEN** 用户查看内嵌视频控件
- **THEN** 音量滑块 thumb 的宽度 SHALL 大于 0，且与轨道颜色有可见对比

#### Scenario: 未播放显示首帧

- **WHEN** 用户打开含视频链接的文档且视频尚未播放
- **THEN** 视频块 SHALL 显示首帧画面（poster 或取帧），SHALL NOT 为黑屏

### Requirement: 内嵌文件渲染

Markdown 中插入的 pdf / md / html / 内嵌页面等文件 SHALL 在正文中内嵌渲染真实内容，SHALL NOT 只显示文件名 / 链接。内嵌块默认高度 SHALL 约一屏，SHALL 支持调整显示高宽，内容 SHALL 可滚动。滚动到某区域后鼠标滑出 SHALL 定格，再次打开 SHALL 保持该定格（持久化到文档级 view-state）。内嵌块 SHALL 支持切换「只显示文件名 / 链接」与「显示内容」；仅显示名称 / 链接时鼠标滑入 SHALL 弹出悬浮窗预览内容。点击支持本产品打开的链接文件 SHALL 在新标签页打开。

**三视图交互**：内嵌文件块 SHALL 支持 `embed`（文本视图）/ `card`（卡片视图）/ `preview`（预览视图）三态，工具条以三个图标（列表 / 卡片 / 图片，顺序固定）切换，当前态高亮。各态点击语义：`embed` 滑入显示工具条、点击文件名打开；`card` / `preview` 单击显示工具条、再点文件名打开；`preview` 先点击选中、再点打开。头部 `.cm-embed-name` 的 click SHALL NOT 无条件劫持为 `openInNewTab`，SHALL 按当前态语义分发。卡片视图宽度 SHALL 取 quiet 基准（400px）。

#### Scenario: 内嵌渲染内容

- **WHEN** 用户在 Markdown 中插入一个 pdf / md / html 文件
- **THEN** 正文中 SHALL 出现内嵌内容节点（iframe / 渲染容器），SHALL NOT 只显示文件名

#### Scenario: 默认一屏高与可调

- **WHEN** 用户插入一个内嵌文件
- **THEN** 内嵌块默认高度 SHALL 约一屏；拖拽边缘后其高度 / 宽度 SHALL 随之变化

#### Scenario: 滚动定格与重开保持

- **WHEN** 用户把内嵌内容滚动到某区域后把鼠标滑出，再重新打开该文档
- **THEN** 内嵌块 SHALL 恢复到滑出时的定格位置

#### Scenario: 名称态与悬浮预览

- **WHEN** 用户把内嵌块切换为「只显示文件名 / 链接」
- **THEN** 内容节点 SHALL 隐藏；鼠标滑入时 SHALL 出现悬浮窗预览内容

#### Scenario: 链接新标签页打开

- **WHEN** 用户点击内嵌块中支持本产品打开的链接文件
- **THEN** 该文件 SHALL 在新标签页中打开

#### Scenario: 三态图标切换

- **WHEN** 用户选中内嵌文件块并查看工具条
- **THEN** 工具条 SHALL 含三个图标（列表 / 卡片 / 图片，顺序固定）；点击切换后当前态图标 SHALL 高亮，视图 SHALL 随之变化

#### Scenario: 卡片态单击不打开

- **WHEN** 内嵌块处于卡片视图，用户单击卡片
- **THEN** 工具条 SHALL 显示，文件 SHALL NOT 被打开；再次点击文件名后 SHALL 打开

#### Scenario: 预览态先选中再打开

- **WHEN** 内嵌块处于预览视图，用户单击预览区
- **THEN** 该块 SHALL 进入选中态，文件 SHALL NOT 被打开；再次点击文件名后 SHALL 打开

### Requirement: A-9 阅读进度与位置恢复

阅读模式下 SHALL 常驻一条"墨线"进度指示：位于滚动区域右边缘（距右边距 3px）、宽 2px、高度覆盖整个文档滚动区域；已读部分（上）为 rgba(0,0,0,0.14)、未读部分（下）为 rgba(0,0,0,0.04)，以自然明暗过渡为分界，无额外标记。墨线 SHALL 在滚动时实时更新（requestAnimationFrame，约 16ms 节流），不 hover 展开、无章节节点、无剩余时间/字数面板；沉浸态与编辑态 SHALL 不显示墨线。位置恢复 SHALL 基于 tabs store 的 `tabs[].scrollPos` + `contentHeight` 运行时字段，跨会话持久化 SHALL 存放于现有 `config.json` 的 `scrollPositions` 映射（key 为文件路径，不新建 JSON 文件）：滚动停止 200ms debounce 写入，切换/关闭 tab 与关闭窗口时立即写入；恢复时高度未变按像素跳转、高度变化按百分比恢复、无记录跳顶部。

**模式切换保持位置**：edit / preview / source 三种模式之间切换时，内容区 SHALL 保留当前阅读位置，SHALL NOT 滚回顶部。位置映射 SHALL 基于「当前视口中心行的文档偏移」（行锚点），切回时按同一偏移恢复；SHALL NOT 依赖 `scrollTop` 像素值。

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

#### Scenario: 模式切换不回顶

- **WHEN** 用户在编辑态滚动到文档中部后切到预览态，再切回编辑态
- **THEN** 两次切换后内容区 SHALL 定位到切换前的文档偏移（视口中心行差异 ≤ 2 行），SHALL NOT 回到顶部

## ADDED Requirements

### Requirement: 链接文件点击打开与修饰键悬停浮窗

文档内指向本地文档的链接 SHALL 支持：普通点击 = 打开该文档；⌘/Ctrl + 鼠标悬停 = 显示文件卡片式悬浮窗（复用 `openPreview` / `FloatingPreview`）。非修饰键悬停 SHALL NOT 唤出悬浮窗（避免误触）。

#### Scenario: 点击打开本地文档链接

- **WHEN** 用户点击正文中指向本地文档的链接
- **THEN** 该文档 SHALL 被打开（新标签页或当前页签，按既有打开语义）

#### Scenario: 修饰键悬停显示浮窗

- **WHEN** 用户按住 ⌘（macOS）或 Ctrl 并把指针悬停在一个本地文档链接上
- **THEN** 文件卡片式悬浮窗 SHALL 出现，内容与被链接文档一致

#### Scenario: 非修饰键悬停不显示浮窗

- **WHEN** 用户不按修饰键直接把指针悬停在一个本地文档链接上
- **THEN** 悬浮窗 SHALL NOT 出现

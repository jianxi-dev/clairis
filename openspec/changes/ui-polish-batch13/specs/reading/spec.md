# reading（delta）— ui-polish-batch13

## ADDED Requirements

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

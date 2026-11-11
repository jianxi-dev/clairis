# reading（delta）— ui-polish-batch15

## MODIFIED Requirements

### Requirement: 视频连播与画面适配

视频播放结束后 SHALL 自动播放下一个可播放项；带旋转元数据的视频 SHALL 按元数据转正，并 SHALL 在可用区域内完整显示（不横躺、不溢出容器）。

#### Scenario: 连播与竖拍视频
- **WHEN** 用户播放列表中的第一个视频直到结束，或打开一个竖拍视频
- **THEN** 当前播放项变为第 2 项；竖拍画面朝向正确且完整落在容器内（A-1.1–A-1.3）

### Requirement: PDF 按钮栏固定显隐

PDF 顶部按钮栏 SHALL 支持固定显示与固定隐藏两种状态，并 SHALL 提供对应快捷键；该状态 SHALL 只影响当前 PDF 视图，SHALL NOT 改写文档。

#### Scenario: 固定隐藏与快捷键恢复
- **WHEN** 用户对 PDF 执行固定隐藏，再按快捷键
- **THEN** 按钮栏计算 display 为 none，快捷键切换后可见；切换文档后恢复默认且无残留（A-8.1–A-8.2）

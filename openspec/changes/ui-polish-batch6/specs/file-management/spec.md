## MODIFIED Requirements

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频，播放器 SHALL 提供：自定义控制条、快捷键（空格 播放/暂停、`←`/`→` 快退/快进、`↑`/`↓` 音量、`F` 全屏、`M` 静音，仅播放器聚焦时生效）、记忆播放位置（再次打开提示并可跳转）、网页全屏、倍速播放。倍速菜单 SHALL 提供 0.5× / 0.75× / 1.0× / 1.25× / 1.5× / 2.0× 六档；切换倍速 SHALL NOT 改变音高与语音清晰度（`preservesPitch` 保持为真）；切换视频文件后倍速 SHALL 复位为 1.0×。非 Tauri 环境（浏览器 dev / 无 mock e2e）打开视频 SHALL 优雅降级显示提示而非抛错白屏，与图片/PDF 占位行为一致。

#### Scenario: 打开视频文件即播放

- **WHEN** 用户打开 `.mp4` / `.mov` / `.webm` / `.m4v` / `.mkv` / `.avi` 视频文件
- **THEN** 预览区 SHALL 渲染播放器并自动播放，视频经 `media://` 协议 Range 流式加载（大文件可 seek，不整文件读入前端内存）

#### Scenario: 快捷键控制播放

- **WHEN** 播放器聚焦时按下 空格 / `←`/`→` / `↑`/`↓` / `F` / `M`
- **THEN** SHALL 执行对应 播放暂停 / 快退快进 / 音量 / 网页全屏 / 静音 操作，且不干扰编辑器快捷键

#### Scenario: 记忆播放位置

- **WHEN** 用户再次打开同一视频文件
- **THEN** SHALL 提示上次播放位置并支持跳转继续播放

#### Scenario: 网页全屏

- **WHEN** 用户双击视频或按 `F` 键
- **THEN** SHALL 切换网页全屏（铺满应用窗口，规避 WKWebView 原生全屏不可靠问题）

#### Scenario: Web 模式优雅降级

- **WHEN** 在无 Tauri 环境（浏览器 dev server / 无 mock e2e）打开视频文件
- **THEN** SHALL 显示「无法预览」类提示而非抛出异常导致整页白屏，行为与图片/PDF 降级一致

#### Scenario: 倍速播放不改音调

- **WHEN** 用户打开倍速菜单并选择 1.5×
- **THEN** 视频 SHALL 以 1.5 倍速播放，`playbackRate` 为 1.5，且 `preservesPitch` SHALL 为真（音高不变）


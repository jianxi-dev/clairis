## MODIFIED Requirements

### Requirement: C-4 新建文档

`Cmd+N` SHALL 建立一个空白编辑页，初始内容为空字符串（`""`），不插入任何默认问候语或模板内容；新建文档 SHALL 默认为 Markdown 类型（`.md`），页签 SHALL 显示 Markdown 类型图标（SHALL NOT 显示文本图标）。新建 SHALL 使用户进入工作区栏目页（SHALL NOT 停留在首页/门户场景）。首次保存时 SHALL 由用户选择路径与文件名。内置示例文件经由独立释放机制提供（见 application-shell 域 B-4），不进入新建文档流程。

#### Scenario: 新建为纯空白页

- **WHEN** 用户按 `Cmd+N`
- **THEN** 应用 SHALL 打开一个初始内容为空字符串的空白编辑页，不含默认文案

#### Scenario: 默认 Markdown 与图标

- **WHEN** 用户新建一个文件
- **THEN** 页签 SHALL 显示 Markdown 类型图标，该页签 SHALL 为 Markdown 类型

#### Scenario: 新建后进入栏目页

- **WHEN** 用户在首页/门户点击「新建文件」
- **THEN** 应用 SHALL 离开首页进入工作区栏目页并显示该新建页签

#### Scenario: 首次保存选择路径

- **WHEN** 用户对尚未落盘的新建文档首次执行保存
- **THEN** 应用 SHALL 弹出路径与文件名选择，随后才写入磁盘

#

## Requirement: C-6 视频预览播放器

视频预览 SHALL 提供播放器（播放/暂停/进度/音量/倍速/循环/全屏/画中画/字幕/快捷键说明等）。当用户在同一格切换到另一个视频文件时，页签标题 SHALL 同步更新为新文件的名称（SHALL NOT 保留旧文件名）。

#### Scenario: 切换视频后页签名更新

- **WHEN** 用户在某格打开视频 A，随后切换到视频 B
- **THEN** 该格页签标题 SHALL 显示视频 B 的文件名

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


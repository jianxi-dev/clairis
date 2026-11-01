# file-management — 文件管理基础当前规格

## Purpose

file-management 域定义标月桌面端的文件管理基础能力：按格式分流打开文件、拖拽打开、自动保存、新建文档，以及统一文件面板中的"全部文件"视图。本规格是 file-management 域可验收功能行为的唯一真相源；条目编号（C-1 至 C-5）与 `docs/MVP-需求跟踪表.md` 模块 C 一一对应。保存写入的原子性与写入保护规格见 editing 域 E-3。

## 设计来源与参考

- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵（Phase M：打开文件、拖拽打开、新建文档、自动保存 2s debounce；Phase R：全部文件视图）、§三 快捷键体系（Cmd+O / Cmd+N）；`docs/MVP-需求跟踪表.md` 模块 C（C-1 至 C-5 均标 ✅）
- C-5 批准设计（全部文件视图）：`docs/design/approved/navigation/spec.md` §3.2（经由统一文件面板呈现，面板整体规格见 navigation 域 B-3）
## Requirements
### Requirement: C-1 打开文件

应用 SHALL 支持 `Cmd+O` 经由文件选择对话框打开文件，并按格式分流：文本类文件（`.md` / `.html` / `.txt` / `.py` / `.yaml` / `.json` / `.js` / `.ts` / `.css` / `.csv` 等）SHALL 以源码模式打开；媒体类文件（`.pdf` / `.jpg` / `.png` / `.gif` / `.mp4` / `.mov`）SHALL 以预览模式打开。代码类文件（`.css` / `.py` / `.json` / `.js` / `.ts` / `.yaml` 等）SHALL 以编辑模式打开并呈现对应语法高亮；媒体类文件 SHALL 在预览模式渲染对应内容（图片显示、视频播放），SHALL 禁止切换到编辑/源码模式，且 SHALL 禁止保存或自动保存回写（防止空内容破坏二进制文件）。媒体类 `.pdf` 文件 SHALL 以预览模式打开，渲染为功能完整的阅读器：分页滚动与页码导航、缩放与平移、全文搜索与结果高亮、缩略图与大纲侧栏、打印、旋转，界面文案为中文；PDF 查看器 SHALL 隐藏批注、导出、全屏、签名、表单、图章等未启用功能（界面不出现相关入口）；PDF 正文 SHALL 按位图渲染，SHALL 在 macOS 真机上支持文字型 PDF 正文文字选中与复制（实测确认 2026-08-31），扫描件/图片型 PDF 与无头自动化环境 SHALL 不可选。

#### Scenario: 文本类文件源码打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.md`（或 `.py` / `.json` 等文本类）文件
- **THEN** 该文件 SHALL 以源码/编辑模式打开

#### Scenario: 代码类文件语法高亮

- **WHEN** 用户按 `Cmd+O` 选择一个 `.py` / `.json` / `.js` / `.ts` / `.yaml` / `.css` 文件并进入编辑/源码模式
- **THEN** 代码 SHALL 呈现对应语言的 CM6 语法高亮

#### Scenario: 媒体类文件预览打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.pdf`（或 `.png` / `.mp4` 等媒体类）文件
- **THEN** 该文件 SHALL 以预览模式打开：图片显示、视频可播放、PDF 以阅读器打开

#### Scenario: PDF 查看器常用功能

- **WHEN** 用户在预览模式打开 `.pdf` 文件
- **THEN** 查看器 SHALL 提供分页滚动与页码导航、缩放与平移、全文搜索与结果高亮、缩略图与大纲侧栏、打印、旋转，且界面文案为中文

#### Scenario: PDF 隐藏未启用功能

- **WHEN** 用户打开 PDF 查看器
- **THEN** 批注、导出、全屏、签名、表单、图章等未启用功能的入口 SHALL 不出现

#### Scenario: 文字型 PDF 正文可选中复制

- **WHEN** 用户在 macOS 真机打开文字型 PDF 并拖选正文
- **THEN** 正文文字 SHALL 可选中并复制

#### Scenario: 扫描件 PDF 正文不可选

- **WHEN** 用户打开扫描件/图片型 PDF 并拖选正文
- **THEN** 正文文字 SHALL 无法选中

#### Scenario: 媒体文件不可编辑

- **WHEN** 用户打开媒体文件后尝试切换到编辑/源码模式（按钮或快捷键）
- **THEN** 模式 SHALL 保持不变（仍为预览），编辑界面 SHALL 不出现

#### Scenario: 媒体文件不写回

- **WHEN** 用户打开媒体文件并触发保存或自动保存路径
- **THEN** 该文件 SHALL 不被写入（内容保持原字节不变）

### Requirement: C-2 拖拽打开

应用 SHALL 支持将文件拖入窗口、松开即打开，支持的格式范围 SHALL 与 C-1 完全一致（文本类进源码模式、媒体类进预览模式）。

#### Scenario: 拖入窗口即打开

- **WHEN** 用户将一个支持格式的文件从 Finder 拖入标月窗口并松开
- **THEN** 该文件 SHALL 直接打开（无需额外确认），打开模式按 C-1 的格式分流规则确定

### Requirement: C-3 自动保存

编辑停止后 SHALL 经过 2 秒防抖（debounce）自动写入磁盘，无需用户手动触发。

#### Scenario: 停止编辑自动写入

- **WHEN** 用户在文档中输入后停止编辑并保持 2 秒
- **THEN** 应用 SHALL 自动将内容写入磁盘

#### Scenario: 持续编辑不重复写入

- **WHEN** 用户以小于 2 秒的间隔连续输入
- **THEN** 自动保存 SHALL 被防抖延后到停止输入 2 秒后执行

### Requirement: C-4 新建文档

`Cmd+N` SHALL 建立一个空白编辑页，初始内容为空字符串（`""`），不插入任何默认问候语或模板内容；首次保存时 SHALL 由用户选择路径与文件名。内置示例文件经由独立释放机制提供（见 application-shell 域 B-4），不进入新建文档流程。

#### Scenario: 新建为纯空白页

- **WHEN** 用户按 `Cmd+N`
- **THEN** 应用 SHALL 打开一个初始内容为空字符串的空白编辑页，不含默认文案

#### Scenario: 首次保存选择路径

- **WHEN** 用户对尚未落盘的新建文档首次执行保存
- **THEN** 应用 SHALL 弹出路径与文件名选择，随后才写入磁盘

### Requirement: C-5 全部文件视图

统一文件面板的"全部"视图 SHALL 列出工作目录下的所有文件，按修改时间（mtime）倒序排列；默认显示 20 条，超出部分 SHALL 折叠为"显示全部 →"入口，点击后展开完整列表。

#### Scenario: mtime 倒序与默认条数

- **WHEN** 用户在统一文件面板进入"全部"视图
- **THEN** 文件 SHALL 按 mtime 倒序排列，默认最多显示 20 条

#### Scenario: 超 20 条折叠

- **WHEN** 工作目录文件数超过 20
- **THEN** 列表 SHALL 截断为 20 条并显示"显示全部 →"；点击后 SHALL 展开全部文件

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频，播放器 SHALL 提供：自定义控制条、快捷键（空格 播放/暂停、`←`/`→` 快退/快进、`↑`/`↓` 音量、`F` 全屏、`M` 静音，仅播放器聚焦时生效）、记忆播放位置（再次打开提示并可跳转）、网页全屏。非 Tauri 环境（浏览器 dev / 无 mock e2e）打开视频 SHALL 优雅降级显示提示而非抛错白屏，与图片/PDF 占位行为一致。

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


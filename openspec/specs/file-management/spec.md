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

### Requirement: C-5 全部文件视图

统一文件面板的"全部"视图 SHALL 列出工作目录下的所有文件，按修改时间（mtime）倒序排列；默认显示 20 条，超出部分 SHALL 折叠为"显示全部 →"入口，点击后展开完整列表。

#### Scenario: mtime 倒序与默认条数

- **WHEN** 用户在统一文件面板进入"全部"视图
- **THEN** 文件 SHALL 按 mtime 倒序排列，默认最多显示 20 条

#### Scenario: 超 20 条折叠

- **WHEN** 工作目录文件数超过 20
- **THEN** 列表 SHALL 截断为 20 条并显示"显示全部 →"；点击后 SHALL 展开全部文件

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频。播放器 SHALL 提供：自定义控制条、快捷键（空格 播放/暂停、`←`/`→` 快退/快进、`↑`/`↓` 音量、`F` 全屏、`M` 静音，仅播放器聚焦时生效）、记忆播放位置（再次打开提示并可跳转）、网页全屏、倍速播放。倍速菜单 SHALL 提供 0.5× / 0.75× / 1.0× / 1.25× / 1.5× / 2.0× 六档；切换倍速 SHALL NOT 改变音高；切换视频文件后倍速 SHALL 复位为 1.0×。非 Tauri 环境 SHALL 优雅降级显示提示而非抛错白屏。

控制条 SHALL 采用控制高度 38px、图标盒 24px、图标绘制 22px、内边距 12px；右侧控制按钮 SHALL 统一为 38×38 命中盒并水平垂直居中，原生控件与自绘控件 SHALL 呈现一致的视觉尺寸。控制条 SHALL 在播放键左右各提供「上一集 / 下一集」按钮，点击切换同目录媒体列表中的相邻可播放项；列表为空时禁用。

控制条 SHALL 提供「画面」入口，其图标 SHALL 为可辨认的图片框构图（山与太阳），SHALL NOT 使用滑杆；二级面板 SHALL 为每项提供图标，独立的放大 / 缩小按钮 SHALL 存在，旋转按钮 SHALL 位于控制条上「字幕」按钮之前（而非藏在画面面板内）。「倍速」主控件 SHALL 使用速度表图标。

倍速、画面、播放列表、字幕、快捷键五个控件 SHALL 各有一个二级菜单。二级菜单 SHALL 在指针滑入控件时显示、滑出控件或菜单后 180ms 内隐藏；点击 SHALL 同样可打开。二级菜单的水平中心默认 SHALL 与触发时的鼠标 x 对齐，仅在触及播放器左右边界时 SHALL 被钳制在可视区内。网页全屏态下二级菜单 SHALL 与普通态一致可用；全屏时菜单 SHALL 渲染在全屏层之上。

倍速菜单每档 SHALL 显示指针表盘：1.0× 指针指 12 点位，低于 1.0× 偏左、高于 1.0× 偏右，角度随倍速单调变化。

进度条 SHALL 在指针悬停时显示当前位置的缩略图预览；缩略图 SHALL 对应当前正在播放的媒体，切换文件或播放列表集数后 SHALL 更新为新媒体的帧。抽帧失败时 SHALL 只显示时间提示，SHALL NOT 阻塞播放。

「截取当前画面」SHALL 直接把当前帧 PNG 写入系统剪贴板，并以应用内提示「截图已复制到剪贴板」确认；提示 SHALL 显示在截图按钮正上方，SHALL NOT 使用播放器顶部通知。SHALL NOT 打开「另存为」对话框；剪贴板写入失败时 SHALL 回退为下载并提示失败原因。

视频快捷键 SHALL 并入全局快捷键总览的「媒体」家族（至少含 播放/暂停、快退/快进、音量、全屏、静音、上一集/下一集、循环、字幕轨道、字幕位置、时间戳笔记、退出全屏、双击全屏）。快捷键说明图标 SHALL 为圆角键盘外框 + 两排键帽 + 空格键；快捷键浮层宽度 SHALL 为 168px。

#### Scenario: 进度条悬停缩略图

- **WHEN** 指针悬停在视频进度条的某一位置
- **THEN** SHALL 出现 1 个缩略图预览节点，其内容对应该位置的时间点

#### Scenario: 缩略图随媒体切换

- **WHEN** 用户切换到另一个视频文件或播放列表中的下一集，再悬停进度条
- **THEN** 缩略图 SHALL 来自新媒体对应时间点，不得仍是首个视频的画面

#### Scenario: 截图入剪贴板

- **WHEN** 用户点击「截取当前画面」
- **THEN** 剪贴板 SHALL 收到 1 次 PNG 写入，SHALL 出现提示，系统「另存为」调用次数 SHALL 为 0

#### Scenario: 截图提示位于按钮上方

- **WHEN** 截图完成
- **THEN** 提示节点的底边 SHALL 位于截图按钮顶边之上（差值 ≥4px）

#### Scenario: 全屏下二级菜单可用

- **WHEN** 播放器处于网页全屏态，用户把指针移入倍速控件
- **THEN** 倍速二级菜单 SHALL 出现，SHALL NOT 显示「全屏下不可用」

#### Scenario: 二级菜单 hover 显隐

- **WHEN** 用户把指针移入画面控件再移出
- **THEN** 画面菜单 SHALL 出现，移出 180ms 后 SHALL 关闭

#### Scenario: 菜单以鼠标为中心

- **WHEN** 用户在播放器中部把指针移入字幕控件
- **THEN** 菜单水平中心与鼠标 x 的差值 SHALL ≤2px（未触及边界时）

#### Scenario: 控制条尺寸统一

- **WHEN** 测量视频控制条右侧全部按钮
- **THEN** 每个 `.art-control` SHALL 为 38×38，图标盒 SHALL 为 24×24，自绘 svg SHALL 为 22×22

#### Scenario: 倍速表盘指针角度

- **WHEN** 打开倍速菜单
- **THEN** 每档 SHALL 有一个 `data-rate-dial` 表盘；1.0× 的 `data-angle` SHALL 为 0，0.5× SHALL 小于 0，2.0× SHALL 大于 0

#### Scenario: 快捷键与画面图标可辨认

- **WHEN** 用户查看右侧控制条
- **THEN** 快捷键图标 SHALL 含圆角键盘外框与空格键；画面图标 SHALL 为图片框构图，SHALL NOT 为滑杆

#### Scenario: 快捷键总览含视频条目

- **WHEN** 用户打开快捷键总览
- **THEN** 「媒体」家族 SHALL 列出不少于 10 条视频快捷键

#### Scenario: 打开视频文件即播放

- **WHEN** 用户打开 `.mp4` / `.mov` / `.webm` / `.m4v` / `.mkv` / `.avi` 视频文件
- **THEN** 预览区 SHALL 渲染播放器并自动播放，视频经 `media://` 协议 Range 流式加载

#### Scenario: 快捷键控制播放

- **WHEN** 播放器聚焦时按下 空格 / `←`/`→` / `↑`/`↓` / `F` / `M`
- **THEN** SHALL 执行对应 播放暂停 / 快退快进 / 音量 / 网页全屏 / 静音 操作，且不干扰编辑器快捷键

#### Scenario: 记忆播放位置

- **WHEN** 用户再次打开同一视频文件
- **THEN** SHALL 提示上次播放位置并支持跳转继续播放

#### Scenario: 网页全屏

- **WHEN** 用户双击视频或按 `F` 键
- **THEN** SHALL 切换网页全屏

#### Scenario: Web 模式优雅降级

- **WHEN** 在无 Tauri 环境打开视频文件
- **THEN** SHALL 显示「无法预览」类提示而非抛出异常导致整页白屏

#### Scenario: 倍速播放不改音调

- **WHEN** 用户打开倍速菜单并选择 1.5×
- **THEN** 视频 SHALL 以 1.5 倍速播放，`playbackRate` 为 1.5，且 `preservesPitch` SHALL 为真

#### Scenario: 上一集与下一集

- **WHEN** 同目录存在多个媒体文件，用户点击上一集或下一集
- **THEN** 播放器 SHALL 切换到相邻项并继续播放，倍速与循环模式 SHALL 保持

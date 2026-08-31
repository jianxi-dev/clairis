## MODIFIED Requirements

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

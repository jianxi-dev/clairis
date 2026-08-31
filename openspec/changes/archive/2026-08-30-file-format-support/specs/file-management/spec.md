## MODIFIED Requirements

### Requirement: C-1 打开文件

应用 SHALL 支持 `Cmd+O` 经由文件选择对话框打开文件，并按格式分流：文本类文件（`.md` / `.html` / `.txt` / `.py` / `.yaml` / `.json` / `.js` / `.ts` / `.css` / `.csv` 等）SHALL 以源码模式打开；媒体类文件（`.pdf` / `.jpg` / `.png` / `.gif` / `.mp4` / `.mov`）SHALL 以预览模式打开。代码类文件（`.css` / `.py` / `.json` / `.js` / `.ts` / `.yaml` 等）SHALL 以编辑模式打开并呈现对应语法高亮；媒体类文件 SHALL 在预览模式渲染对应内容（图片显示、视频播放、PDF 内嵌查看），SHALL 禁止切换到编辑/源码模式，且 SHALL 禁止保存或自动保存回写（防止空内容破坏二进制文件）。

#### Scenario: 文本类文件源码打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.md`（或 `.py` / `.json` 等文本类）文件
- **THEN** 该文件 SHALL 以源码/编辑模式打开

#### Scenario: 代码类文件语法高亮

- **WHEN** 用户按 `Cmd+O` 选择一个 `.py` / `.json` / `.js` / `.ts` / `.yaml` / `.css` 文件并进入编辑/源码模式
- **THEN** 代码 SHALL 呈现对应语言的 CM6 语法高亮

#### Scenario: 媒体类文件预览打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.pdf`（或 `.png` / `.mp4` 等媒体类）文件
- **THEN** 该文件 SHALL 以预览模式打开：图片显示、视频可播放、PDF 内嵌可见

#### Scenario: 媒体文件不可编辑

- **WHEN** 用户打开媒体文件后尝试切换到编辑/源码模式（按钮或快捷键）
- **THEN** 模式 SHALL 保持不变（仍为预览），编辑界面 SHALL 不出现

#### Scenario: 媒体文件不写回

- **WHEN** 用户打开媒体文件并触发保存或自动保存路径
- **THEN** 该文件 SHALL 不被写入（内容保持原字节不变）

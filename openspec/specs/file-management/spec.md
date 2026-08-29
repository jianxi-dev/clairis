# file-management — 文件管理基础当前规格

## Purpose

file-management 域定义渐晰桌面端的文件管理基础能力：按格式分流打开文件、拖拽打开、自动保存、新建文档，以及统一文件面板中的"全部文件"视图。本规格是 file-management 域可验收功能行为的唯一真相源；条目编号（C-1 至 C-5）与 `docs/MVP-需求跟踪表.md` 模块 C 一一对应。保存写入的原子性与写入保护规格见 editing 域 E-3。

## 设计来源与参考

- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵（Phase M：打开文件、拖拽打开、新建文档、自动保存 2s debounce；Phase R：全部文件视图）、§三 快捷键体系（Cmd+O / Cmd+N）；`docs/MVP-需求跟踪表.md` 模块 C（C-1 至 C-5 均标 ✅）
- C-5 批准设计（全部文件视图）：`docs/design/approved/navigation/spec.md` §3.2（经由统一文件面板呈现，面板整体规格见 navigation 域 B-3）

## Requirements

### Requirement: C-1 打开文件

应用 SHALL 支持 `Cmd+O` 经由文件选择对话框打开文件，并按格式分流：文本类文件（`.md` / `.html` / `.txt` / `.py` / `.yaml` / `.json` / `.js` / `.ts` / `.css` / `.csv` 等）SHALL 以源码模式打开；媒体类文件（`.pdf` / `.jpg` / `.png` / `.gif` / `.mp4` / `.mov`）SHALL 以预览模式打开。

#### Scenario: 文本类文件源码打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.md`（或 `.py` / `.json` 等文本类）文件
- **THEN** 该文件 SHALL 以源码/编辑模式打开

#### Scenario: 媒体类文件预览打开

- **WHEN** 用户按 `Cmd+O` 选择一个 `.pdf`（或 `.png` / `.mp4` 等媒体类）文件
- **THEN** 该文件 SHALL 以预览模式打开

### Requirement: C-2 拖拽打开

应用 SHALL 支持将文件拖入窗口、松开即打开，支持的格式范围 SHALL 与 C-1 完全一致（文本类进源码模式、媒体类进预览模式）。

#### Scenario: 拖入窗口即打开

- **WHEN** 用户将一个支持格式的文件从 Finder 拖入渐晰窗口并松开
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

# application-shell — 界面外壳与空状态当前规格

## Purpose

application-shell 域定义渐晰桌面端的整体界面布局决策与空状态体验：无边栏外壳（移除左侧栏、无右侧边栏、单一顶栏）、可选正文分栏，以及空状态的分块叠加、内置示例文件释放与空状态设计规则。本规格是 application-shell 域可验收功能行为的唯一真相源；条目编号（G-1 至 G-5 界面布局、B-2 / B-4 / B-5 空状态）与 `docs/MVP-需求跟踪表.md` 模块 G / B 一一对应。

## 设计来源与参考

- G-1 至 G-5 批准设计：`docs/design/approved/shell-ui/spec.md`（无侧栏外壳与 Chrome Bar 决策）
- B-2 / B-4 / B-5 批准设计：`docs/design/approved/empty-state/spec.md`（空状态分块、示例文件释放与标记机制）；示例文件内容见 `src-tauri/samples/`
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口、内置示例文件）、4.5（文档模式分栏规则）；`docs/MVP-需求跟踪表.md` 模块 G / B（均标 ✅）
- 启动面板/欢迎页（B-1）与统一文件面板（B-3）归属 navigation 域

## Requirements

### Requirement: G-1 移除左侧栏逻辑

应用外壳 SHALL 移除左侧栏：Toolbar 中的左栏按钮 SHALL 被移除，用于切换左侧栏的旧 `Cmd+\` 快捷键 SHALL 被移除，布局参数 `leftSidebar` SHALL 传 null。导航职责由统一文件面板（Cmd+P，见 navigation 域 B-3）承担。

#### Scenario: 左侧栏入口不存在

- **WHEN** 用户查看应用外壳界面
- **THEN** Toolbar SHALL 不出现左栏切换按钮，左侧 SHALL 不渲染侧栏区域（leftSidebar = null）

### Requirement: G-2 无右侧边栏

应用外壳 SHALL 不渲染右侧边栏（无边栏哲学：收回原右侧边栏设计）；导航由 `Cmd+P` 统一文件面板承担，不另设右侧导航栏。

#### Scenario: 右侧边栏不存在

- **WHEN** 用户查看应用外壳界面
- **THEN** 右侧 SHALL 不渲染任何边栏/导航占位区域

### Requirement: G-3 单一顶栏（Chrome Bar）

应用外壳 SHALL 以单一顶栏（Chrome Bar，高度 40px，常驻显示）承载原工具栏职责；独立的 Toolbar 组件 SHALL 取消，不再需要 hover 触发的工具栏淡入。

#### Scenario: 顶栏常驻

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 顶部 SHALL 显示 40px 的单一 Chrome Bar，不存在第二个独立工具栏

### Requirement: G-5 正文分栏（可选）

应用 SHALL 支持可选的正文分栏：`Cmd+Option+→` / `Cmd+Option+↓` 触发左右/上下分栏，亦可将页签拖拽到窗格边缘生成分栏；分栏分隔线 SHALL 在 hover 时给出可视暗示；每个窗格 SHALL 拥有独立的 TabBar。

#### Scenario: 快捷键分栏

- **WHEN** 用户按 `Cmd+Option+→`
- **THEN** 正文 SHALL 生成左右分栏，且每个窗格有独立 TabBar

#### Scenario: 拖拽页签分栏

- **WHEN** 用户把页签拖拽到当前窗格边缘
- **THEN** 分隔线 SHALL 在 hover 时显示落位暗示，松开后 SHALL 按暗示方向生成分栏

### Requirement: B-2 空状态继续区分块

存在近期文件记录（RecentFile）后，空状态 SHALL 在欢迎页下方按数据分块叠加两个区域：「上次停在这」（RecentFile[0] + scrollPos + 最近编辑位置 → 最近 heading 与内容片段，提供"继续阅读"；scrollPos=0 时退化为"继续打开"）与「最近保存」（`list_files` 按 mtime 倒序取 5 个 `.md`/`.html` 文件，以横向滚动 chips 呈现）。分块 SHALL 按数据可用性显示（非 if/else 二选一）：首次安装仅显示欢迎页；有 RecentFile 时显示继续区 + 最近保存；仅有文件夹文件时显示欢迎页 + 最近保存；`list_files` 失败时对应 section 静默隐藏、不报错。最近保存 chip SHALL 以三层递减视觉呈现（文件名 → 内容首行 → 时间），chips 末尾的"+N 更多"SHALL 作为按钮跳转 Cmd+P。

#### Scenario: 继续上次与最近保存叠加

- **WHEN** 用户关闭全部文档且存在 RecentFile[0]（scrollPos > 0）
- **THEN** 空状态 SHALL 在欢迎页下方显示「上次停在这」卡片（含最近 heading/片段与"继续阅读"）和「最近保存」chips（5 个，横向滚动）

#### Scenario: 按数据分块降级

- **WHEN** 无 RecentFile 但工作目录存在文件
- **THEN** 空状态 SHALL 仅显示欢迎页 + 最近保存区；当 `list_files` 调用失败时最近保存区 SHALL 静默隐藏而不报错

#### Scenario: scrollPos=0 退化

- **WHEN** RecentFile[0] 的 scrollPos 为 0
- **THEN** 继续区 SHALL 退化为"继续打开"（不带位置恢复语义）

### Requirement: B-4 内置示例文件释放

应用 SHALL 在首次需要时将三个内置示例文件释放到 `~/Documents/Jianxi/`（大写 J 英文目录，失败时 fallback 到 `app_data_dir()/samples`）：`0-welcome.md`（欢迎页：定位 + 格式清单 + 快捷键 + 安全感 + CTA）、`1-markdown-demo.md`（GFM 全套示例）、`2-html-demo.html`（HTML + 内联 CSS 示例）。释放 SHALL 由 `.sample-bundle.json` marker 机制管理（记录每个文件的 sha256），防止重复释放并支持版本升级；示例内容 SHALL 经 Rust `include_str!` 在编译时嵌入，由 `ensure_sample_files()` 命令执行释放。

#### Scenario: 首次释放三个示例文件

- **WHEN** 应用首次运行且目标目录不存在 marker
- **THEN** `0-welcome.md`、`1-markdown-demo.md`、`2-html-demo.html` SHALL 被释放到 `~/Documents/Jianxi/`

#### Scenario: marker 防重复释放

- **WHEN** 已有 `.sample-bundle.json` 且对应文件 sha256 未变
- **THEN** `ensure_sample_files()` SHALL 不重复写入这些文件；marker 版本升级时 SHALL 按 sha256 差异更新

#### Scenario: 目标目录不可写降级

- **WHEN** `~/Documents/Jianxi/` 路径创建失败
- **THEN** 示例文件 SHALL 降级释放到 `app_data_dir()/samples`

### Requirement: B-5 空状态设计规则

空状态体验 SHALL 遵守四条规则：(1) 空白但不空旷——无文档打开时中央渲染 `0-welcome.md`；(2) 一键可达——主 CTA 位于首屏；(3) 历史是灵魂——「最近保存」chips 固定展示最近 5 个文件；(4) 快捷键提示——快捷键说明内嵌于欢迎页而非独立教程。

#### Scenario: 四条规则同时满足

- **WHEN** 新用户首次打开应用
- **THEN** 首屏 SHALL 渲染 `0-welcome.md`（空白但不空旷），主 CTA SHALL 在首屏可达，欢迎页内 SHALL 内嵌快捷键提示；存在历史时最近保存 chips SHALL 展示 5 个

## 待裁定与跨域冲突记录（非规范性）

以下为来源层面的已登记冲突，仅如实记录，不在本规格内裁定（裁定由后续 change/治理任务处理）：

- **Cmd+\ 键位冲突**：G-1 要求移除旧的"切换左侧栏"快捷键 `Cmd+\`；reading 域 A-5 将 `Cmd+\` 指定为沉浸阅读开关（来源：`docs/design/approved/immersive-reading/spec.md` v2）。两文件对同一键位的处置需在实现层统一（移除旧语义后即可由 A-5 占用），此处保留两边原意。
- **G-4 缺失**：`docs/MVP-需求跟踪表.md` 模块 G 仅登记 G-1 / G-2 / G-3 / G-5，无 G-4 行；G-4 的状态待跟踪表补齐后裁定。

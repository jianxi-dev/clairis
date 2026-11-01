# editing — 基础编辑能力当前规格

## Purpose

editing 域定义标月桌面端的基础编辑能力：阅读/源码模式切换、CodeMirror 6 L2 编辑美化、文件保存（含原子写入、未保存守卫与并发覆盖保护）以及 HTML 源码编辑。本规格是 editing 域可验收功能行为的唯一真相源；条目编号（E-1 至 E-4）与 `docs/MVP-需求跟踪表.md` 模块 E 一一对应。

## 设计来源与参考

- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵 Phase M（源码模式查看、加粗/斜体/删除线、语法高亮、工具栏、未保存守卫、并发覆盖保护、原子写入）、§三 快捷键体系；`docs/MVP-需求跟踪表.md` 模块 E（E-1 至 E-4 均标 ✅）
- 硬约束：模式切换（preview/edit/source）使用 CSS display 切换，不 remount EditorView，以保留 undo/选区/编辑状态（见 `AGENTS.md` 仓库约束与 `CONTEXT.md`）

## Requirements

### Requirement: E-1 源码模式

应用 SHALL 提供预览与源码模式的一键切换；切换 SHALL 保留编辑状态（不 remount 编辑器实例，undo 栈、选区、光标位置均保留）。

#### Scenario: 模式切换保留编辑状态

- **WHEN** 用户在编辑态已输入内容并产生 undo 历史后切换到源码模式，再切回
- **THEN** 编辑器内容、选区与 undo 历史 SHALL 保持不变（编辑器实例未重建）

### Requirement: E-2 GFM L2 编辑

编辑模式 SHALL 基于 CodeMirror 6 decoration 对核心语法标记做可视化美化，覆盖范围 SHALL 包括：加粗、斜体、引用、列表、标题、行内代码/代码块。美化 SHALL 不改变底层 Markdown 源码——保存结果与所见语义一致。IME 组合输入降级处理与 `Cmd+Click` 链接导航为 P1 polish，不属于当前已验收行为。

#### Scenario: 核心语法 decoration 美化

- **WHEN** 用户编辑包含粗体、斜体、引用、列表、标题、代码块标记的文档
- **THEN** 这些语法标记 SHALL 以 decoration 呈现美化效果（如标题放大、引用块样式化），且可见的语义与源码一致

#### Scenario: 编辑-保存往返无损

- **WHEN** 用户在 L2 编辑态修改内容并保存，再以源码模式打开同一文件
- **THEN** 源码 SHALL 与编辑语义一致，decoration SHALL 不向文件中注入展示性字符

### Requirement: E-3 保存文件与写入保护

文件保存 SHALL 支持 `Cmd+S` 手动保存，写入 SHALL 采用原子写入（tempfile→persist）。存在未保存修改（dirty）时，切换标签/导航目录/离开 SHALL 被未保存守卫拦截，三种编辑器模式 SHALL 使用统一 guard。写入前 SHALL 校验文件 mtime（编辑前记录 mtime），文件已被外部修改时 SHALL 防止盲覆盖。

#### Scenario: 手动保存原子写入

- **WHEN** 用户按 `Cmd+S` 保存
- **THEN** 内容 SHALL 以原子方式写入磁盘（临时文件落盘后 rename 持久化），不产生半写文件

#### Scenario: 未保存守卫拦截导航

- **WHEN** 文档处于 dirty 状态时用户尝试切换标签、切换目录或关闭离开
- **THEN** 应用 SHALL 拦截该操作并提示未保存（三种编辑模式行为一致）

#### Scenario: 并发覆盖保护

- **WHEN** 用户编辑期间文件被外部修改（磁盘 mtime 领先于编辑前记录值），此时用户触发保存
- **THEN** 应用 SHALL 检测到 mtime 变化并阻止盲覆盖，交由用户裁定，而不是静默覆盖外部修改

### Requirement: E-4 HTML 源码编辑

应用 SHALL 支持 `.html` 文件的源码编辑，使用 CodeMirror html() 模式提供 HTML 语法高亮。

#### Scenario: HTML 源码高亮编辑

- **WHEN** 用户将 `.html` 文件切换到源码/编辑模式
- **THEN** 内容 SHALL 以 HTML 语法高亮呈现并可编辑

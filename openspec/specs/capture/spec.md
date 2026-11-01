# capture — 灵感快速录入当前规格

## Purpose

条目编号（D-1 至 D-15）与 `docs/MVP-需求跟踪表.md` 模块 D 一一对应。D-3 至 D-15 的行为细节以 `docs/capture-overlay-SPEC.md`（v5.5）为准。

## 设计来源与参考

- D-3 至 D-15 实施规格书：`docs/capture-overlay-SPEC.md`（Capture Overlay v5.5，P0 逐项覆盖；对应设计 capture-overlay-v5.3 + v5.4 + v5.5 增补）
- D-1 至 D-2 与 D-6 至 D-9 登记来源：跟踪表标注的 `outline-quick-capture-final.md`
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §三 快捷键体系（Cmd+Shift+. 系统级全局，热启动 < 50ms / 冷启动 < 200ms；Cmd+Shift+, Inspector；Cmd+Shift+E 大纲侧栏；Cmd+R Headings Palette）、§二 阶段矩阵；`docs/MVP-需求跟踪表.md` 模块 D（D-1 至 D-15 均标 ✅）
## Requirements
### Requirement: D-1 大纲侧栏

应用 SHALL 提供 `Cmd+Shift+E` 打开的大纲侧栏：hover 时展开、可用图钉（Pin）固定展开，不占用标签页。

#### Scenario: Hover 展开与 Pin 固定

- **WHEN** 用户按 `Cmd+Shift+E` 唤出大纲侧栏并把鼠标悬停其上
- **THEN** 大纲 SHALL 展开显示；用户点击 Pin 后 SHALL 保持固定展开，不再依赖 hover

### Requirement: D-2 Headings Palette

应用 SHALL 提供 `Cmd+R` 打开的文档内标题面板（Headings Palette）：支持对标题做 fuzzy 搜索、右侧提供标题对应内容 Preview、Enter 跳转到所选标题位置。

#### Scenario: 搜索并跳转标题

- **WHEN** 用户按 `Cmd+R` 并输入关键字
- **THEN** 面板 SHALL 以 fuzzy 方式过滤文档标题，右侧显示所选标题的 Preview；按 Enter SHALL 跳转到该标题位置

### Requirement: D-3 Quick Capture 全局浮窗

`Cmd+Shift+.` SHALL 通过 Tauri v2 GlobalShortcut 注册为系统级全局快捷键，在任何 App 下均可唤起录入浮窗；热启动 SHALL < 50ms，冷启动 SHALL < 200ms；唤起时 SHALL 触发 Dock bounce 提示。浮窗 SHALL 显示在主窗口所在屏幕的右上区域（多屏时跟随主窗口监视器）。状态机 SHALL 为 closed ↔ normal（`Cmd+Shift+.` 切换）；pinned 状态 SHALL 置顶（always on top），可经 togglePin 解除，pinned 时 Esc 回到 normal。最小化后的胶囊（capsule）为 44×44px 触控目标，SHALL 可拖拽停靠；双击 SHALL 展开浮窗，单击 SHALL 延迟 200ms 后弹出 popover 预览（当前 buffer + 最近 3 条），胶囊 hover SHALL 无 tooltip。历史区条目 hover 时 SHALL 显现 [✓]/[⋯] 内联操作；[✓] 归档 SHALL 提供 4 秒（4000ms）撤销倒计时，超时自动确认。快捷键：Enter 始终换行、`Cmd+Enter` 始终提交、`Cmd+N` 提交并新建、Tab 插入 2 空格、方向键选择条目且选中项按 Enter 归档。首次启动若系统热键被占用，SHALL 提示用户在设置中修改。

#### Scenario: 全局唤起与启动时延

- **WHEN** 用户在任意其他 App 中按 `Cmd+Shift+.`
- **THEN** 录入浮窗 SHALL 唤起并触发 Dock bounce；热启动耗时 SHALL < 50ms，冷启动 SHALL < 200ms

#### Scenario: 多屏跟随

- **WHEN** 主窗口位于非主显示器时用户唤起浮窗
- **THEN** 浮窗 SHALL 显示在主窗口所在屏幕的右上区域

#### Scenario: 提交与新建交互

- **WHEN** 用户在浮窗输入框中按 `Cmd+Enter`
- **THEN** 内容 SHALL 提交为一条新条目（非空时）并按钮清空草稿；按 `Cmd+N` SHALL 先提交当前内容（若非空）再新建空白草稿；Enter SHALL 始终执行换行而非提交

#### Scenario: 归档撤销倒计时

- **WHEN** 用户点击条目的 [✓] 归档
- **THEN** 该条目 SHALL 标记为已归档并出现 4 秒（4000ms）撤销倒计时，期间点击撤销 SHALL 恢复；倒计时结束 SHALL 自动确认归档

#### Scenario: 胶囊预览与恢复

- **WHEN** 浮窗最小化为胶囊后，用户单击胶囊
- **THEN** SHALL 延迟 200ms 弹出 popover（显示当前 buffer 与最近 3 条），hover SHALL 无 tooltip；双击 SHALL 恢复展开浮窗

#### Scenario: 热键占用提示

- **WHEN** 首次启动时检测到 `Cmd+Shift+.` 已被系统或其他程序占用
- **THEN** 应用 SHALL 提示用户在设置中修改快捷键，而不是静默失效

### Requirement: D-4 prefix 粘滞输入

浮窗 SHALL 支持行首 prefix 粘滞识别：字符 `.` `。` `．` 识别为「问题」，`-` `—` `–` 识别为「待办」，`!` `！` 识别为「灵感」，`?` `？` 识别为「思考」；在当前行第 1 个字符位置命中时 SHALL 消费该前缀字符（从正文中剥离）并进入粘滞 prefix 状态，需兼容 IME 组合输入。在当前行内容为空时按 Enter SHALL 清除粘滞 prefix；提交（Cmd+Enter）成功后 SHALL 清空 prefix。

#### Scenario: 行首字符识别并消费前缀

- **WHEN** 用户在新行行首输入 `。`（或 `-` / `!` / `?` 及其变体）
- **THEN** 浮窗 SHALL 识别为对应 prefix（问题/待办/灵感/思考），并从正文中消费掉该前缀字符（IME 组合输入兼容）

#### Scenario: 空行 Enter 清除 prefix

- **WHEN** 当前前缀为粘滞状态、且光标所在行内容为空时用户按 Enter
- **THEN** 粘滞 prefix SHALL 被清除，Enter 照常执行换行

#### Scenario: 提交后清空 prefix

- **WHEN** 用户带 prefix 提交一条非空条目（Cmd+Enter）
- **THEN** 提交成功后草稿内容与 prefix SHALL 一并清空

### Requirement: D-5 inbox daily file 保存

提交的条目 SHALL 存入每日 inbox 文件 `inbox-YYYY-MM-DD.md` 及其 `archive/` 子文件夹；写入 SHALL 采用原子方式（读取现有内容 → 追加 → tempfile 写入 → rename 持久化），不阻塞 UI；加载时 SHALL 解析 frontmatter 与正文还原条目（id / prefix / content / capturedAt / archivedAt）。归档 SHALL 以 append-then-delete 方式从当日文件迁移到 `archive/`。

#### Scenario: 提交写入当日 inbox

- **WHEN** 用户提交一条带 prefix 的条目
- **THEN** 条目 SHALL 以原子写入追加到当天的 `inbox-YYYY-MM-DD.md`，UI SHALL 不被阻塞

#### Scenario: 归档迁移

- **WHEN** 用户对某条目执行归档（撤销窗口结束后）
- **THEN** 该条目 SHALL 从当日 inbox 文件删除并追加到 `archive/` 子文件夹对应文件

#### Scenario: 加载还原

- **WHEN** 浮窗加载历史（今天或指定日期）
- **THEN** 后端 SHALL 解析对应 inbox 文件的 frontmatter 与正文，还原为条目列表

### Requirement: D-6 文件面板 QC 条目接入

统一文件面板（Cmd+P）的「继续」分组 SHALL 嵌入 Quick Capture 条目（"继续"入口），每条 SHALL 支持单条归档与删除。

#### Scenario: 继续分组嵌入 QC 条目

- **WHEN** 用户打开统一文件面板的空查询上下文视图
- **THEN** 「继续」分组 SHALL 包含 Quick Capture 条目入口，且每条 SHALL 可单条归档或删除

### Requirement: D-7 QC 转正

Quick Capture 条目 SHALL 支持"转正"：将灵感条目转正为灵感文件夹中的正式文件，或转正为当前工作目录下的文档。

#### Scenario: 转正到灵感文件夹

- **WHEN** 用户对一条已归档/历史条目执行转正并选择灵感文件夹
- **THEN** 该条目内容 SHALL 生成为灵感文件夹中的正式文档

#### Scenario: 转正到当前工作目录

- **WHEN** 用户执行转正并选择当前工作目录
- **THEN** 该条目内容 SHALL 生成为当前工作目录下的文档

### Requirement: D-8 Cmd+Shift+, Inspector

应用 SHALL 提供 `Cmd+Shift+,` 打开的 Quick Capture Inspector：以 flat list 呈现全部条目，支持搜索、归档与转正。

#### Scenario: Inspector 列表与操作

- **WHEN** 用户按 `Cmd+Shift+,`
- **THEN** Inspector SHALL 以 flat list 列出条目，并提供搜索、归档、转正操作

### Requirement: D-9 QC filter 与 batch

Inspector SHALL 支持 filter tabs 过滤、批量归档（batch archive）与批量转正（batch 转正）。

#### Scenario: 过滤与批量操作

- **WHEN** 用户在 Inspector 中选择某个 filter tab 并全选结果
- **THEN** 列表 SHALL 按过滤条件收窄，且 SHALL 可对选中集合执行批量归档或批量转正

### Requirement: D-10 窗口宽高可调

浮窗 SHALL 支持拖拽四边与四角调整大小：宽度范围 320–600px、高度范围 280–800px；宽高 SHALL 持久化（存入配置 `[capture]` 段的 `overlay_width` / `overlay_height`），下次打开时恢复。

#### Scenario: 拖拽调整并持久化

- **WHEN** 用户拖拽浮窗右下角把手放大到宽 500、高 700 并关闭，随后重新打开
- **THEN** 浮窗 SHALL 允许在 320–600 / 280–800 范围内调整，且重新打开时 SHALL 恢复为持久化的宽高

#### Scenario: 越界钳制

- **WHEN** 用户尝试把宽度拖到超出 320–600 区间
- **THEN** 实际宽度 SHALL 被钳制在 320–600 以内

### Requirement: D-11 面板拖拽分隔条

浮窗内 textarea 面板与 history 面板之间 SHALL 提供 4px 拖拽分隔条（cursor: row-resize），调整两区高度比例 `panelRatio`，范围 0.2–0.8；比例 SHALL 持久化（配置 `[capture]` 段 `panel_ratio`），下次打开时恢复。

#### Scenario: 拖动分隔条调整比例

- **WHEN** 用户拖动 textarea 与 history 之间的分隔条把输入区调高
- **THEN** `panelRatio` SHALL 在 0.2–0.8 范围内变化并立即持久化；重新打开浮窗时 SHALL 恢复该比例

### Requirement: D-12 X 按钮保存关闭

浮窗顶栏 X 按钮 SHALL 具备上下文语义：有草稿内容时 SHALL 先保存（提交当前内容）再关闭；无内容时 SHALL 直接关闭。

#### Scenario: 有内容先保存再关闭

- **WHEN** 草稿区有非空内容时用户点击 X
- **THEN** 应用 SHALL 先提交保存该内容，然后关闭浮窗

#### Scenario: 无内容直接关闭

- **WHEN** 草稿区为空时用户点击 X
- **THEN** 浮窗 SHALL 直接关闭，不产生空条目

### Requirement: D-13 Escape 关闭语义

浮窗内 Esc SHALL 按就近原则依序处理：处于编辑模式时取消编辑；否则有草稿内容时清空内容；否则有粘滞 prefix 时清空 prefix；否则存在归档撤销时执行撤销；否则处于 pinned 时解除置顶；以上皆不满足时 SHALL 直接关闭浮窗（不再 minimize 到胶囊）。

#### Scenario: 无内容直接关闭

- **WHEN** 浮窗处于 normal 状态、草稿为空、无 prefix、无撤销、未 pin 时用户按 Esc
- **THEN** 浮窗 SHALL 直接关闭（不最小化为胶囊）

#### Scenario: 有内容先清空

- **WHEN** 草稿区有内容时用户按 Esc
- **THEN** Esc SHALL 先清空草稿内容而非关闭浮窗；再次按 Esc SHALL 关闭

### Requirement: D-14 Capsule tooltip 移除

胶囊（capsule）hover 时 SHALL 无任何视觉反馈（原 hover tooltip 已在 v5.4 移除）；胶囊仅保留单击 popover 预览与双击恢复两种交互（见 D-3）。

#### Scenario: hover 无反馈

- **WHEN** 用户把鼠标悬停在胶囊上
- **THEN** SHALL 不出现 tooltip 或任何 hover 视觉反馈

### Requirement: D-15 一次批量混合 prefix 录入

浮窗草稿区 SHALL 支持一次批量录入多行混合 prefix 的 inbox 条目：按行切块（前缀行开启新条目、无前缀续行并入当前条目并以 `\n` 连接、空行作为硬分隔并清除粘性 prefix），一次提交 SHALL 将切分结果批量写入当日 inbox。批内每条 `capturedAt` SHALL 严格互异（第 i 条取 `Date.now() + i`），保证 `load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配不塌缩到同一实块。批量写入 SHALL 采用失败降级链：`append_inbox_batch` → 逐条 `append_inbox` → localStorage `biaoyue_capture_fallback`。空的切分结果（全空 / 全空行）SHALL 不触发任何写入。

#### Scenario: 多行混合 prefix 一次批量提交

- **WHEN** 用户在草稿区输入多行混合 prefix 内容（如 `. 问题一`、`- 待办一`、续行、`! 灵感`）并按 `Cmd+Enter` 提交
- **THEN** 草稿 SHALL 按行切分为多条条目，每条 `prefix` 与 `content` 正确，且全部条目 SHALL 一次批量写入当日 inbox

#### Scenario: 无前缀续行归并

- **WHEN** 某前缀行之后紧跟无前缀的非空续行
- **THEN** 续行 SHALL 并入当前条目，`content` 以 `\n` 连接，而非另起一条

#### Scenario: 空行硬分隔并清空 prefix

- **WHEN** 两条前缀条目之间出现空行
- **THEN** 空行 SHALL 结束当前条目并清除粘性 prefix，后续行 SHALL 开启新条目

#### Scenario: 批内 capturedAt 唯一性

- **WHEN** 一次批量提交包含多条条目
- **THEN** 批内每条 `capturedAt` SHALL 严格互不相同，`load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配 SHALL 定位到各自独立实块

#### Scenario: 批量写入失败降级

- **WHEN** `append_inbox_batch` 写入失败
- **THEN** 应用 SHALL 依次降级为逐条 `append_inbox`，仍失败则写入 localStorage `biaoyue_capture_fallback`，保证数据不丢失

#### Scenario: 空切分结果不写入

- **WHEN** 草稿内容全为空或全为空行时用户提交
- **THEN** 应用 SHALL 不触发任何写入，不产生任何条目


# navigation — 导航体系当前规格

## Purpose

navigation 域定义标月桌面端"无侧栏"方向下的导航体系：启动面板/欢迎页、统一文件面板（Cmd+P 上下文浏览器）及其三视图切换、条目直开与历史前进后退。导航职责由 Cmd+P 承担，不再依赖左右侧栏（界面层面的无边栏决策见 application-shell 域）。本规格是 navigation 域可验收功能行为的唯一真相源；条目编号（B-1、B-3、B-6、B-7、B-8）与 `docs/MVP-需求跟踪表.md` 模块 B / B+ 一一对应。

## 设计来源与参考

- B-1 批准设计：`docs/design/approved/empty-state/spec.md`（启动面板/欢迎页部分）
- B-3 / B-6 / B-7 / B-8 批准设计：`docs/design/approved/navigation/spec.md`（经由跟踪表 B-3/B+ 行登记）
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口表）、4.2（统一文件面板规则）、§三 快捷键体系（Cmd+P、Ctrl+1~9、Cmd+[/Cmd+]）；`docs/MVP-需求跟踪表.md` 模块 B 与 B+（均标 ✅）
- 空状态的"继续上次/最近保存"分块（B-2）、示例文件释放（B-4）与空状态设计规则（B-5）归属 application-shell 域

## Requirements

### Requirement: B-1 启动面板（欢迎页）

用户没有打开文档时，启动面板/EmptyState 中央 SHALL 渲染 `0-welcome.md` 作为产品展示；`0-welcome.md` 即 README，SHALL 向用户呈现格式清单、快捷键说明、安全感说明与结尾 CTA。首次启动 SHALL 仅展示欢迎页；存在历史记录后，继续区与最近保存区由空状态分块机制按数据叠加（分块规则见 application-shell 域 B-2）。

#### Scenario: 首次启动渲染欢迎页

- **WHEN** 用户首次启动标月且无任何打开文档
- **THEN** 启动面板中央 SHALL 渲染 `0-welcome.md`，内容包含格式清单、快捷键、安全感说明与 CTA

### Requirement: B-3 统一文件面板（Cmd+P 上下文浏览器）

应用 SHALL 提供 `Cmd+P` 统一文件面板作为唯一的文件导航入口。面板 SHALL 依据打开时的上下文呈现不同视图（空查询 = 当前上下文视图，输入搜索词 = 全局搜索视图，带选中文本 = 局部相关视图，触发规则见 B-6）。空查询时的默认上下文视图 SHALL 分为三组：「继续」（当前任务现场文档：引用/分屏/跳转过的，≤5 条）、「待处理」（状态风险文档：未保存/读到一半/失效的，≤5 条）、「全部」（工作目录所有文件按 mtime 倒序，行为见 file-management 域 C-5）。条目交互 SHALL 支持：Enter 打开、Space Peek、Cmd+Enter 旁开、Tab 固定、hover 显示路径详情。R 阶段搜索范围 SHALL 为文件名 + frontmatter title + H1 + 父目录，不搜索正文全文。

#### Scenario: 空查询呈现默认上下文分组

- **WHEN** 用户按 `Cmd+P` 且无查询词、无选中文本
- **THEN** 面板 SHALL 显示「继续」（≤5 条）、「待处理」（≤5 条）、「全部」三组默认上下文视图

#### Scenario: 条目交互

- **WHEN** 面板内某条目获得焦点
- **THEN** Enter SHALL 打开该条目；Space SHALL 预览（Peek）；Cmd+Enter SHALL 在旁栏打开；Tab SHALL 固定该条目；hover SHALL 显示其路径详情

#### Scenario: 搜索范围限定

- **WHEN** 用户在面板中输入搜索词
- **THEN** 匹配范围 SHALL 限于文件名、frontmatter title、H1 与父目录，不搜索文档正文全文

### Requirement: B-6 三视图切换

统一文件面板 SHALL 按查询状态动态切换三种视图：无查询词且无选中文本时显示当前上下文视图；输入搜索词时切换为全局搜索视图；打开面板时带有选中文本时显示局部相关视图。

#### Scenario: 输入搜索词切换全局搜索

- **WHEN** 面板已打开（当前上下文视图），用户输入搜索词
- **THEN** 面板 SHALL 从当前上下文视图切换为全局搜索视图

#### Scenario: 带选中文本进入局部相关

- **WHEN** 用户在正文中选中一段文本后按 `Cmd+P`
- **THEN** 面板 SHALL 以该选中文本为线索显示局部相关视图

### Requirement: B-7 Ctrl+1~9 直开条目

面板打开时，数字键 `Ctrl+1` 至 `Ctrl+9`（桌面端同时保留 `Cmd+1~9` 同义映射）SHALL 直接打开面板中对应序号的条目，无需按 Enter 确认。

#### Scenario: 数字键直开

- **WHEN** 面板已打开且结果不少于 3 条，用户按 `Ctrl+3`
- **THEN** 面板 SHALL 直接打开第 3 条条目，无需 Enter 确认

### Requirement: B-8 后退/前进历史导航

应用 SHALL 提供 `Cmd+[` 与 `Cmd+]` 作为标准历史栈导航：`Cmd+[` 后退到上一个导航位置，`Cmd+]` 前进，行为遵循标准历史栈语义。

#### Scenario: 后退与前进

- **WHEN** 用户在文档间完成多次导航后按 `Cmd+[`
- **THEN** 视图 SHALL 回退到上一个导航位置；随后按 `Cmd+]` SHALL 前进到下一个导航位置

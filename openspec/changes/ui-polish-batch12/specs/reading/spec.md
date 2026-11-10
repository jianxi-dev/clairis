## MODIFIED Requirements

### Requirement: A-5 沉浸阅读模式

应用 SHALL 提供二元沉浸阅读：`Cmd+\` 切换进入/退出，进入与退出各 SHALL 有 0.3 秒过渡动画（chrome 淡出/淡入，主文档区不动），`Esc` SHALL 直接退出。沉浸态 SHALL 不做状态快照——工具栏可见性是独立用户偏好，不随进出翻转；沉浸态不创建独立字号（字号即全局字号，见 A-6）。沉浸只隐藏界面 chrome，SHALL 不触发任何文件操作（不弹未保存确认、不自动保存）。

沉浸态下，每格页签条 SHALL 以**浮层**形式出现：`.app-chrome` SHALL 脱离流式布局（`position: absolute`），指针进入该格顶部热区后 SHALL 以背景、阴影与圆角浮出，SHALL NOT 改变正文区高度、SHALL NOT 推挤正文。

沉浸态下的 PDF 预览，其顶部按钮栏 SHALL 在 1.2 秒无指针交互后自动收起（计算 `opacity` 为 0、`transform` 上移），指针进入预览顶部 24px 区域或容器内移动 SHALL 使其复现；收起与复现 SHALL NOT 改变正文区高度（用 `transform`/`opacity`，SHALL NOT 用 `display: none`）。

#### Scenario: 进入沉浸

- **WHEN** 用户在工具栏可见状态下按 `Cmd+\`
- **THEN** 工具栏/侧栏/Tab 栏 SHALL 在 0.3 秒内淡出并进入沉浸态

#### Scenario: Esc 退出沉浸

- **WHEN** 用户在沉浸态按 `Esc`
- **THEN** 应用 SHALL 在 0.3 秒内淡入退出沉浸，不做"轻退出/完全退出"区分

#### Scenario: 工具栏可见性不翻转

- **WHEN** 用户（工具栏偏好为显示）进入沉浸再退出
- **THEN** 工具栏 SHALL 回到用户设置的可见性状态，进出前后一致

#### Scenario: 编辑态进入不触发文件操作

- **WHEN** 用户在编辑态且文档有未保存修改时按 `Cmd+\`
- **THEN** 应用 SHALL 直接进入沉浸，不弹出未保存确认，不执行保存；退出后光标位置按现有 `cursorPos` 字段恢复

#### Scenario: 沉浸态浮出 chrome

- **WHEN** 用户在沉浸态将鼠标悬停在屏幕上边缘 2px 区域超过 400ms
- **THEN** 工具栏 SHALL 淡入显示；鼠标移出上边缘 2 秒后 SHALL 淡出
- **AND** `Shift+Cmd+T` SHALL 以 toggle 方式切换所有 chrome 的显示/隐藏

#### Scenario: 全屏下 Esc 只退沉浸

- **WHEN** 用户在 macOS 原生全屏 + 沉浸态下按 `Esc`
- **THEN** 应用 SHALL 只退出沉浸，保留全屏；退出全屏需再次使用系统全屏控制或 `Ctrl+Cmd+F`

#### Scenario: 分屏下沉浸

- **WHEN** 用户在双栏分屏下进入沉浸
- **THEN** 分割线 SHALL 隐藏，两个文档并排显示且字号相同（共享全局字号）

#### Scenario: 沉浸态页签条为浮层

- **WHEN** 用户在沉浸态把指针移入某一格的顶部 16px 热区
- **THEN** 该格页签条 SHALL 可见，其计算 `position` SHALL 为 `absolute` 或 `fixed`
- **AND** 该格正文区高度 SHALL 与热区未触发时相同（浮层不占流式高度）

#### Scenario: 沉浸态 PDF 顶栏自动收起

- **WHEN** 用户在沉浸态打开 PDF 并把指针移出预览区 1.5 秒
- **THEN** PDF 顶部按钮栏的计算 `opacity` SHALL 为 0
- **AND** 正文区高度 SHALL 与收起前一致

#### Scenario: 沉浸态 PDF 顶栏复现

- **WHEN** 指针移入沉浸态 PDF 预览顶部 24px 区域
- **THEN** PDF 顶部按钮栏 SHALL 恢复可见（计算 `opacity` 为 1）

### Requirement: A-14 HTML 摘要文本化

阅读空间与门户中的 HTML 文件摘要 SHALL 显示去标签后的正文文字，SHALL NOT 显示 HTML 源码；缩略图 SHALL 显示中性占位图，不伪造 HTML 页面缩略图。HTML 卡片缩略图 SHALL 为**确定性**渲染结果：同一文件在任何滚动位置、任何挂载顺序下 SHALL 显示同一可见缩略图，SHALL NOT 依赖并发配额、加载成功或重试，SHALL NOT 渲染 `<iframe>`。

#### Scenario: HTML 摘要去标签

- **WHEN** 某 HTML 文件进入最近列表
- **THEN** 其摘要 SHALL 不包含 `<tag>` 形式的源码文本

#### Scenario: HTML 缩略图恒可见

- **WHEN** 最近列表含 6 个及以上 HTML 文件，用户逐个滚动到每张卡片
- **THEN** 每张卡片的缩略图区域 SHALL 显示可见的中性占位（类型色底 + 文档字形），SHALL NOT 为空白
- **AND** 卡片内 SHALL NOT 出现 `iframe` 节点

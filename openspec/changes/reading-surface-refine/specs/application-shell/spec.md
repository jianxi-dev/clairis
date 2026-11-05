## ADDED Requirements

### Requirement: G-6 顶栏职责与页签身份

应用外壳 SHALL 以顶栏承载产品级入口（网格概览、AI、主题、沉浸），SHALL NOT 在顶栏显示当前文件名或预览/编辑/源码切换；文件身份 SHALL 仅由每个分栏的页签条表达，且页签 SHALL 始终同时显示类型图标与文件名。活跃页签 SHALL 以胶囊高亮表达，而非下划线。浅色/深色/暖色切换 SHALL 通过根节点 class 驱动全站语义 token 与 `dark:` 组件样式，整窗一致变化。

#### Scenario: 顶栏不再重复文件身份
- **WHEN** 用户打开任意文档并进入工作区
- **THEN** 顶栏 SHALL 只显示标月品牌、网格、AI、主题与沉浸入口，SHALL NOT 显示文件名或预览/编辑/源码按钮

#### Scenario: 页签始终带名称
- **WHEN** 分栏内存在一个或多个页签
- **THEN** 每个页签 SHALL 同时渲染类型图标与文件名，活跃页签 SHALL 为胶囊高亮

#### Scenario: 主题切换覆盖整窗
- **WHEN** 用户从浅色切换到深色
- **THEN** 根节点 SHALL 切换 `dark` class，顶栏、面板、卡片、弹层与正文背景 SHALL 同时使用深色语义 token

### Requirement: G-7 图标语义与全屏可用性

全站图标 SHALL 使用同一 24×24 线性语言，分栏图标 SHALL 用左右/上下矩形面积差表达方向，钉住与全屏 SHALL 用轻量轮廓而非重填充。单格工作区 SHALL NOT 显示无效的全屏按钮；多格工作区全屏按钮 SHALL 聚焦当前格并切换全屏态。

#### Scenario: 单格隐藏全屏
- **WHEN** 工作区只有一个 pane
- **THEN** 该 pane 头部 SHALL NOT 渲染全屏按钮

#### Scenario: 多格全屏生效
- **WHEN** 工作区有至少两个 pane，用户点击当前 pane 的全屏按钮
- **THEN** 当前 pane SHALL 进入全屏态，再次点击 SHALL 退出

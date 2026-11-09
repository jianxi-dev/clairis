## MODIFIED Requirements

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

### Requirement: G-7 图标语义与全屏可用性

栏目「更多操作」菜单 SHALL 含「刷新」项，点击后 SHALL 从磁盘重新读取当前页签文件并更新内容；未保存修改 SHALL 以磁盘内容覆盖。视频/媒体页签显示时，左侧阅读空间的展开按钮 SHALL 保持可见且可点击，层级 SHALL 高于媒体宿主。

#### Scenario: 刷新当前文件

- **WHEN** 用户修改磁盘上的当前文件后在栏目菜单点「刷新」
- **THEN** 页签内容 SHALL 变为磁盘最新内容

#### Scenario: 视频打开时左栏仍可展开

- **WHEN** 最左侧栏目正在显示视频且阅读空间处于收起态
- **THEN** `rail-edge` 按钮 SHALL 可见，点击后阅读空间 SHALL 展开

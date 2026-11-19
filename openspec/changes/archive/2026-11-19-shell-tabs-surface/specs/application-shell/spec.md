# application-shell Specification (delta)

## MODIFIED Requirements

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

**页签标题显示与间距**：页签 SHALL 弹性布局——页签之间按页签条可用宽度等比伸缩（flex 分配），并设最小宽度保底；标题在伸缩后的可用宽度内 SHALL 以 `text-overflow: ellipsis` 收尾、单行 `white-space: nowrap`，SHALL NOT 换行，SHALL NOT 使用 `-webkit-line-clamp`。完整文件名 SHALL 在页签名信息窗内换行可读（见 navigation 域「页签条与格头」）。仅当页签条可用宽度不足以容纳全部页签的最小宽度保底时，页签条 SHALL 横向滚动，SHALL NOT 压缩页签到不可读或溢出容器。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）；单个页签内标题右缘到关闭按钮左缘的水平间距 SHALL 不超过 **6px**。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

#### Scenario: 页签标题单行完整显示

> 场景标题沿用旧名以保持条款可追溯；自本 change 起页签改为弹性等比伸缩，不再有固定 120px 上限；标题在伸缩后的可用宽度内以省略号收尾。

- **WHEN** 页签标题文本宽度超过其所在页签分配到的宽度
- **THEN** 该页签标题容器的 `text-overflow` SHALL 为 `ellipsis`，`white-space` SHALL 为 `nowrap`，`-webkit-line-clamp` SHALL 为 `none`，且标题 SHALL NOT 换行

#### Scenario: 短标题按实际长度显示

> 场景标题沿用旧名以保持条款可追溯；自本 change 起页签弹性伸缩，短标题所在页签按分配宽度显示（可长于文本实际宽度），不再固定按文本实际长度。

- **WHEN** 页签标题的自然宽度小于其分配到的页签宽度
- **THEN** 该页签的渲染宽度 SHALL 等于其分配宽度（可大于文本实际宽度），标题在分配宽度内以省略号收尾，SHALL NOT 被固定上限截断

#### Scenario: 页签条横向滚动

> 场景标题沿用旧名；自本 change 起仅当可用宽度不足以容纳全部页签的最小宽度保底时才横向滚动。

- **WHEN** 页签条可用宽度不足以容纳全部页签的最小宽度保底
- **THEN** 页签条 SHALL 可横向滚动，页签宽度 SHALL 保持其最小宽度保底，SHALL NOT 压缩到不可读或溢出容器

#### Scenario: 页签间距 32px

> 场景标题沿用旧名以保持条款可追溯；相邻页签间距保持 32px 不变，本 change 压缩的是单个页签内标题与关闭按钮之间的间距。

- **WHEN** 测量相邻两个页签的间距
- **THEN** 其间距 SHALL 为 32px（容差 ±2px）

#### Scenario: 窗格变窄时页签等比收缩

- **WHEN** 用户在多页签栏目内收窄窗格（或窗口）使页签条可用宽度变小
- **THEN** 各页签宽度 SHALL 按可用宽度同比缩小（收缩比例一致），相邻页签间距 SHALL 保持 32px，页签之间 SHALL NOT 互相覆盖，页签条 SHALL NOT 溢出容器

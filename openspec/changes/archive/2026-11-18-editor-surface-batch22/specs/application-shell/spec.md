## MODIFIED Requirements

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

**页签标题显示与间距**：页签标题 SHALL 单行完整显示——SHALL NOT 使用 `text-overflow: ellipsis`、SHALL NOT 截断、SHALL NOT 使用 `-webkit-line-clamp`（含 `line-clamp` 系列，其达上限仍会渲染视觉省略号）、SHALL NOT 换行（`white-space: nowrap`）。页签总宽超过页签条可用宽度时，页签条 SHALL 横向滚动，SHALL NOT 压缩页签到不可读或溢出容器。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

#### Scenario: 页签标题单行完整显示

- **WHEN** 某页签标题长度超过其可用宽度
- **THEN** 该页签标题的计算 `text-overflow` SHALL NOT 为 `ellipsis`，`-webkit-line-clamp` SHALL 为 `none`，`white-space` SHALL 为 `nowrap`，标题 SHALL 完整显示且 SHALL NOT 换行

#### Scenario: 页签条横向滚动

- **WHEN** 页签总宽超过页签条可用宽度
- **THEN** 页签条 SHALL 可横向滚动，SHALL NOT 压缩到不可读或溢出容器

#### Scenario: 页签间距 32px

- **WHEN** 测量相邻两个页签的间距
- **THEN** 其间距 SHALL 为 32px（容差 ±2px）

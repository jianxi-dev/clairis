## MODIFIED Requirements

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

**页签标题显示与间距**：单个页签标题 SHALL 有固定最大显示宽度 **120px**（容差 ±2px）——短于该宽度时 SHALL 按实际文本长度显示，超过时 SHALL 以 `text-overflow: ellipsis` 收尾、单行 `white-space: nowrap`，SHALL NOT 换行，SHALL NOT 使用 `-webkit-line-clamp`。完整文件名 SHALL 在页签名信息窗内换行可读（见 navigation 域「页签条与格头」）。页签总宽超过页签条可用宽度时，页签条 SHALL 横向滚动，SHALL NOT 压缩页签到不可读或溢出容器。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

#### Scenario: 超长标题以省略号收尾

- **WHEN** 某页签标题的自然宽度超过 120px
- **THEN** 该页签标题容器的计算 `max-width` SHALL 为 120px（容差 ±2px），`text-overflow` SHALL 为 `ellipsis`，`white-space` SHALL 为 `nowrap`，`-webkit-line-clamp` SHALL 为 `none`，且标题 SHALL NOT 换行

#### Scenario: 短标题按实际长度显示

- **WHEN** 某页签标题的自然宽度小于 120px
- **THEN** 该页签标题容器的渲染宽度 SHALL 等于文本实际宽度，SHALL NOT 被拉伸到 120px

#### Scenario: 页签条横向滚动

- **WHEN** 页签总宽超过页签条可用宽度
- **THEN** 页签条 SHALL 可横向滚动，SHALL NOT 压缩到不可读或溢出容器

#### Scenario: 页签间距 32px

- **WHEN** 测量相邻两个页签的间距
- **THEN** 其间距 SHALL 为 32px（容差 ±2px）

### Requirement: 页签空白双击切换窗口全屏

双击页签栏空白区域 SHALL 切换应用窗口的全屏状态（窗口 `setFullscreen`）：首次双击进入全屏，再次双击还原；SHALL NOT 新建文档。双击判定窗口内的第二记按下 SHALL NOT 启动窗口拖动，窗口拖动 SHALL NOT 吞掉双击。

#### Scenario: 双击进入全屏

- **WHEN** 用户双击页签栏空白区域
- **THEN** 窗口 `isFullscreen()` SHALL 为 `true`，且页签数量 SHALL 保持不变

#### Scenario: 再次双击还原

- **WHEN** 窗口已处于全屏状态时用户再次双击页签栏空白区域
- **THEN** 窗口 `isFullscreen()` SHALL 变为 `false`

#### Scenario: 双击不被窗口拖动夺走

- **WHEN** 用户在页签条空白处双击，两记按下之间的位移不超过 4px
- **THEN** 窗口全屏状态 SHALL 完成一次切换，且 SHALL NOT 发生窗口拖动

#### Scenario: 超过阈值不触发全屏

- **WHEN** 用户在页签条空白处按下后位移超过 4px 再松开
- **THEN** 窗口位置 SHALL 改变（窗口拖动），且窗口全屏状态 SHALL NOT 变化

## REMOVED Requirements

### Requirement: 页签栏空白双击新建文档

**Reason**: 与「页签空白双击切换窗口全屏」互斥——同一手势不能既新建文档又切全屏。#923 已把实现改为切窗口全屏并明确 SHALL NOT 新建文档，该条 requirement 在代码侧早已失效，仅在规格内残留。

**Migration**: 双击页签栏空白现在切窗口全屏；新建文档走 `Cmd+N`（见 file-management 域）与页签栏「更多」菜单首项「新建文件」。

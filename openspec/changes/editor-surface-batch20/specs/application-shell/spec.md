## MODIFIED Requirements

### Requirement: 页签空白双击切换窗口全屏

双击页签栏空白区域 SHALL 进入应用窗口的**全屏**（脱离文档页面、覆盖整个屏幕，而非最大化）；再次双击 SHALL 还原。SHALL NOT 新建文档。实现 SHALL 调用窗口全屏能力（`setFullscreen`）而非最大化能力，并 SHALL 在权限清单中具备对应权限。

#### Scenario: 双击进入全屏

- **WHEN** 用户双击页签栏空白区域
- **THEN** 窗口 SHALL 进入全屏（`isFullscreen()` 为 `true`），且页签数量 SHALL 保持不变

#### Scenario: 再次双击还原

- **WHEN** 窗口已处于全屏状态时用户再次双击页签栏空白区域
- **THEN** 窗口 SHALL 退出全屏（`isFullscreen()` 变为 `false`）

## REMOVED Requirements

### Requirement: 页签栏空白双击新建文档

**Reason**: 与「页签空白双击切换窗口全屏」直接冲突——后者明确 SHALL NOT 新建文档。用户 2026-11-15 反馈确认为「期望全屏、当前无反应」，故新建文档语义不成立。

**Migration**: 双击页签空白的语义统一为「切换窗口全屏」（见 MODIFIED「页签空白双击切换窗口全屏」）。如需新建文档，保留顶栏 / 空状态入口与既有快捷键。

## ADDED Requirements

### Requirement: 页签空白拖动移动窗口

按住页签栏空白区域并移动超过阈值 SHALL 移动应用窗口（调用窗口拖动能力）；按压处 SHALL 显示拖动鼠标指针。拖动期间 SHALL 只呈现一个拖动反馈浮层，SHALL NOT 触发栏目（pane）拖动换位，SHALL NOT 使当前格与其它格互换。未超过阈值 SHALL 视为点击，SHALL NOT 移动窗口。

#### Scenario: 空白处显示拖动指针

- **WHEN** 用户把指针移到页签栏空白区域
- **THEN** 该区域计算 `cursor` SHALL 为抓取/移动语义

#### Scenario: 拖动移动窗口且不换格

- **WHEN** 用户在页签栏空白按下滑动超过阈值
- **THEN** 窗口拖动 SHALL 被触发 1 次，栏目拖动浮层节点数 SHALL 为 0，页签/栏目顺序 SHALL 保持不变

#### Scenario: 未超阈值视为点击

- **WHEN** 用户在页签栏空白按下并移动小于阈值后释放
- **THEN** 窗口 SHALL NOT 移动，SHALL NOT 触发栏目拖动

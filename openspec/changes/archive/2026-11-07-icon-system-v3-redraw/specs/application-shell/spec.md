## MODIFIED Requirements

### Requirement: G-7 图标语义与全屏可用性

全站图标 SHALL 使用同一 24×24 线性语言，分栏图标 SHALL 用左右/上下矩形面积差表达方向，钉住与全屏 SHALL 用轻量轮廓而非重填充。单格工作区 SHALL NOT 显示无效的全屏按钮；多格工作区全屏按钮 SHALL 聚焦当前格并切换全屏态。全屏中的格头全屏按钮 SHALL 渲染退出形态（`collapse`），`aria-pressed` SHALL 为真，`title`/`aria-label` SHALL 为「退出全屏」；退出后 SHALL 恢复进入形态（`expand`）。

#### Scenario: 单格隐藏全屏
- **WHEN** 工作区只有一个 pane
- **THEN** 该 pane 头部 SHALL NOT 渲染全屏按钮

#### Scenario: 多格全屏生效
- **WHEN** 工作区有至少两个 pane，用户点击当前 pane 的全屏按钮
- **THEN** 当前 pane SHALL 进入全屏态，再次点击 SHALL 退出

#### Scenario: 全屏中显示退出图标
- **WHEN** 某 pane 处于全屏态
- **THEN** 该 pane 头部按钮的 `data-icon` SHALL 为 `collapse`
- **AND** `aria-pressed` SHALL 为 `true`
- **AND** `title`/`aria-label` SHALL 为「退出全屏」

#### Scenario: 退出后恢复进入图标
- **WHEN** 用户在全屏态再次点击同一按钮
- **THEN** 该按钮 `data-icon` SHALL 恢复为 `expand`
- **AND** `aria-pressed` SHALL 为 `false`

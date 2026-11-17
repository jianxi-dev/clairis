## ADDED Requirements

### Requirement: 主窗口最小尺寸

应用主窗口的最小宽度 SHALL 为 **300px**，最小高度 SHALL 保持不变（400px）。窗口被拖到最小尺寸后继续收缩 SHALL NOT 生效。在 300px 最小宽度下，属性面板、页签条与分栏 SHALL NOT 出现横向溢出；窄宽允许分栏堆叠为单列。

#### Scenario: 最小宽度可收缩到 300

- **WHEN** 用户把主窗口宽度向左拖到 300px
- **THEN** 窗口宽度 SHALL 停在 300px，SHALL NOT 继续变小

#### Scenario: 窄宽无横向溢出

- **WHEN** 窗口处于 300×600
- **THEN** 页面横向溢出宽度 SHALL 为 0，页签条 SHALL 可横向滚动

#### Scenario: 最小高度不变

- **WHEN** 用户拖动窗口底边
- **THEN** 窗口高度 SHALL 不小于 400px

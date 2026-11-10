## ADDED Requirements

### Requirement: G-12 页面宽度四档与悬停弹窗

状态栏页面宽度控件 SHALL 提供 4 个档位：720 / 960 / 1080 / 1200（px）。控制器 SHALL 以 4 个色块表达档位，色块高度 SHALL 按档位递增（14 / 17 / 20 / 23 px），当前档位与其它档位 SHALL 有明显对比：选中色块填充不透明度 SHALL 为 1，未选中色块填充不透明度 SHALL ≤ 0.45。

指针进入宽度控件（按钮与弹窗的并集）SHALL 同时显示按钮与弹窗；指针离开该并集 200ms 后 SHALL 同时隐藏按钮与弹窗。按钮与弹窗之间的间隙 SHALL 由容器内边距桥接。`Esc` 与外部 `pointerdown` SHALL 关闭弹窗。设置页的宽度预设 SHALL 与状态栏一致（同为 4 档），默认值 SHALL 为 1080。

#### Scenario: 悬停同时显示按钮与弹窗

- **WHEN** 用户把指针移入状态栏页面宽度控件区域
- **THEN** 宽度按钮与档位弹窗 SHALL 同时可见
- **AND** 移出该区域 300ms 后两者 SHALL 都不可见

#### Scenario: 四档与高度递增

- **WHEN** 用户打开宽度弹窗
- **THEN** SHALL 恰有 4 个色块，其高度依次为 14 / 17 / 20 / 23 px

#### Scenario: 选中与未选中对比明显

- **WHEN** 当前档位为 1080
- **THEN** 该档色块填充的计算 `opacity` SHALL 为 1
- **AND** 其它三个色块填充的计算 `opacity` SHALL ≤ 0.45

#### Scenario: 悬停打开后可点击设档

- **WHEN** 用户悬停宽度控件使弹窗出现，并点击 1200 档色块
- **THEN** 正文最大宽度 SHALL 变为 1200px，且该档色块变为选中态

## ADDED Requirements

### Requirement: 页签空白双击切换窗口全屏

双击页签栏空白区域 SHALL 切换应用窗口的全屏/最大化状态：首次双击进入全屏，再次双击还原；SHALL NOT 新建文档。

#### Scenario: 双击进入全屏

- **WHEN** 用户双击页签栏空白区域
- **THEN** 窗口 `isMaximized()` SHALL 为 `true`，且页签数量 SHALL 保持不变

#### Scenario: 再次双击还原

- **WHEN** 窗口已处于全屏状态时用户再次双击页签栏空白区域
- **THEN** 窗口 `isMaximized()` SHALL 变为 `false`

### Requirement: 更多菜单新建文件入口

页签栏「更多」菜单 SHALL 以「新建文件」为第一项。

#### Scenario: 第一项为新建文件

- **WHEN** 用户打开页签栏「更多」菜单
- **THEN** 第一项文本 SHALL 严格等于「新建文件」，点击后 SHALL 新建一个文档页签

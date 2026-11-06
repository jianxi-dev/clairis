## ADDED Requirements

### Requirement: E-17 块手柄召唤区域与滑入菜单

MD 编辑态的块手柄 SHALL 仅在指针位于正文左侧四分之一区域或手柄自身时召唤；指针位于其余区域 SHALL NOT 显示手柄。指针滑入手柄后 SHALL 自动显示块菜单，无需点击。

#### Scenario: 左侧四分之一召唤
- **WHEN** 指针进入正文左侧四分之一区域
- **THEN** 对应块手柄 SHALL 淡入

#### Scenario: 右侧不召唤
- **WHEN** 指针仅在正文右侧区域移动
- **THEN** 块手柄 SHALL 保持隐藏

#### Scenario: 滑入即菜单
- **WHEN** 指针从正文滑入已显示的手柄
- **THEN** 块菜单 SHALL 自动打开

### Requirement: E-18 正文选区胶囊

MD 编辑态与阅读态的正文选区 SHALL 显示胶囊工具条；编辑态 SHALL 提供改写/翻译/润色，阅读态 SHALL 提供复制/解释/翻译。胶囊形状 SHALL 与文件类型 chip、活跃页签高亮一致。

#### Scenario: 阅读态选区
- **WHEN** 用户在阅读态选中一段正文
- **THEN** 选区上方 SHALL 显示胶囊工具条

#### Scenario: 编辑态选区
- **WHEN** 用户在编辑态选中一段正文
- **THEN** 选区上方 SHALL 显示改写/翻译/润色胶囊

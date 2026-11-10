# file-management（delta）— ui-polish-batch13

## ADDED Requirements

### Requirement: 栏目菜单定位文案

系统 SHALL 将栏目「更多」菜单中的「打开所在文件夹」更名为「打开文件位置」，其余菜单项与顺序不变。

#### Scenario: 菜单项文本

- **WHEN** 用户打开栏目「更多」菜单
- **THEN** 菜单第四项文本为「打开文件位置」，且仍触发在文件管理器中定位（A-6.1）

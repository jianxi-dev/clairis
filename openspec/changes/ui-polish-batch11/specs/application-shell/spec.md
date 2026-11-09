## ADDED Requirements

### Requirement: 栏目菜单三件套（第十一批）

栏目「更多」菜单 SHALL 提供可用的「刷新」，点击后 SHALL 重新读取当前文件并更新当前页签的编辑内容与预览，SHALL NOT 新建页签。菜单 SHALL 提供「打开所在文件夹」，调用系统文件管理器定位当前文件。指向「导出」时子菜单 SHALL 在指针移入子菜单期间保持可见。

#### Scenario: 刷新读取磁盘

- **WHEN** 文件在外部被修改后用户点击「更多 → 刷新」
- **THEN** 当前页签正文 SHALL 显示磁盘上的新内容，页签数量 SHALL 不变

#### Scenario: 打开所在文件夹

- **WHEN** 用户点击「更多 → 打开所在文件夹」
- **THEN** 应用 SHALL 调用系统文件管理器定位当前文件

#### Scenario: 导出子菜单不提前消失

- **WHEN** 用户把指针从「导出」行移入右侧子菜单
- **THEN** 子菜单 SHALL 保持可见，SHALL NOT 在移入前关闭

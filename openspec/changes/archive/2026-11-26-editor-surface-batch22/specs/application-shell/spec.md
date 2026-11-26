## MODIFIED Requirements

### Requirement: 悬浮小窗编辑态为富文本

系统 SHALL 在悬浮小窗切到编辑态时以富文本渲染，不显示 Markdown 源码标记。

悬浮小窗的「预览 / 编辑」切换图标 SHALL 与页签文件卡一致：编辑态 SHALL 显示铅笔（pencil）图标，预览态 SHALL 显示眼睛（eye）图标。SHALL NOT 出现两处语义相反。

#### Scenario: 小窗编辑态

- **WHEN** 用户把悬浮小窗切到编辑态
- **THEN** 正文不出现 `**`/`##` 源码片段（A-6.1）

#### Scenario: 切换图标与页签文件卡一致

- **WHEN** 用户查看悬浮小窗的预览/编辑切换按钮与页签文件卡的同类图标
- **THEN** 编辑态图标 SHALL 为铅笔、预览态图标 SHALL 为眼睛，两处语义 SHALL 一致

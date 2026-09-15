## ADDED Requirements

### Requirement: A-11 预览表格宽度与自动换行

预览态表格 SHALL 占满内容区可用宽度（100%），表格宽度 SHALL 不随单元格内容长度横向延展；单元格文本 SHALL 自动换行，长句、长 URL、长英文单词/标识符 SHALL 可断行。常规文本内容 SHALL 不触发横向滚动；仅极端不可断内容（如内嵌固定宽度媒体）SHALL 以 `.table-wrap` 容器内横向滚动兜底，不得溢出内容区。

#### Scenario: 长内容表格不横向延展

- **WHEN** 用户预览含长句/长 URL 单元格的 Markdown 表格
- **THEN** 表格宽度 SHALL 不超过内容区可用宽度，SHALL 不出现横向滚动条

#### Scenario: 单元格内容自动换行

- **WHEN** 单元格文本超出该列可用宽度
- **THEN** 文本 SHALL 在单元格内自动换行（长单词/URL 可断行），SHALL 不撑宽表格

#### Scenario: 短内容表格满宽

- **WHEN** 用户预览内容较短的表格
- **THEN** 表格 SHALL 占满内容区可用宽度（不缩至内容宽度）

#### Scenario: 行宽设置联动

- **WHEN** 用户调整阅读行宽（紧凑/标准/宽松）或窗口宽度变化
- **THEN** 表格宽度 SHALL 随内容区宽度同步变化，SHALL 不出现横向延展

#### Scenario: 极端内容兜底

- **WHEN** 单元格含不可断的固定宽度内容（如内嵌宽图片）
- **THEN** 超出部分 SHALL 仅在 `.table-wrap` 容器内横向滚动，不得溢出内容区
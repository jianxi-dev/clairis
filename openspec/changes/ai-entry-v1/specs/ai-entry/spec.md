## ADDED Requirements

### Requirement: AE-1 ⌘K 浮层

`⌘K` SHALL 打开非模态底部浮层并聚焦输入；`Esc` 与点击外部 SHALL 关闭；空态 SHALL 给出提示与至少两个示例指令；提交后 SHALL 以纯文本展示结果，不出现字段名、JSON 或工具名。

#### Scenario: 打开与关闭

- **WHEN** 用户在任意界面按 `⌘K`，随后按 `Esc`
- **THEN** 浮层 SHALL 出现并聚焦输入，再 SHALL 关闭且不残留输入内容

#### Scenario: 空态

- **WHEN** 浮层打开且无对话
- **THEN** SHALL 显示一句提示与至少两个示例指令

### Requirement: AE-2 撤销与快照

AI 改动配置后 SHALL 出现 3 秒淡出的撤销条；点击撤销 SHALL 恢复到本轮之前的快照。快照面板 SHALL 列出最近 10 份并可恢复，恢复前 SHALL 保存当前状态。

#### Scenario: 一句话改主题后撤销

- **WHEN** 用户在浮层输入「换成深色主题」，随后点撤销
- **THEN** 主题 SHALL 回到改动前的值，快照列表 SHALL 多出本轮改动

### Requirement: AE-3 选区动作

编辑器存在非空选区时 SHALL 出现浮动胶囊（改写 / 翻译 / 润色）；执行后 SHALL 展示前后 diff；应用 SHALL 用结果替换选区且可撤销；取消 SHALL 保留原文。

#### Scenario: 取消无残留

- **WHEN** 用户触发「润色」后点取消
- **THEN** 选区文本 SHALL 逐字不变，胶囊与 diff SHALL 关闭

### Requirement: AE-4 确认密度

配置项 `aiConfirmDensity` SHALL 支持 `always` / `session-silent` / `never`，默认 `session-silent`。`always` SHALL 在执行写操作前给出确认；`session-silent` 与 `never` SHALL 直接执行并以撤销条兜底。

#### Scenario: 默认档不拦截

- **WHEN** 配置为默认的 `session-silent` 且用户提交一条改配置指令
- **THEN** 改动 SHALL 直接生效并出现撤销条，SHALL NOT 弹确认卡

### Requirement: AE-5 人话错误

错误 SHALL 用用户能懂的话表述（例：字号范围、连接失败），SHALL NOT 出现字段名、错误码或工具名。

#### Scenario: 越界字号

- **WHEN** AI 返回字号越界的改动
- **THEN** 浮层 SHALL 显示「字号需要在 8–96 之间」这类说明，SHALL NOT 出现 `fontSize` 或 JSON

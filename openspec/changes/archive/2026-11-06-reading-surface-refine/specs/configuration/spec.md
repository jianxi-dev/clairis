## ADDED Requirements

### Requirement: CF-6 阅读设置归属与设置窗自适应

字号、行宽、配色 SHALL 仅在设置场景提供入口，SHALL NOT 在正文右上角常驻浮层。设置场景 SHALL 在窄窗口内可纵向滚动且不越出视口；阅读空间的布局/密度/卡片高度 SHALL 保留在设置中。「沉浸」SHALL 作为阅读模式的唯一用户可见名称。

#### Scenario: 正文无设置浮层
- **WHEN** 用户打开 Markdown 阅读态
- **THEN** 正文右上角 SHALL NOT 显示字号/行宽/配色浮层

#### Scenario: 设置窗自适应
- **WHEN** 应用窗口高度小于设置内容高度
- **THEN** 设置内容区 SHALL 可滚动，底部内容 SHALL 可到达且不越出窗口

#### Scenario: 沉浸命名
- **WHEN** 用户查看顶栏阅读入口
- **THEN** 按钮文案 SHALL 为「沉浸」

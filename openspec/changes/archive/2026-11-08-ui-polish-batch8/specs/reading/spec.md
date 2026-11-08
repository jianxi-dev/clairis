## MODIFIED Requirements

### Requirement: A-10 阅读宽度与标题配色

预览阅读宽度 SHALL 默认为 880px（`min(880px, 可用宽度 - 48px)`），标题 SHALL 应用用户配置的标题配色（`headingColors`，经 CSS 变量注入，明暗主题均生效）。用户可选的页面宽度最大值 SHALL 为 1400px；三档预设 SHALL 为 紧凑 720px / 标准 960px / 宽松 1200px。

#### Scenario: 阅读宽度

- **WHEN** 用户选择宽松档
- **THEN** 正文行宽变量 `--type-measure` SHALL 为 1200px，宽内容上限 `--type-measure-wide` SHALL 不超过 1400px

#### Scenario: 标题配色

- **WHEN** 预览渲染 markdown 标题
- **THEN** h1-h6 SHALL 应用 `headingColors` 配置的颜色

### Requirement: PDF 页码工具条位置

PDF 的页码 / 翻页控件 SHALL 位于顶部按钮区，SHALL NOT 在滚动时于底部浮现页码工具条。页码区容器 SHALL NOT 绘制外边框——它是顶栏唯一不应带框的控件；PDF 外围背景 SHALL 跟随主题（`--app-bg`），在亮色 / 暗色 / 暖色之间切换时 SHALL 自动更新，SHALL NOT 固定为组件默认白或灰。PDF 页面纸面 SHALL NOT 被主题染色。

#### Scenario: 页码区无外框

- **WHEN** 用户打开一个 PDF
- **THEN** 顶栏页码区容器的计算 `border-width` SHALL 为 0px，页码 / 翻页控件 SHALL 仍可用

#### Scenario: PDF 外围底色跟随主题

- **WHEN** 用户把主题从亮色切到暗色
- **THEN** PDF 外围背景的计算颜色 SHALL 等于当前主题的 `--app-bg`，且页面纸面颜色 SHALL 不随之变暗

#### Scenario: 滚动不浮现底栏

- **WHEN** 用户滚动 PDF
- **THEN** SHALL NOT 在底部浮现页码/翻页工具条

#### Scenario: 顶部可翻页

- **WHEN** 用户需要翻页
- **THEN** 页码 / 上一页 / 下一页控件 SHALL 位于顶部按钮区可用


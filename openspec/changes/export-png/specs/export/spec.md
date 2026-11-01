## ADDED Requirements

### Requirement: EX-4 PNG 长图导出

应用 SHALL 支持把当前文档导出为 PNG 长图：宽度固定、高度按内容测量（上限 20000px），经 `foreignObject` 与 canvas 栅格化；导出 SHALL 等待字体就绪；产物 SHALL NOT 含署名或外部资源。

#### Scenario: 正常导出

- **WHEN** 用户对一篇普通长度的文档选择「导出图片…」
- **THEN** SHALL 生成 PNG 并写盘，图片内容与 HTML 预览一致

#### Scenario: 超长文档

- **WHEN** 测得的文档高度超过 20000px
- **THEN** 导出 SHALL 拒绝并提示「文档过长，建议导出 HTML」，SHALL NOT 产出截断图片

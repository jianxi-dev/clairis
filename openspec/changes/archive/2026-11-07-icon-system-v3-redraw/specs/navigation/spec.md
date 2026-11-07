## MODIFIED Requirements

### Requirement: 图标体系

全站图标 SHALL 使用静态 path 表（24×24 viewBox、`fill="currentColor"`、18px 密集/24px 主操作），SHALL NOT 引入图标库（含 universe-icon）、sprite、mask-CSS 或任何构建步骤。图标语言 SHALL 以描边为主（1.7、圆头圆角），实心仅用于播放/暂停、省略号（更多）、AI 星芒三处例外。SHALL 一概念一图标、同概念全产品同图标、不混风格、禁 emoji。可逆动作 SHALL 成对出现（全屏/退出、播放/暂停、音量/静音、钉住/取消钉住、循环三态），由成对 `IconName` 承载、调用点按下一个动作选择，SHALL NOT 给 `Icon` 组件加 state prop。类型色 SHALL 固定 8 类：Markdown #6366f1、HTML #f59e0b、文本 #64748b、PDF #ef4444、视频 #a855f7、图片 #10b981、代码 #06b6d4、音频 #ec4899。标签 SHALL 三级可设置（自动：主入口图标+文字、重复处仅图标/始终显示文字/仅图标）。设置内 SHALL 提供图标抽屉查看全部在用图标（名称/尺寸/已有-新绘）。

#### Scenario: 类型色一致性

- **WHEN** 同一 HTML 文件出现在门户磁贴、页签、阅读空间卡片与网格 tile
- **THEN** 四处类型图标 SHALL 使用同一 HTML 橙 #f59e0b 且形状一致

#### Scenario: 禁 emoji

- **WHEN** 审查全站图标渲染
- **THEN** SHALL 无任何 emoji 字符

#### Scenario: 描边与实心分工

- **WHEN** 审查图标抽屉中任一经描边渲染的图标
- **THEN** 该图标的 `<path>` SHALL 为 `fill="none"` 且带 `stroke="currentColor"`（线宽 1.7）
- **AND** 播放/暂停、更多、AI 星芒 SHALL 保持实心填充

#### Scenario: 可逆动作成对

- **WHEN** 打开任一可逆动作的两种状态（全屏中与未全屏、已钉住与未钉住、静音与未静音、播放与暂停）
- **THEN** 两种状态 SHALL 各对应一个独立 `IconName`，且形状为同一构图的反向/补全形态

#### Scenario: 不引入图标库

- **WHEN** 审查打包产物与 `src/ui/icons.ts`
- **THEN** 图标 SHALL 全部来自静态 path 表，SHALL NOT 存在图标库依赖或运行时生成

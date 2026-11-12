## ADDED Requirements

### Requirement: A-18 预览宽度与字体同源

预览态引用块的文字列宽度 SHALL 与正文段落相同。预览态标题与正文的字体族 SHALL 与 md-bundle 预览（`packages/renderer/src/readerCss.ts` 的 `--type-font-sans`）逐字一致；等宽文本 SHALL 使用 `--type-font-mono`。

#### Scenario: 引用块与段落等宽

- **WHEN** 用户在预览态打开含引用块与段落的文档
- **THEN** 两者文字列宽度差 SHALL 为 0px

#### Scenario: 字体族一致

- **WHEN** 用户分别测量预览态正文、标题、行内代码的计算 `font-family`
- **THEN** 正文与标题 SHALL 等于 `--type-font-sans` 的解析值，行内代码 SHALL 等于 `--type-font-mono` 的解析值

### Requirement: A-19 预览图片圆角

预览态图片的四个角 SHALL 为 12px 圆角，上下两角半径 SHALL 相同。

#### Scenario: 四角半径一致

- **WHEN** 用户在预览态打开含图片的文档
- **THEN** 图片计算 `border-radius` SHALL 为 `12px`，四个角 SHALL 相同
